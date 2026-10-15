-- Hardening from the 2026-10-15 security review. NOT yet applied to the live project
-- (the auto-mode classifier blocked apply_migration) — review, then run it in the
-- Supabase SQL editor. Does not touch Supabase Auth, is_admin(), expert_admin_profiles
-- or anything the login flow uses.

-- ── 1. Reject malformed/hostile expert_orders.items at write time ───────────────
-- Anon can insert orders (guest checkout) and `items` was free text, so a crafted
-- value could carry HTML into the admin panel. A legit cart is a JSON array of
-- {name, sku, qty, price}; qty/price must be numeric, name/sku plain strings.
create or replace function public.items_json_ok(p text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  j jsonb;
  el jsonb;
  k text;
  t text;
begin
  if p is null or btrim(p) = '' then return true; end if;
  begin
    j := p::jsonb;
  exception when others then
    return false;
  end;
  if jsonb_typeof(j) <> 'array' or jsonb_array_length(j) > 200 then return false; end if;
  for el in select value from jsonb_array_elements(j) loop
    if jsonb_typeof(el) <> 'object' then return false; end if;
    t := jsonb_typeof(el->'qty');
    if t is null then return false; end if;
    if not (t = 'number' or (t = 'string' and (el->>'qty') ~ '^[0-9]{1,9}(\.[0-9]{1,6})?$')) then return false; end if;
    t := coalesce(jsonb_typeof(el->'price'), 'null');
    if not (t in ('number','null') or (t = 'string' and (el->>'price') ~ '^[0-9]{1,9}(\.[0-9]{1,6})?$')) then return false; end if;
    foreach k in array array['name','sku'] loop
      t := coalesce(jsonb_typeof(el->k), 'null');
      if t not in ('string','null') then return false; end if;
    end loop;
  end loop;
  return true;
end;
$$;
revoke all on function public.items_json_ok(text) from public;
grant execute on function public.items_json_ok(text) to anon, authenticated, service_role;

-- Check existing data first — this must return 0 before the constraint is safe:
--   select count(*) from expert_orders where not items_json_ok(items);

alter table public.expert_orders
  add constraint expert_orders_items_valid check (public.items_json_ok(items)) not valid;
-- `not valid` = enforced for new/updated rows only; run this once the query above is 0:
--   alter table public.expert_orders validate constraint expert_orders_items_valid;

-- ── 2. Enforce Team Account (role 'custom') permissions server-side ─────────────
-- Built-in roles (super / bahar15 / 1) always pass. 'custom' accounts need the
-- matching per-tab view/edit flag from expert_admin_profiles.permissions.
create or replace function public.has_admin_perm(p_tab text, p_edit boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from expert_admin_profiles p
    where p.id = auth.uid()
      and (
        p.role <> 'custom'
        or (p.permissions -> p_tab ->> (case when p_edit then 'edit' else 'view' end)) = 'true'
      )
  );
$$;
revoke all on function public.has_admin_perm(text, boolean) from public;
grant execute on function public.has_admin_perm(text, boolean) to authenticated, service_role;

-- Same signatures as the live functions, so `create or replace` really replaces them.
create or replace function public.admin_list_orders()
returns setof expert_orders
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not is_admin(auth.uid()) then
    raise exception 'not authorized' using errcode = '28000';
  end if;
  -- A team account without Orders > view just sees an empty list (no login-time error).
  if not has_admin_perm('orders', false) then
    return;
  end if;
  return query select * from expert_orders order by created_at desc;
end;
$function$;

create or replace function public.admin_update_order_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not is_admin(auth.uid()) then
    raise exception 'not authorized' using errcode = '28000';
  end if;
  if not has_admin_perm('orders', true) then
    raise exception 'not authorized' using errcode = '28000';
  end if;
  if p_status not in ('pending', 'confirmed', 'delivered', 'cancelled') then
    raise exception 'invalid status: %', p_status;
  end if;
  update expert_orders set status = p_status where id = p_id;
end;
$function$;

create or replace function public.admin_delete_order(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not is_admin(auth.uid()) then
    raise exception 'not authorized' using errcode = '28000';
  end if;
  if not has_admin_perm('orders', true) then
    raise exception 'not authorized' using errcode = '28000';
  end if;
  delete from expert_orders where id = p_id;
end;
$function$;

-- Confirm no old overloads linger and grants are as intended:
--   select proname, pg_get_function_identity_arguments(oid) from pg_proc
--    where proname in ('admin_list_orders','admin_update_order_status','admin_delete_order','has_admin_perm','items_json_ok');
