// ═══════════════════════════════════════════════════════════════════════════
//  Edge Function: unsubscribe  (Deno / TypeScript)
//  Public, no-auth endpoint linked from every marketing email. Given a valid
//  ?token=<unsubscribe_token>, it flips the subscriber to unsubscribed=true
//  (using the service role) and returns a friendly HTML confirmation page.
//
//  Deploy WITHOUT JWT verification so email clients can open it directly:
//      supabase functions deploy unsubscribe --no-verify-jwt
//
//  Uses platform-provided SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
// ═══════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_BASE = "https://mukarramkebra.github.io/Hardware-Website/";

function page(title: string, message: string) {
  return new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
     <meta name="viewport" content="width=device-width, initial-scale=1">
     <title>${title} — Expert Hardware</title></head>
     <body style="margin:0;font-family:system-ui,Arial,sans-serif;background:#f6f7f9;color:#1f2937">
       <div style="max-width:520px;margin:60px auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:32px;text-align:center">
         <div style="color:#d20d17;font-weight:800;font-size:20px;letter-spacing:.5px;margin-bottom:14px">EXPERT HARDWARE</div>
         <h1 style="font-size:22px;margin:0 0 10px">${title}</h1>
         <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 22px">${message}</p>
         <a href="${SITE_BASE}" style="display:inline-block;background:#d20d17;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">Back to store</a>
       </div>
     </body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

async function unsubscribe(token: string): Promise<boolean> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/offer_subscribers?unsubscribe_token=eq.${encodeURIComponent(token)}`,
    {
      method: "PATCH",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ unsubscribed: true }),
    },
  );
  if (!res.ok) return false;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  if (!token || token === "preview") {
    return page("Invalid link", "This unsubscribe link is missing or invalid. If you keep receiving emails, contact muk@expertshardware.com.");
  }
  try {
    const ok = await unsubscribe(token);
    return ok
      ? page("You're unsubscribed", "You will no longer receive marketing emails from Expert Hardware. Sorry to see you go — you can subscribe again anytime from our website.")
      : page("Link not recognised", "We couldn't find a matching subscription. You may already be unsubscribed. Questions? Email muk@expertshardware.com.");
  } catch (_) {
    return page("Something went wrong", "We couldn't process your request right now. Please try again later or email muk@expertshardware.com.");
  }
});
