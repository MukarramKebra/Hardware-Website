# Architecture Codemap

<!-- Generated: 2026-10-11 | Files scanned: ~45 (code/, admin/, supabase/functions/, scripts/, .github/workflows/) | Token estimate: ~750 -->

## System overview

```
                  ┌───────────────────────────────────────────────┐
Visitor ────────► │  GitHub Pages (static)                        │
                  │  ├── index.html         ─ storefront          │
                  │  ├── product/<slug>.html ─ auto-generated SEO │
                  │  ├── admin/index.html   ─ owner/manager panel │
                  │  ├── code/css,js        ─ storefront assets   │
                  │  └── admin/css,js       ─ admin assets        │
                  └───────────────────┬───────────────────────────┘
                                      │ fetch (REST + RPC + Auth)
                                      ▼
                  ┌───────────────────────────────────────────────┐
                  │  Supabase project qhebhvllkovfbkqrcnmm        │
                  │  ├── Postgres tables (expert_*, offer_*)      │
                  │  ├── Auth (admin + storefront customers)      │
                  │  └── Edge Functions (Deno, Resend-backed)     │
                  └───────────────────────────────────────────────┘

GitHub Action (.github/workflows/generate-seo.yml)
  ├─ on push to main (ignores product/**, sitemap.xml)
  └─ on cron 03:17 UTC
     node scripts/generate-product-pages.js
     → reads live Supabase catalog, writes product/*.html + sitemap.xml, commits back
```

## Service boundaries

- **Storefront** (`index.html` + `code/`) — read-only against Supabase anon key.
- **Admin** (`admin/`) — authenticated Supabase user (RLS enforces `is_admin()`); mutating writes.
- **Product-page generator** (`scripts/generate-product-pages.js`) — runs in CI, reads Supabase, writes HTML into repo.
- **Edge Functions** (`supabase/functions/*`) — Deno + service-role; the only path that can create Auth users, send email, or run privileged side effects.

## Data flow — key paths

```
Shopper adds item → cart (localStorage)
  → openCheckout() → handleCheckoutSubmit() [03-product-cart-checkout.js]
  → saveOrderToSupabase() [04-i18n-order.js]  ─ insert into expert_orders (anon-callable)
  → deductStock() [02-catalog-render.js]      ─ RPC decrement_stock (anon-callable, subtract-only)
  → notifyOrderByEmail() → Edge Fn notify-order (Resend)
```

```
Owner edits product in admin
  → doLogin() [admin/js/03-auth.js] → /auth/v1/token (username → <u>@expert-admin.internal)
  → SB_HDRS.Authorization mutated with access_token (admin/js/01-core-data.js)
  → inventory/categories/photos/banners writes use SB_HDRS; RLS checks is_admin(auth.uid())
  → account CRUD routed through Edge Fn admin-manage-accounts (service-role)
```

```
Owner clicks "Flush Cache"
  → upsert expert_settings.asset_version = now()
  → every page reads it via checkAssetVersion() on load, bumps localStorage.expert_asset_v
  → next asset <link>/<script> uses ?v=<new>, cache miss, fresh CSS/JS
```

## Caching layers

- Storefront assets: querystring-busted via `expert_asset_v` (shared across `index.html` and `admin/index.html`, same origin).
- Category UI: `cat_order_cache`, `cat_labels_cache` in `localStorage` so renames paint synchronously before Supabase fetch resolves.
- Admin audit log: `localStorage.jain_audit_log` (per-browser, not synced).
- Deleted-products trash: `localStorage.jain_deleted` (60-day retention, client-side only).

## External dependencies

See [dependencies.md](dependencies.md). Notable fragility: a large slice of product images are hotlinked from `expertshardware.com` (the owner's older Magento storefront) rather than hosted here — downtime there breaks images here.
