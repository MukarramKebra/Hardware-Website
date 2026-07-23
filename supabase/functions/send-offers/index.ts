// ═══════════════════════════════════════════════════════════════════════════
//  Edge Function: send-offers  (Deno / TypeScript)
//  Secure server-side sender for Expert Hardware marketing campaigns.
//
//  A static frontend can't hold the Resend API key, so ALL sending happens
//  here. The admin panel and pg_cron call this function; it authenticates the
//  caller with a shared admin token, reads subscribers with the service role,
//  and sends via Resend from muk@expertshardware.com — with a per-recipient
//  unsubscribe link (legally required) in every email.
//
//  Secrets (set with `supabase secrets set …`, never in git):
//    RESEND_API_KEY     – your Resend API key
//    ADMIN_SEND_TOKEN   – a long random string; the admin panel + cron must
//                         send it in the `x-admin-token` header
//  Auto-provided by the platform:
//    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
//  Actions (JSON body { action, ... }):
//    { action: 'send_now',      subject, html }        send immediately to all active
//    { action: 'schedule',      subject, html, scheduled_at }  store for later
//    { action: 'send_campaign', campaign_id }          send one existing campaign
//    { action: 'run_scheduled' }                       (cron) send all due campaigns
//    { action: 'list_subscribers' }                    active subscriber list
//    { action: 'list_campaigns' }                      campaign history
//    { action: 'test',          subject, html, to }    send a single test email
// ═══════════════════════════════════════════════════════════════════════════

const FROM = "Expert Hardware <muk@expertshardware.com>";
const SITE_BASE = "https://mukarramkebra.github.io/Hardware-Website/";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const ADMIN_TOKEN = Deno.env.get("ADMIN_SEND_TOKEN")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-admin-token, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Thin REST helper against PostgREST using the service role (bypasses RLS).
async function db(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`DB ${path} -> ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function unsubscribeUrl(token: string) {
  return `${SUPABASE_URL}/functions/v1/unsubscribe?token=${encodeURIComponent(token)}`;
}

// Wrap the admin's HTML with a header + a mandatory unsubscribe footer.
function wrapEmail(html: string, unsubUrl: string) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <div style="max-width:600px;margin:0 auto;background:#fff">
    <div style="background:#d20d17;padding:18px 24px"><span style="color:#fff;font-size:18px;font-weight:800;letter-spacing:.5px">EXPERT HARDWARE</span></div>
    <div style="padding:24px;line-height:1.7;font-size:15px">${html}</div>
    <div style="padding:18px 24px;border-top:1px solid #eee;font-size:12px;color:#8a8a8a;line-height:1.6">
      You are receiving this because you subscribed to offers from Expert Hardware, Kuwait City.<br>
      <a href="${unsubUrl}" style="color:#8a8a8a;text-decoration:underline">Unsubscribe</a> &middot;
      <a href="${SITE_BASE}" style="color:#8a8a8a;text-decoration:underline">Visit our store</a>
    </div>
  </div></body></html>`;
}

async function resendSend(to: string, subject: string, html: string, unsubUrl: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to,
      subject,
      html: wrapEmail(html, unsubUrl),
      // RFC 8058 one-click unsubscribe — improves deliverability + compliance.
      headers: {
        "List-Unsubscribe": `<${unsubUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
}

// Send one campaign to every active subscriber; returns how many were sent.
async function deliverCampaign(campaign: { id: string; subject: string; html: string }) {
  await db(`offer_campaigns?id=eq.${campaign.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "sending" }),
  });

  const subs: Array<{ email: string; unsubscribe_token: string }> = await db(
    `offer_subscribers?unsubscribed=eq.false&select=email,unsubscribe_token`,
  );

  let sent = 0;
  const errors: string[] = [];
  for (const s of subs) {
    try {
      await resendSend(s.email, campaign.subject, campaign.html, unsubscribeUrl(s.unsubscribe_token));
      sent++;
      // Gentle pacing to stay well under Resend rate limits.
      await new Promise((r) => setTimeout(r, 120));
    } catch (e) {
      errors.push(`${s.email}: ${(e as Error).message}`);
    }
  }

  await db(`offer_campaigns?id=eq.${campaign.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: errors.length && sent === 0 ? "failed" : "sent",
      sent_at: new Date().toISOString(),
      sent_count: sent,
      error: errors.length ? errors.slice(0, 20).join(" | ") : null,
    }),
  });

  return { sent, failed: errors.length, total: subs.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // ── Auth: shared admin token (constant-ish check) ────────────────────────
  const token = req.headers.get("x-admin-token") || "";
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: any = {};
  try { body = await req.json(); } catch (_) { /* empty body ok for cron */ }
  const action = body.action || "run_scheduled";

  try {
    switch (action) {
      case "list_subscribers": {
        const subs = await db(
          `offer_subscribers?select=email,consent_at,created_at,unsubscribed&order=created_at.desc`,
        );
        return json({ subscribers: subs });
      }

      case "list_campaigns": {
        const rows = await db(
          `offer_campaigns?select=id,subject,status,scheduled_at,created_at,sent_at,sent_count,error&order=created_at.desc&limit=100`,
        );
        return json({ campaigns: rows });
      }

      case "test": {
        if (!body.subject || !body.html || !body.to) return json({ error: "subject, html, to required" }, 400);
        await resendSend(body.to, body.subject, body.html, unsubscribeUrl("preview"));
        return json({ ok: true, message: `Test sent to ${body.to}` });
      }

      case "schedule": {
        if (!body.subject || !body.html || !body.scheduled_at) {
          return json({ error: "subject, html, scheduled_at required" }, 400);
        }
        const row = await db(`offer_campaigns`, {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            subject: body.subject,
            html: body.html,
            status: "scheduled",
            scheduled_at: body.scheduled_at,
            created_by: body.created_by || null,
          }),
        });
        return json({ ok: true, campaign: row?.[0] });
      }

      case "send_now": {
        if (!body.subject || !body.html) return json({ error: "subject, html required" }, 400);
        const row = await db(`offer_campaigns`, {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            subject: body.subject,
            html: body.html,
            status: "sending",
            created_by: body.created_by || null,
          }),
        });
        const result = await deliverCampaign(row[0]);
        return json({ ok: true, campaign_id: row[0].id, ...result });
      }

      case "send_campaign": {
        if (!body.campaign_id) return json({ error: "campaign_id required" }, 400);
        const rows = await db(`offer_campaigns?id=eq.${body.campaign_id}&select=id,subject,html`);
        if (!rows?.length) return json({ error: "Campaign not found" }, 404);
        const result = await deliverCampaign(rows[0]);
        return json({ ok: true, campaign_id: rows[0].id, ...result });
      }

      case "run_scheduled": {
        // Called by pg_cron. Send every campaign whose time has come.
        const nowIso = new Date().toISOString();
        const due = await db(
          `offer_campaigns?status=eq.scheduled&scheduled_at=lte.${nowIso}&select=id,subject,html`,
        );
        const results = [];
        for (const c of due) {
          results.push({ id: c.id, ...(await deliverCampaign(c)) });
        }
        return json({ ok: true, processed: results.length, results });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
