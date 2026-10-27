# Backend Codemap

<!-- Generated: 2026-10-11 | Files scanned: supabase/functions/*, *.sql | Token estimate: ~700 -->

Backend here means Supabase (Postgres + Auth + Edge Functions) and the SQL/RPC surface the two frontends call. There is no custom app server — all HTTP endpoints are either PostgREST or Edge Functions.

## Edge Functions (Deno, `supabase/functions/*/index.ts`)

| Function | Entry | Auth | Side effects |
|---|---|---|---|
| `admin-login` | `admin-login/index.ts:54` | — | Resolves `<username>@expert-admin.internal` → Auth sign-in, returns tokens |
| `admin-manage-accounts` | `admin-manage-accounts/index.ts:73` | admin JWT | create/update/delete Supabase Auth users; writes `expert_admin_profiles` |
| `notify-order` | `notify-order/index.ts:57` | anon (idempotent) | Resend email to owner on new order |
| `order-invoice` | `order-invoice/index.ts:33` | public token | Renders `order-invoice.html` for a given order id |
| `send-offers` | `send-offers/index.ts:170` | `ADMIN_SEND_TOKEN` header | Blasts a campaign to `offer_subscribers` via Resend |
| `unsubscribe` | `unsubscribe/index.ts:47` | token in URL | Flips `offer_subscribers.unsubscribed=true` |

All Edge Functions read `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` from env; the email-capable ones also need `RESEND_API_KEY`.

## PostgREST surface (direct table/RPC reads from the browser)

Reads (anon):
- `GET /rest/v1/expert_products`
- `GET /rest/v1/expert_photos`
- `GET /rest/v1/expert_stock`
- `GET /rest/v1/expert_banners`
- `GET /rest/v1/expert_cat_bgs`
- `GET /rest/v1/expert_hidden`
- `GET /rest/v1/expert_settings` (keyed lookups: `site_disabled`, `seo_settings`, `asset_version`, `featured_offers`, `sku_map`, `brand_map`, `product_keywords`, `product_variants`, `qty_limits`, `cat_hidden`, `cat_order_cache`, `cat_labels_cache`)

Writes (anon):
- `POST /rest/v1/expert_orders` (checkout)
- `POST /rest/v1/offer_subscribers` (plain insert; 409 → "already exists")
- `RPC decrement_stock` (checkout — subtract only)
- `RPC increment_expert_analytics(product_id, views, searches)` (view/search counters)

Writes (admin JWT, gated by RLS `is_admin(auth.uid())`):
- `expert_products`, `expert_stock`, `expert_photos`, `expert_hidden`, `expert_banners`, `expert_cat_bgs`, `expert_settings`

## Auth model

- 1 Supabase Auth project; 2 populations:
  - **Admin users** — email `<username>@expert-admin.internal`; built-ins `ultimate15` (owner), `expert15` (manager), `expert` (admin) + Team Accounts created in Owner Controls.
  - **Storefront customers** — real email + password (`code/js/05-accounts.js`), optional Google OAuth.
- Role/permissions row in `expert_admin_profiles` keyed by Auth uuid. `is_admin()` function checks that table.
- Dead legacy tables (RLS-locked, zero policies): `expert_admin_accounts`, `expert_admin_master`.

## RLS gotchas worth remembering

- Admin-write tables deny anon writes but allow anon SELECT (storefront needs reads).
- `offer_subscribers` has no anon SELECT policy, so **do not** use `on_conflict` from the browser — Postgres needs read visibility to evaluate ON CONFLICT (`42501` under RLS). Use plain insert, treat 409 as duplicate.
- Function overloads survive `create or replace` if the arg list changed — explicit `drop function name(old-arg-types)` is required to remove the old overload.
- New Postgres functions grant `EXECUTE` to `PUBLIC` by default; `revoke ... from anon` alone is not enough.

## Key SQL files

- [expert-hardware-supabase.sql](../../expert-hardware-supabase.sql) — baseline schema for `expert_*` tables + analytics RPC.
- [expert-hardware-offers.sql](../../expert-hardware-offers.sql) — `offer_subscribers`, `offer_campaigns`.
- [expert-hardware-rls-hardening.sql](../../expert-hardware-rls-hardening.sql) — admin RLS policies, `is_admin()`.
- [expert-hardware-fix-id-sequence.sql](../../expert-hardware-fix-id-sequence.sql) — one-off sequence fix.
