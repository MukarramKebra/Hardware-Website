# Expert Hardware Kuwait — Handoff

## 1) Goal
Build and maintain **Expert Hardware** — a Kuwait-based hardware/tools store's public website plus an
admin/inventory panel. It's a plain HTML/CSS/vanilla-JS static site (no build step, no framework) hosted
on **GitHub Pages**, with **Supabase** (Postgres + REST API) as the backend for products, stock, orders,
photos, and all admin-configurable settings.

Live storefront: `https://mukarramkebra.github.io/Hardware-Website/`
Admin panel: `https://mukarramkebra.github.io/Hardware-Website/admin/`
Repo: `MukarramKebra/Hardware-Website`, working copy at `C:\Users\mukke\Desktop\Hardware-Website new`
(a second clone without "new" exists and should be kept in sync via `git reset --hard origin/main`).

## 2) Current state
- **200 products** in the database (196 real + purchasable, 4 are non-sellable "service" placeholder
  entries — Abrasive Sanding, Cleaning/Polishing, Cutting/Sawing, Grinding/Sharpening — kept visible but
  price-hidden with an "Ask Price on WhatsApp" button instead of Add to Cart).
- Products were scraped in two batches of ~100 from `expertshardware.com` (the owner's own existing
  catalog — same business, same phone/email/Google Maps listing confirmed) via their public GraphQL API.
  Each product has: real name, price (KWD), category (mapped to a custom 17-category taxonomy), a
  verified brand (TOLSEN, Dremel, INGCO, Stanley, Total, HARDEN, DCA, Makita, Milwaukee, Makute, FIXTEC,
  KDS, Genius, Edon, or Generic — verified by visually inspecting each product photo), a real SKU, a
  hand-written SEO description, and dedicated SEO keyword phrases.
- Product images are stored as files in the repo (`expert products/1-50/`, `51-100/`, `101-150/`,
  `151-200/`, named by SKU) and referenced from Supabase's `expert_photos` table by **URL**, not as
  inline base64 — this was a major fix this session (see section 5).
- Admin panel has tabs: Inventory, Analytics, Deleted, Orders, Reports, Categories, Banners, SEO, and
  Owner Controls (ultimate15 only). Three built-in accounts (`expert`/regular admin, `expert15`/manager,
  `ultimate15`/owner) plus a Team Accounts system for creating restricted logins with per-tab
  view/edit permissions.
- SEO: site-wide meta title/description/keywords editable in admin (SEO tab), per-product description +
  keywords editable in admin (Inventory → SEO button per row), full JSON-LD structured data
  (HardwareStore + dynamic Product ItemList for all 200 products) injected at runtime, robots.txt +
  sitemap.xml in place. Owner has started Google Search Console verification.
- Cache-busting: every local JS/CSS file is loaded with a `?v=<timestamp>` query string in both
  `index.html` and `admin/index.html`. **This must be bumped on every future push** that changes JS/CSS/
  HTML, or visitors/GitHub's CDN may keep serving old files. (Data changes — products, prices, stock —
  need no such bump; they're always fetched live from Supabase on every page load.)
- All site "settings" that aren't simple product columns (SKUs, brands, multi-category assignments,
  ignored stock alerts, per-product keywords, hidden-price flags, qty limits, banner list, site-disabled
  flag, SEO text) live in the generic `expert_settings` key/value table in Supabase — nothing requires
  manual SQL from the user; every feature reads/writes it via the REST API directly.

## 3) Active files
**Storefront (root):**
- `index.html` — main page markup (header, categories grid, offers, products, cart, checkout, footer,
  SEO meta tags + JSON-LD)
- `js/01-config-data.js` — Supabase config, `loadSBData()` (main data fetch), SKU/brand/keyword/price-
  hidden/qty-limit maps, site-disabled check, SEO settings override, category normalization
- `js/02-catalog-render.js` — category/offer rendering, product card rendering, banners, search
  matching, `_injectProductSchema()` (JSON-LD), multi-category helper
- `js/03-product-cart-checkout.js` — product detail modal, cart, checkout, quantity limit enforcement
- `js/04-i18n-order.js`, `js/05-accounts.js`, `js/06-features.js` — translations/RTL, customer accounts,
  wishlist/reviews/WhatsApp share/recently-viewed + final bootstrap calls (`renderProducts(); loadSBData();`)
- `css/01-base.css` … `css/09-widgets.css` — styles, split by topic
- `robots.txt`, `sitemap.xml` — SEO crawl config

**Admin (`admin/`):**
- `admin/index.html` — all admin markup + every modal (Add Product, CSV import, Photo, Stats, SEO,
  Qty Limits, Category Products, Team Account, Edit Banner). Has `<base href="../">` so all relative
  asset paths inside it resolve to the repo root, not `admin/`.
- `admin/js/01-core-data.js` — Supabase config (duplicated from storefront), `DEFAULT_CATS`,
  `getAllAdminProducts()`, `loadFromSupabase()` (the big Promise.all fetch + all `expert_settings` maps)
- `admin/js/03-auth.js` — login, team-account permission enforcement, `flushCache()`,
  `toggleSiteDisabled()`
- `admin/js/05-categories.js` — category background image editor, banner management
- `admin/js/07-orders.js` — Orders tab, Inventory table rendering, stats/alerts, ignore-alert,
  price-hide toggle
- `admin/js/08-inventory.js` — SKU helpers, Add Product, per-product qty-limit modal
- `admin/js/10-csv-import.js` — CSV/Excel bulk import (custom CSV parser — must handle quoted names
  with commas/quotes correctly, see section 5)
- `admin/js/11-multiselect-brand-cat.js` — multi-category picker, photo/crop editor, auto-login bootstrap
- `admin/js/12-seo.js` — site-wide SEO settings + per-product SEO (description + keywords) editor

**Data/reference:**
- `expert-hardware-supabase.sql` — full schema for a fresh Supabase project (all `expert_*` tables +
  RLS policies). Only needed if the project is ever recreated from scratch.
- `expert products/*/expert_import_*.csv` — record-keeping copies of what was imported; **not** meant
  to be re-imported (would create duplicates).
- `cat-images/` — the 17 category tile background images.

## 4) Changes made (this session, chronological highlights)
- Split originally-monolithic files into the per-topic files listed above.
- Rebuilt "Shop by Category" as 17 real Expert-Hardware categories (was 7 generic placeholders) with
  real category images scraped from the source site; added rotating vertical side banners (brand-aware,
  up/down nav, adaptive sizing, black letterboxing, 3s rotation) manageable from a dedicated admin tab.
- Migrated Supabase project (new URL/key) — found and updated all 3 hardcoded credential locations.
- Built a full permission system: per-tab view/edit for team accounts, hide-stock-numbers toggle,
  hide-stats-row toggle.
- Scraped and imported 100 products (batch 1, 1–100) then 100 more (batch 2, 101–200, 96 real + 4
  service placeholders) from expertshardware.com's GraphQL API, with images, verified brands, SKUs.
- Built full SEO: site meta tags + JSON-LD (HardwareStore + Product list), per-product descriptions/
  keywords (all handwritten, not scraped — source site had none), admin UI to edit all of it.
- Added searchable category/brand filter dropdowns in Inventory, a "Products" manager per category
  (add/remove products from any category), multi-category support synced to Supabase (was
  localStorage-only before, invisible to visitors).
- Added Hide Price / Show Price toggle (keeps real price, shows "Ask Price on WhatsApp" instead) and
  per-product min/max order quantity limits (default 0/0 = no limit).
- Added a Flush Cache button (Owner Controls, ultimate15 only) for the admin's own browser, plus a
  proper version-query-string cache-busting scheme for all JS/CSS files (the actual fix for "everyone
  sees the update immediately").

## 5) Failed attempts / bugs found and fixed
- **Category images pointed one directory too high** (`../cat-images/...`) — broke because
  `admin/index.html` already has `<base href="../">`, so the extra `../` over-corrected. Fixed by
  removing it.
- **`expert_photos` table column name mismatch**: every write used `url`, but the real column (per the
  setup SQL) is `img_url`. Every photo save had been silently failing (HTTP 400) since the table was
  created — across CSV import, Add Product, and the photo/crop editor. Fixed all 6 read/write sites.
- **Base64 images duplicated into `expert_products.img_url`**: because the `expert_photos` writes were
  silently failing (bug above), the code fell back to keeping full base64 image data directly on the
  product row. This bloated a single `expert_products` fetch to **3.2MB, taking up to 46–71 seconds** on
  Supabase's free tier. Fixed by migrating all images to `expert_photos` (verified byte-for-byte before
  clearing), and switched image storage entirely to lightweight GitHub Pages URLs instead of base64.
- **Removing the 60 demo/placeholder products broke three things** that still referenced the now-empty
  hardcoded `PRODUCTS` array: the dashboard stat cards (showed 0), the Analytics tab ("No data yet"
  always), and the per-product Stats modal (crashed). All three now read from `getAllAdminProducts()`.
- **Random stock-photo fallback (`picsum.photos`)**: when a product's real photo hadn't loaded yet, the
  UI filled the gap with an unrelated random internet photo instead of a neutral icon — looked like
  completely wrong products. Removed everywhere; replaced with a plain tools icon.
- **CSV import parser broke on product names containing `"` (inch marks)** — e.g. `6" pliers` — silently
  dropping those rows instead of importing them. Rewrote the parser to properly handle quoted CSV fields.
- **GitHub Pages deployment lag/stuck builds** happened repeatedly (a genuine one-time platform outage,
  plus several ordinary lag incidents) — diagnosed via `raw.githubusercontent.com` vs the live Pages URL
  and `githubstatus.com`'s public API; fixed each time with an empty trigger commit to force a rebuild.
  The version-query-string fix in section 4 should prevent the *symptom* (stale files after a real
  deploy) from recurring, but a stuck GitHub Pages build itself is outside anyone's control.
- **User corrections on approach** (kept for context, not bugs per se): initially misread "remove the
  banner/hero" as the About section; initially removed the category grid entirely instead of adding
  banners alongside it. Both corrected immediately once clarified.

## 6) Next steps (not yet done / explicitly deferred)
- **Products 201–300**: not yet scraped. User asked for this plus 4 more skipped placeholders from the
  201-300 range; paused pending explicit go-ahead (last ask was interrupted before confirming).
- **Google Search Console**: owner added the verification HTML file themselves; next step is submitting
  `sitemap.xml` in Search Console once ownership is verified (not done by me — outside site code).
- **Security issue flagged but not fixed (owner has not said yes)**: admin passwords are stored in
  plaintext (both hardcoded JS constants and the `expert_admin_accounts` table), and Supabase RLS is
  fully permissive (`using (true) with check (true)`), meaning anyone with the public anon key could read
  them. Offered to fix for free; no response yet.
- **Supabase free-tier cold starts**: occasional first-request-after-idle delays (up to ~60s) are a
  platform limitation, not a code bug. Only real fix is upgrading off the free tier — discussed, not
  actioned.
- **Ongoing discipline**: bump the `?v=` cache-busting timestamp in `index.html` and `admin/index.html`
  on every future push that touches JS/CSS/HTML.
