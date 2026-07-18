-- ============================================================================
--  EXPERT HARDWARE — RLS hardening pass
-- ----------------------------------------------------------------------------
--  HOW TO RUN:
--    Supabase Dashboard -> SQL Editor -> New query -> paste this -> Run
--  Safe to run more than once (drops/recreates policies, IF EXISTS guards).
--
--  CONTEXT — read this before assuming this "fixes everything":
--  The admin panel and every public visitor use the exact same public "anon"
--  API key (it's baked into the client JS, visible to anyone via view-source).
--  There is currently no separate login/session at the database level for
--  admin — admin auth is a client-side-only check against expert_admin_accounts.
--  Because of that, RLS CANNOT distinguish "the admin panel" from "a random
--  visitor with the anon key" for any table the admin panel writes to directly
--  (products, stock, photos, hidden flags, category backgrounds, banners,
--  admin accounts, settings). Those tables keep broad anon access below —
--  that's an explicit, documented decision, not an oversight. Properly closing
--  that gap requires giving admin its own real login (Supabase Auth), which
--  was intentionally deferred, not done here.
--
--  What THIS script actually tightens, using the auth system that already
--  exists for real customer accounts (separate from admin — see js/05-accounts.js):
--    - expert_orders:   a signed-in customer can only read/edit their OWN
--                        orders (previously any authenticated OR anon caller
--                        could read/edit any order by id — a real IDOR bug).
--    - expert_analytics: removes direct INSERT/DELETE for anon (only the
--                        increment_expert_analytics function needs to write,
--                        and it's now SECURITY DEFINER so it doesn't need
--                        table-level INSERT granted to anon at all).
--    - expert_reviews:  removes UPDATE/DELETE for anon — nothing in the app
--                        ever updates or deletes a review row directly.
--    - expert_settings: removes DELETE for anon — nothing in the app ever
--                        deletes a settings row (everything is an upsert).
--    - expert_customers: unchanged, already correctly scoped to auth.uid()=id.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Tables that MUST stay fully open to anon (admin panel has no other
--    credential to authenticate with). Recreated explicitly so the grant is
--    an intentional, documented choice rather than a leftover default.
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'expert_products','expert_stock','expert_photos','expert_hidden',
    'expert_cat_bgs','expert_banners','expert_admin_accounts'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t || '_public_all', t);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (true) with check (true);',
      t || '_public_all', t
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 2) expert_settings — drop DELETE; nothing in the app ever deletes a row.
-- ----------------------------------------------------------------------------
alter table public.expert_settings enable row level security;
drop policy if exists expert_settings_public_all on public.expert_settings;
drop policy if exists expert_settings_rw on public.expert_settings;
create policy expert_settings_rw
  on public.expert_settings
  for select
  to anon, authenticated
  using (true);
create policy expert_settings_write
  on public.expert_settings
  for insert
  to anon, authenticated
  with check (true);
create policy expert_settings_update
  on public.expert_settings
  for update
  to anon, authenticated
  using (true)
  with check (true);

-- ----------------------------------------------------------------------------
-- 3) expert_orders — anon stays broad (guest checkout + admin order
--    management both rely on it), but a signed-in customer using their own
--    real Supabase Auth session is now restricted to their own rows.
-- ----------------------------------------------------------------------------
alter table public.expert_orders enable row level security;
drop policy if exists expert_orders_public_all on public.expert_orders;
drop policy if exists expert_orders_anon_all on public.expert_orders;
drop policy if exists expert_orders_own on public.expert_orders;

create policy expert_orders_anon_all
  on public.expert_orders
  for all
  to anon
  using (true)
  with check (true);

create policy expert_orders_own
  on public.expert_orders
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy expert_orders_own_insert
  on public.expert_orders
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy expert_orders_own_update
  on public.expert_orders
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 4) expert_analytics — SELECT + UPDATE only for anon (admin's Analytics tab
--    reads it and its "reset" buttons PATCH it). No direct INSERT/DELETE —
--    the increment_expert_analytics function (below) is SECURITY DEFINER so
--    it doesn't need a table grant to do its inserts.
-- ----------------------------------------------------------------------------
alter table public.expert_analytics enable row level security;
drop policy if exists expert_analytics_public_all on public.expert_analytics;
drop policy if exists expert_analytics_rw on public.expert_analytics;
create policy expert_analytics_rw
  on public.expert_analytics
  for select
  to anon, authenticated
  using (true);
create policy expert_analytics_update
  on public.expert_analytics
  for update
  to anon, authenticated
  using (true)
  with check (true);

create or replace function public.increment_expert_analytics(
  p_id bigint, p_views integer, p_searches integer
) returns void
language sql
security definer
set search_path = public
as $func$
  insert into public.expert_analytics (product_id, views, searches)
  values (p_id, coalesce(p_views,0), coalesce(p_searches,0))
  on conflict (product_id) do update
    set views    = public.expert_analytics.views    + coalesce(excluded.views, 0),
        searches = public.expert_analytics.searches + coalesce(excluded.searches, 0);
$func$;

grant execute on function public.increment_expert_analytics(bigint, integer, integer)
  to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5) expert_reviews — SELECT + INSERT only. Nothing in the app ever updates
--    or deletes a review row directly, so those grants were pure exposure.
-- ----------------------------------------------------------------------------
alter table public.expert_reviews enable row level security;
drop policy if exists expert_reviews_public_all on public.expert_reviews;
drop policy if exists expert_reviews_rw on public.expert_reviews;
create policy expert_reviews_rw
  on public.expert_reviews
  for select
  to anon, authenticated
  using (true);
create policy expert_reviews_insert
  on public.expert_reviews
  for insert
  to anon, authenticated
  with check (true);

-- ----------------------------------------------------------------------------
-- 6) expert_customers — unchanged, already correct (kept here for reference).
-- ----------------------------------------------------------------------------
-- alter table public.expert_customers enable row level security;
-- create policy expert_customers_own on public.expert_customers for all
--   to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ============================================================================
--  Done. Verify with:
--  select tablename, policyname, roles, cmd from pg_policies
--  where schemaname='public' and tablename like 'expert_%' order by tablename;
-- ============================================================================
