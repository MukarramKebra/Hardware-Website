// ═══════════════════════════════════════════════════════════════════════════
//  Edge Function: unsubscribe  (Deno / TypeScript)
//  Public, no-auth endpoint linked from every marketing email. Given a valid
//  ?token=<unsubscribe_token>, it flips the subscriber to unsubscribed=true
//  (using the service role) then redirects to a static confirmation page.
//
//  Originally returned the confirmation HTML directly from this function —
//  changed because Supabase Edge Functions silently rewrite any text/html
//  response on a GET request to text/plain (documented platform behavior),
//  so the "confirmation page" was actually showing raw HTML source to every
//  customer who clicked unsubscribe. A 3xx redirect isn't HTML content, so
//  it isn't affected — the real page now lives on the static site.
//
//  Deploy WITHOUT JWT verification so email clients can open it directly:
//      supabase functions deploy unsubscribe --no-verify-jwt
//
//  Uses platform-provided SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
// ═══════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_BASE = "https://mukarramkebra.github.io/Hardware-Website/";

function redirect(status: string) {
  return Response.redirect(`${SITE_BASE}unsubscribed.html?status=${status}`, 302);
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
  if (!token || token === "preview") return redirect("invalid");
  try {
    const ok = await unsubscribe(token);
    return redirect(ok ? "ok" : "notfound");
  } catch (_) {
    return redirect("invalid");
  }
});
