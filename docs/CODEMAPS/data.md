# Data Codemap

<!-- Generated: 2026-10-11 | Files scanned: *.sql, admin/js/*, code/js/01-config-data.js | Token estimate: ~750 -->

Supabase project `qhebhvllkovfbkqrcnmm` ("Experts Hardware"). Two prefixes: `expert_*` (catalog/site) and `offer_*` (email).

## Tables

| Table | Purpose | Keyed by | Written from |
|---|---|---|---|
| `expert_products` | Base catalog row (name_en, name_ar, cat, img_url, price, badge, description) | `id` (bigint) | admin inventory |
| `expert_stock` | Live stock count | `product_id` | admin + `decrement_stock` RPC (checkout) |
| `expert_photos` | Uploaded/base64 photos (preferred over `expert_products.img_url` when present) | `product_id` | admin inventory |
| `expert_hidden` | Per-product hide flag | `product_id` | admin inventory |
| `expert_cat_bgs` | Per-category banner image | `cat` slug | admin categories |
| `expert_banners` | Hero carousel + pinned side-banners | `id` | admin banners |
| `expert_settings` | Catch-all key/value JSON blobs (see keys below) | `key` | admin everywhere |
| `expert_orders` | Checkout receipts | `id` | storefront checkout (anon insert) |
| `expert_analytics` | Views/searches per product | `product_id` | storefront RPC |
| `expert_reviews` | Product reviews (unused by current UI) | `id` | — |
| `expert_customers` | Storefront account profile (name, phone, address) | `id = auth.uid()` | storefront account tab (own-row RLS) |
| `expert_admin_profiles` | Admin role/perm/display_name | `id = auth.uid()` | Edge Fn `admin-manage-accounts` (service-role) |
| `offer_subscribers` | Email list (anon insert, no anon select) | email | storefront subscribe form |
| `offer_campaigns` | Sent campaign log | `id` | Edge Fn `send-offers` |

Dead historical tables (RLS-locked, kept for reference): `expert_admin_accounts`, `expert_admin_master`.

## `expert_settings` keys — JSON blob catalog

| Key | Shape | Owner |
|---|---|---|
| `asset_version` | `"<epoch_ms>"` string | admin Flush Cache / post-push flush |
| `site_disabled` | `"true"` / `"false"` | admin Owner Controls |
| `seo_settings` | `{title, description, keywords, og_image, ...}` | admin SEO tab |
| `featured_offers` | ordered `[{id, sale}]` — order = homepage ticker display order | admin offers |
| `sku_map` | `{productId: skuString}` | admin inventory |
| `brand_map` | `{productId: brandName}` | admin inventory |
| `product_keywords` | `{productId: [...]}` | admin SEO |
| `product_variants` | `{productId: [{label, price, sku, stock, ...}]}` | admin inventory |
| `qty_limits` | `{productId: {min, max}}` | admin inventory |
| `cat_hidden` | `{slug: true}` nav-only hide, or `{slug: 'all'}` storefront-wide hide | admin categories |
| `cat_order_cache` | ordered slug list — mirrored to `localStorage` | admin categories |
| `cat_labels_cache` | `{slug: {en, ar}}` — mirrored to `localStorage` | admin categories |

## RPCs

- `decrement_stock(items jsonb)` — anon-callable, subtract-only; the storefront checkout path.
- `increment_expert_analytics(product_id, views, searches)` — anon-callable analytics counter.
- `is_admin(uid uuid)` — SECURITY DEFINER, used in every admin-table RLS policy.

## Relationships

```
auth.users (Supabase Auth)
  ├─1─ expert_admin_profiles  (role, permissions)   ─ admin login path
  └─1─ expert_customers       (name, phone, address) ─ storefront accounts

expert_products ─1── expert_stock
                ├1── expert_photos (overrides img_url when present)
                ├1── expert_hidden
                └── expert_settings.sku_map/brand_map/variants/qty_limits/product_keywords (by id)

offer_subscribers ──* offer_campaigns (via subscriber_id)
```

## Image data pattern

- `expert_products.img_url` holds **plain URLs only** (never base64 — fetched on every page load).
- Full/base64 uploads live in `expert_photos`, which the storefront checks first.
- Many URLs point to external paths (`expertshardware.com/media/...`, `expert-products/<range>/...`, `Bahar-Products/SKU-####.jpg`). Before renaming any image folder, query:
  ```sql
  select count(*) from expert_photos   where img_url ilike '%<folder>%';
  select count(*) from expert_products where img_url ilike '%<folder>%';
  ```

## Migration pattern

- Schema is applied by executing the SQL files in order; no formal migrations tool.
- `scripts/*.js` are one-off maintenance/data-backfill scripts (plain Node, no deps). Always run with `--dry-run` first.
- Product pages regen is CI-driven: `.github/workflows/generate-seo.yml` → `node scripts/generate-product-pages.js`.
