// ═══════════════════════════════════════════════════════════════════════════
//  Edge Function: notify-order  (Deno / TypeScript)
//  Called right after a customer places an order (js/04-i18n-order.js). Sends
//  an invoice-formatted email to muk@expertshardware.com with a link to the
//  printable invoice (order-invoice function).
//
//  Re-fetches the order server-side by id rather than trusting the request
//  body, so the email always reflects what's actually stored — and it's
//  idempotent: a `notified` flag on expert_orders is flipped with an atomic
//  conditional UPDATE (?notified=eq.false) before sending, so a retried or
//  duplicated call can't send the same order twice.
//
//  Deploy WITHOUT JWT verification — called anonymously right after checkout,
//  same as other public storefront actions:
//      supabase functions deploy notify-order --no-verify-jwt
//
//  Secrets: RESEND_API_KEY (already set for send-offers).
//  Auto-provided: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// ═══════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const OWNER_EMAIL = "muk@expertshardware.com";
const FROM = "Expert Hardware <muk@expertshardware.com>";
const SITE_BASE = "https://mukarramkebra.github.io/Hardware-Website/";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function money(n: number): string {
  return n.toFixed(3) + " KWD";
}

async function db(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`DB ${path} -> ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: any = {};
  try { body = await req.json(); } catch (_) {}
  const orderId = body.order_id;
  if (!orderId) return json({ error: "order_id required" }, 400);

  try {
    const rows = await db(`expert_orders?id=eq.${orderId}&select=*`);
    if (!rows?.length) return json({ error: "Order not found" }, 404);
    const o = rows[0];

    // Atomic claim: only proceed if we're the one flipping notified false -> true.
    const claimed = await db(`expert_orders?id=eq.${orderId}&notified=eq.false`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ notified: true }),
    });
    if (!claimed?.length) return json({ ok: true, skipped: "already notified" });

    let items: Array<{ name: string; sku?: string; qty: number; price: number }> = [];
    try { items = JSON.parse(o.items || "[]"); } catch (_) { items = []; }

    const rowsHtml = items.map((it) => `
      <tr>
        <td style="padding:8px 6px;border-bottom:1px solid #eee">${esc(it.name)}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:center">${esc(it.qty)}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right">${money(Number(it.price) || 0)}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right;font-weight:700">${money((Number(it.price) || 0) * (Number(it.qty) || 0))}</td>
      </tr>`).join("");

    const shortId = String(o.id).slice(0, 8).toUpperCase();
    const invoiceUrl = `${SITE_BASE}order-invoice.html?id=${o.id}`;
    const created = o.created_at ? new Date(o.created_at) : new Date();

    const html = `<!DOCTYPE html><html><body style="margin:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
      <div style="max-width:600px;margin:0 auto;background:#fff">
        <div style="background:#d20d17;padding:18px 24px"><span style="color:#fff;font-size:18px;font-weight:800">New Order #${esc(shortId)}</span></div>
        <div style="padding:24px">
          <p style="margin:0 0 16px;font-size:14px">A new order just came in — ${esc(created.toLocaleString())}</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:8px">
            <tr><td style="padding:4px 0;color:#888;width:110px">Customer</td><td style="font-weight:700">${esc(o.customer_name)}</td></tr>
            <tr><td style="padding:4px 0;color:#888">Phone</td><td>${esc(o.customer_phone)}</td></tr>
            <tr><td style="padding:4px 0;color:#888">${o.address === "PICK UP" ? "Fulfilment" : "Address"}</td><td>${o.address === "PICK UP" ? "Store Pick Up" : esc(o.address)}</td></tr>
            ${o.notes ? `<tr><td style="padding:4px 0;color:#888">Notes</td><td>${esc(o.notes)}</td></tr>` : ""}
          </table>
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px">
            <thead><tr style="border-bottom:2px solid #111827">
              <th style="padding:8px 6px;text-align:left">Item</th>
              <th style="padding:8px 6px;text-align:center">Qty</th>
              <th style="padding:8px 6px;text-align:right">Price</th>
              <th style="padding:8px 6px;text-align:right">Total</th>
            </tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div style="text-align:right;margin-top:10px;font-size:16px;font-weight:900;color:#d20d17">Total: ${money(Number(o.total) || 0)}</div>
          <div style="text-align:center;margin-top:28px">
            <a href="${invoiceUrl}" style="display:inline-block;background:#d20d17;color:#fff;text-decoration:none;font-weight:800;padding:12px 26px;border-radius:9px;font-size:14px">🖨️ View &amp; Print Invoice</a>
          </div>
        </div>
        <div style="padding:14px 24px;border-top:1px solid #eee;font-size:11px;color:#999;text-align:center">
          <a href="${SITE_BASE}" style="color:#999">Expert Hardware</a>
        </div>
      </div></body></html>`;

    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: OWNER_EMAIL,
        subject: `New Order #${shortId} — ${o.customer_name} — ${money(Number(o.total) || 0)}`,
        html,
      }),
    });
    if (!sendRes.ok) throw new Error(`Resend ${sendRes.status}: ${await sendRes.text()}`);

    return json({ ok: true, order_id: o.id, invoice_url: invoiceUrl });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
