// ═══════════════════════════════════════════════════════════════════════════
//  Edge Function: order-invoice  (Deno / TypeScript)
//  Public, no-auth GET endpoint that returns a single order as JSON. The
//  actual printable invoice page lives on the static site (order-invoice.html)
//  and fetches from here — Supabase Edge Functions rewrite any text/html GET
//  response to text/plain (documented platform limitation, confirmed against
//  the unsubscribe function too), so serving the HTML page itself from here
//  doesn't work. JSON responses aren't affected by that rewrite.
//
//  Order ids are random UUIDs (not sequential), so the link itself is the
//  access control — same model as the unsubscribe function's token link.
//
//  Deploy WITHOUT JWT verification so the emailed link's fetch call works
//  without a user session:
//      supabase functions deploy order-invoice --no-verify-jwt
//
//  Uses platform-provided SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
// ═══════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  if (!id) return json({ error: "Missing order id" }, 400);

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/expert_orders?id=eq.${encodeURIComponent(id)}&select=*`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    );
    if (!res.ok) throw new Error(`DB ${res.status}`);
    const rows = await res.json();
    if (!rows?.length) return json({ error: "Order not found" }, 404);
    const o = rows[0];

    let items: Array<{ name: string; sku?: string; qty: number; price: number }> = [];
    try { items = JSON.parse(o.items || "[]"); } catch (_) { items = []; }

    return json({
      id: o.id,
      customer_name: o.customer_name,
      customer_phone: o.customer_phone,
      customer_email: o.customer_email,
      address: o.address,
      notes: o.notes,
      status: o.status,
      total: o.total,
      created_at: o.created_at,
      items,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
