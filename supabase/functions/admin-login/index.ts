// ═══════════════════════════════════════════════════════════════════════════
//  Edge Function: admin-login  — RETIRED (disabled stub)
//
//  This used to compare a submitted password against plaintext-looking values
//  in expert_admin_master / expert_admin_accounts. The admin panel no longer
//  calls it: doLogin() in admin/js/03-auth.js signs in through Supabase Auth
//  (/auth/v1/token) instead. Left deployed as an unauthenticated login oracle
//  it would only have allowed unlimited online password guessing, so it now
//  answers 410 Gone to everything and touches no tables or secrets.
//
//  Safe to delete outright:  supabase functions delete admin-login
//  (or via the Supabase dashboard -> Edge Functions).
// ═══════════════════════════════════════════════════════════════════════════

Deno.serve((_req: Request) =>
  new Response(JSON.stringify({ ok: false, error: "gone" }), {
    status: 410,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  })
);
