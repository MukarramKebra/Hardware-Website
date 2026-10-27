# Frontend Codemap

<!-- Generated: 2026-10-11 | Files scanned: index.html, admin/index.html, code/js/*, code/css/*, admin/js/*, admin/css/* | Token estimate: ~900 -->

Two independent static apps, same origin, sharing one `localStorage` and one `expert_asset_v` cache-bust key.

## Entry points

- [index.html](../../index.html) — storefront. Dynamic `<link>`/`<script>` injection at load (two IIFEs near top and bottom) using `localStorage.expert_asset_v`.
- [admin/index.html](../../admin/index.html) — admin SPA. `<base href="../">` so relative paths resolve from the project root, same cache-bust mechanism.
- [product/*.html](../../product/) — generated SEO pages. Each one re-opens the storefront with `?pid=<id>` style hydration via `openProduct()`.

## Storefront JS modules (`code/js/`, loaded in numeric order)

| File | Responsibility |
|---|---|
| `01-config-data.js` | SB client, `UL/U` image helpers, `getAllProducts()` single-source lookup, `_catFullyHiddenSlugs` filter, `applySEOSettings()`, site-disable overlay, `loadSBData()` fan-out loader, `checkAssetVersion()` |
| `02-catalog-render.js` | Catalog grid, search (fuzzy + "did you mean"), banners (incl. pinned side-banners sized to the gutter at 0.75x), categories/subcategories, cart-trigger wiring, `deductStock()` RPC, product schema injection |
| `03-product-cart-checkout.js` | Product modal, variant selector, quantity rules (`qty_limits`), add-to-cart, cart UI, checkout flow + guest/auth branch |
| `04-i18n-order.js` | EN/AR toggle (`setLang`), RTL swap, `saveOrderToSupabase()`, `notifyOrderByEmail()`, category background painting, offers ticker fill |
| `05-accounts.js` | Customer sign-up/sign-in (email + Google OAuth), session refresh, profile + order history, header state, OAuth hash parser |
| `06-features.js` | Wishlist, URL `?q=` search handoff (sitelinks search), misc. feature glue |
| `07-subscribe.js` | Offers subscribe form + nudge, insert into `offer_subscribers` (plain insert, 409-tolerant) |

CSS counterparts in `code/css/` are split by concern: `01-base`, `02-sections`, `03-cart-features-contact`, `04-footer`, `05-responsive`, `06-lang-rtl`, `07-modals`, `08-account-auth`, `09-widgets`.

## Storefront UI tree (coarse)

```
<header>
  logo · categories pills · lang toggle · search · account · cart
<main>
  hero carousel (desktop + mobile; mobile hides pinned side-banners)
  pinned side-banners (desktop only, 0.75x gutter width, aligned to categories)
  category tiles (red boundary, Shop-by-Category heading removed Oct 2026)
  offers ticker
  product grid (filter + sort + sub-filter)
  footer
<overlays>
  product modal · cart modal · checkout modal
  auth modal · account modal · search overlay
  site-closed overlay (if expert_settings.site_disabled)
```

## Admin JS modules (`admin/js/`)

| File | Responsibility |
|---|---|
| `01-core-data.js` | SB headers (`SB_HDRS` — mutated post-login), `loadFromSupabase()`, `getAllAdminProducts()`, legacy-cat normalizer, `DEFAULT_CATS` |
| `02-helpers.js` | Shared helpers (toasts, confirms, formatting) |
| `03-auth.js` | `doLogin()` → `/auth/v1/token`, logout, session restore |
| `04-tabs-nav.js` | `switchTab()` — single router for all tabs |
| `05-categories.js` | Categories tab, `CAT_DEFS`, `saveCatChanges()` (writes `cat_order_cache`/`cat_labels_cache`) |
| `06-reports.js` | Analytics/Reports views |
| `07-orders.js` | Orders tab + badge |
| `08-inventory.js` | Inventory table (price/stock/photos/badge/variants) |
| `09-deleted.js` | 60-day client-side trash (`localStorage.jain_deleted`) |
| `10-csv-import.js` | Bulk import from `jain_import_products.xlsx/csv` |
| `11-multiselect-brand-cat.js` | Brand + multi-category chip picker |
| `12-seo.js` | SEO tab → writes `expert_settings.seo_settings` (overrides storefront meta) |
| `13-offers.js` | Email campaigns → Edge Fn `send-offers` with per-browser `ADMIN_SEND_TOKEN` |
| `14-product-view.js` | Product detail/edit modal |

## Admin tab map

```
switchTab(name)  (admin/js/04-tabs-nav.js:5)
  'inventory' | 'analytics' | 'deleted' | 'orders' | 'reports'
  'categories' | 'banners' | 'offers' | 'seo' | 'owner'
```

## State the UI depends on (not reconstructible from products)

- `cart` (localStorage) — current shopping cart
- `wishlist` (localStorage)
- `cat_order_cache` / `cat_labels_cache` — synchronous paint of renamed/reordered categories
- `expert_asset_v` — cache-bust token, authoritative copy in `expert_settings.asset_version`
- `jain_deleted` — admin trash
- `jain_audit_log` — admin action history (per-browser)
