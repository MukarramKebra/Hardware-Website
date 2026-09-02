// ═══════════════════════════════════════════════════════════════════════════
//  Edge Function: admin-login  (Deno / TypeScript)
//  Server-side credential check for the admin panel (admin/index.html).
//
//  Previously the owner/manager/admin passwords lived as plain constants in
//  admin/js/01-core-data.js — a public, static file served to anyone who
//  loaded the admin panel or just fetched the file directly. Team-account
//  logins ("Team Accounts" in Owner Controls) had the same problem one level
//  worse: the browser queried expert_admin_accounts directly with the public
//  anon key, so anyone could read every team member's plaintext password via
//  a raw REST call, no login required.
//
//  This function is the fix: the browser sends {username, password} here,
//  and the check happens here instead, using the service role key (which
//  never leaves Supabase's servers) against two tables:
//    - expert_admin_master   — the 3 built-in accounts (owner/manager/admin),
//                              RLS-locked with no anon/authenticated policies
//                              at all, so it's reachable only from here.
//    - expert_admin_accounts — team accounts created in Owner Controls.
//  Neither table's contents are ever sent to the browser except as the
//  {ok, role, ...} result of a successful login for THAT specific account.
//
//  Auto-provided by the platform: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ═══════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Thin REST helper against PostgREST using the service role (bypasses RLS).
async function db(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`DB ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const username = (body.username || "").trim();
  const password = body.password || "";
  if (!username || !password) return json({ ok: false });

  try {
    // Built-in accounts first (owner / manager / regular admin)
    const masters = await db(
      `expert_admin_master?username=eq.${encodeURIComponent(username)}&select=role,password`,
    );
    if (Array.isArray(masters) && masters.length && masters[0].password === password) {
      return json({ ok: true, role: masters[0].role });
    }

    // Team accounts created in Owner Controls
    const accounts = await db(
      `expert_admin_accounts?username=eq.${encodeURIComponent(username)}&select=password,permissions,display_name`,
    );
    if (Array.isArray(accounts) && accounts.length && accounts[0].password === password) {
      return json({
        ok: true,
        role: "custom",
        permissions: accounts[0].permissions || {},
        display_name: accounts[0].display_name || username,
      });
    }

    return json({ ok: false });
  } catch (e) {
    console.error("[admin-login] error:", e);
    return json({ ok: false, error: "server_error" }, 500);
  }
});
