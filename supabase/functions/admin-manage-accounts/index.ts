// ═══════════════════════════════════════════════════════════════════════════
//  Edge Function: admin-manage-accounts  (Deno / TypeScript)
//  Server-side create/update/delete/list for admin logins (built-in owner/
//  manager/admin accounts, and Team Accounts created in Owner Controls).
//
//  Previously "Team Accounts" were rows in expert_admin_accounts, created
//  and read directly from the browser with the public anon key — so every
//  team member's plaintext password was readable by anyone, and anyone
//  could insert themselves a new admin account with no login at all. Real
//  accounts now live in Supabase Auth (auth.users) + a matching row in
//  expert_admin_profiles (role/permissions/display_name), and can only be
//  created, edited, or deleted through this function using the service
//  role key — never directly from the browser.
//
//  The caller must be an already-logged-in super/bahar15 admin (matches
//  the existing Owner Controls UI, which only shows Team Accounts to those
//  two roles) — verified here by resolving their own access token via
//  Supabase Auth, then checking their expert_admin_profiles.role.
//
//  Auto-provided by the platform: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ═══════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EMAIL_DOMAIN = "expert-admin.internal";

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

async function adminFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw { status: res.status, data };
  return data;
}

// Resolves the caller's own uid from the access token they're logged in
// with, then confirms they're a super/bahar15 admin. Returns null if not.
async function requireOwnerOrManager(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: authHeader },
  });
  if (!userRes.ok) return null;
  const user = await userRes.json();
  const profiles = await adminFetch(
    `/rest/v1/expert_admin_profiles?id=eq.${user.id}&select=role`,
  );
  if (!Array.isArray(profiles) || !profiles.length) return null;
  const role = profiles[0].role;
  return role === "super" || role === "bahar15" ? user.id : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  try {
    const action = body.action;

    // One-time bootstrap: creates the 3 built-in accounts (owner/manager/
    // regular admin). Only works while expert_admin_profiles is empty — the
    // very first successful bootstrap permanently closes this path, since
    // every call after that has at least one row to check against. No
    // caller auth needed/possible here (nobody can be logged in yet).
    if (action === "bootstrap") {
      const existing = await adminFetch(`/rest/v1/expert_admin_profiles?select=id&limit=1`);
      if (Array.isArray(existing) && existing.length) {
        return json({ ok: false, error: "already_bootstrapped" }, 403);
      }
      const accounts = Array.isArray(body.accounts) ? body.accounts : [];
      const created = [];
      for (const acc of accounts as Array<{ username: string; password: string; role: string }>) {
        const authUser = await adminFetch(`/auth/v1/admin/users`, {
          method: "POST",
          body: JSON.stringify({
            email: `${acc.username}@${EMAIL_DOMAIN}`,
            password: acc.password,
            email_confirm: true,
          }),
        });
        await adminFetch(`/rest/v1/expert_admin_profiles`, {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify([{
            id: authUser.id, username: acc.username, role: acc.role, display_name: acc.username,
          }]),
        });
        created.push({ username: acc.username, id: authUser.id });
      }
      return json({ ok: true, created });
    }

    const callerId = await requireOwnerOrManager(req.headers.get("authorization"));
    if (!callerId) return json({ ok: false, error: "forbidden" }, 403);

    if (action === "list") {
      const rows = await adminFetch(
        `/rest/v1/expert_admin_profiles?role=eq.custom&select=id,username,role,permissions,display_name&order=username.asc`,
      );
      return json({ ok: true, accounts: rows });
    }

    if (action === "create") {
      const username = String(body.username || "").trim();
      const password = String(body.password || "");
      if (!username || !password) return json({ ok: false, error: "missing_fields" }, 400);

      const authUser = await adminFetch(`/auth/v1/admin/users`, {
        method: "POST",
        body: JSON.stringify({
          email: `${username}@${EMAIL_DOMAIN}`,
          password,
          email_confirm: true,
        }),
      });

      await adminFetch(`/rest/v1/expert_admin_profiles`, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify([{
          id: authUser.id,
          username,
          role: "custom",
          permissions: body.permissions || {},
          display_name: body.display_name || username,
        }]),
      });

      return json({ ok: true, id: authUser.id });
    }

    if (action === "update") {
      const id = String(body.id || "");
      if (!id) return json({ ok: false, error: "missing_id" }, 400);

      if (body.password) {
        await adminFetch(`/auth/v1/admin/users/${id}`, {
          method: "PUT",
          body: JSON.stringify({ password: String(body.password) }),
        });
      }

      const profileUpdate: Record<string, unknown> = {};
      if (body.permissions !== undefined) profileUpdate.permissions = body.permissions;
      if (body.display_name !== undefined) profileUpdate.display_name = body.display_name;
      if (Object.keys(profileUpdate).length) {
        await adminFetch(`/rest/v1/expert_admin_profiles?id=eq.${id}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(profileUpdate),
        });
      }

      return json({ ok: true });
    }

    if (action === "delete") {
      const id = String(body.id || "");
      if (!id) return json({ ok: false, error: "missing_id" }, 400);
      // Deleting the auth user cascades to expert_admin_profiles (FK on delete cascade).
      await adminFetch(`/auth/v1/admin/users/${id}`, { method: "DELETE" });
      return json({ ok: true });
    }

    return json({ ok: false, error: "unknown_action" }, 400);
  } catch (e) {
    console.error("[admin-manage-accounts] error:", e);
    const status = (e as { status?: number })?.status || 500;
    return json({ ok: false, error: "server_error" }, status >= 400 && status < 600 ? status : 500);
  }
});
