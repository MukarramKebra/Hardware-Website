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
- **300 products** in the database. First 200: 196 real + purchasable, 4 non-sellable "service"
  placeholders (Abrasive Sanding, Cleaning/Polishing, Cutting/Sawing, Grinding/Sharpening) kept visible
  but price-hidden with an "Ask Price on WhatsApp" button instead of Add to Cart. Products 201–300 add
  Nails/Wires (34), Tapes (26), Fasteners (27), gloves under Safety (12), and welding electrodes (1).
  All scraped from `expertshardware.com` (the owner's own existing catalog) via their public GraphQL API;
  each has a real name, price (KWD), category (17-category taxonomy), a verified brand (TOLSEN, Dremel,
  INGCO, Stanley, Total, HARDEN, DCA, Makita, Milwaukee, Makute, FIXTEC, KDS, Genius, Edon, iTrust,
  Suretape, EPS, CENMET, Agile, or Generic for genuinely unbranded commodity items — verified by visually
  inspecting each product photo), a real SKU, a hand-written SEO description, and SEO keyword phrases.
- **Size/pack options ("variants")**: any product can carry a list of options (e.g. 2" vs 3" nails, a
  tarpaulin's 24 different sizes), each with its own optional price/SKU/image/description — anything left
  blank falls back to the product's own. Storefront shows options as a dropdown directly on the product
  card (price updates live) and as clickable image tiles in the product popup (replacing a plain
  `<select>`); whichever option is picked becomes its own cart line, sharing the parent product's stock
  pool and qty limits. Admin edits options per product (Inventory row → Options, or picks up the same
  editor) with up/down reorder arrows controlling display order, an Upload-from-Computer button per
  option's image field, and duplicates the parent's own image/description into new option rows as a
  starting point. Stored in `expert_settings` key `product_variants`.
- Product images live as files in the repo (`expert products/1-50/` … `251-300/`, named by SKU) and are
  referenced from Supabase's `expert_photos` table by **URL**, not inline base64. Photos are fetched in
  the *same* batched request as the rest of product data (not a separate delayed fetch — that split only
  mattered when photos carried base64 blobs; now they're lightweight URL strings, ~25KB total).
- Admin panel tabs: Inventory, Analytics, Deleted, Orders, Reports, Categories, Banners, SEO, and Owner
  Controls (ultimate15 only). Three built-in accounts (`expert`/admin, `expert15`/manager,
  `ultimate15`/owner) plus a Team Accounts system for restricted logins with per-tab view/edit permissions.
- **SEO**: site-wide meta title/description/keywords editable in admin (SEO tab), which also now lists
  every product (thumbnail, category, description preview with a "Missing" flag, keyword count, Edit
  button) so per-product description/keyword editing isn't buried in Inventory row actions. Full JSON-LD
  structured data (HardwareStore + dynamic Product ItemList, complete with images from the very first
  render) injected at runtime; "Generic"-branded products omit the `brand` field entirely rather than
  literally telling Google the brand is "Generic". robots.txt + sitemap.xml in place; Google Search
  Console verified.
- **Storefront search** now offers "Did you mean...?" suggestions when a query returns nothing —
  compares each typed word (edit distance) against every real word in product names/brands/
  categories/keywords, only surfacing a suggestion that actually returns results. Works in Arabic too.
- **Cache-busting is now two-layered**: each JS/CSS file's `?v=` version comes from `localStorage`,
  falling back to a baked-in timestamp constant for a visitor's very first-ever load; a background check
  compares that local version against `expert_settings.asset_version` in Supabase and auto-reloads once
  if they differ. Admin's **Flush Cache** button (Owner Controls) bumps that shared Supabase value, which
  forces *every* visitor onto fresh files on their next page check — a real Magento-style global flush,
  not just clearing the admin's own browser cache like it originally did. The loader itself uses DOM
  `createElement`/`appendChild`, not `document.write` (see section 5 — document.write silently breaks
  under ad-blockers). **Remaining manual step**: still bump the baked-in fallback timestamp constant in
  both HTML files on any push that changes JS/CSS/HTML, so a visitor with empty localStorage gets the
  right baseline; propagation to existing visitors after that is automatic via Flush Cache.
- All site "settings" that aren't simple product columns (SKUs, brands, multi-category assignments,
  ignored stock alerts, per-product keywords/variants, hidden-price flags, qty limits, banner list,
  site-disabled flag, SEO text, asset version) live in the generic `expert_settings` key/value table in
  Supabase — nothing requires manual SQL; every feature reads/writes it via the REST API directly.

## 3) Active files
**Storefront (root):**
- `index.html` — main page markup (header, categories grid, offers, products, cart, checkout, footer,
  SEO meta tags + JSON-LD, category-switch loading overlay, dynamic CSS/JS loader)
- `js/01-config-data.js` — Supabase config, `loadSBData()` (main data fetch incl. photos + variants),
  SKU/brand/keyword/price-hidden/qty-limit/variant maps, `checkAssetVersion()`, site-disabled check
- `js/02-catalog-render.js` — category/offer rendering, product card rendering (incl. card-level variant
  dropdown), banners, search matching + `_didYouMean()` suggestions, `_injectProductSchema()` (JSON-LD),
  `_switchCategoryWithLoading()` (loading-flash category switch), multi-category helper
- `js/03-product-cart-checkout.js` — product detail modal (incl. visual variant tile picker via
  `pmSelectVariant`/`_pmApplyVariantDisplay`), cart (variant-aware lines), checkout, qty limit enforcement
- `js/04-i18n-order.js`, `js/05-accounts.js`, `js/06-features.js` — translations/RTL, customer accounts,
  wishlist/reviews/WhatsApp share/recently-viewed + final bootstrap calls (`renderProducts(); loadSBData();`)
- `css/01-base.css` … `css/09-widgets.css` — styles, split by topic
- `robots.txt`, `sitemap.xml` — SEO crawl config

**Admin (`admin/`):**
- `admin/index.html` — all admin markup + every modal (Add Product, CSV import, Photo, Stats, SEO, Qty
  Limits, Options/variants, Category Products, Team Account, Edit Banner). Has `<base href="../">` so all
  relative asset paths resolve to the repo root, not `admin/`.
- `admin/js/01-core-data.js` — Supabase config (duplicated from storefront), `DEFAULT_CATS`,
  `getAllAdminProducts()`, `loadFromSupabase()` (Promise.all fetch incl. variants)
- `admin/js/03-auth.js` — login, team-account permission enforcement, `flushCache()` (global flush),
  `toggleSiteDisabled()`
- `admin/js/05-categories.js` — category background image editor, banner management
- `admin/js/07-orders.js` — Orders tab, Inventory table rendering (row actions), stats/alerts, ignore-alert,
  price-hide toggle
- `admin/js/08-inventory.js` — SKU helpers, Add Product, qty-limit modal, **Options editor**
  (`openVariants`/`addVariantRow`/`moveVariantRow`/`saveVariants` — reorder arrows, per-option
  image/description/SKU, Upload-from-Computer, safe read-fresh-merge-write save)
- `admin/js/10-csv-import.js` — CSV/Excel bulk import (custom CSV parser handling quoted names with
  commas/quotes)
- `admin/js/11-multiselect-brand-cat.js` — multi-category picker, photo/crop editor, brand-menu bulk
  actions (`_bulkConfirmIfLarge` guards +50/+5000 stock once a selection exceeds 5 products)
- `admin/js/12-seo.js` — site-wide SEO settings + per-product SEO editor + `renderSEOProducts()`
  (searchable product list in the SEO tab)

**Data/reference:**
- `expert-hardware-supabase.sql` — full schema for a fresh Supabase project (all `expert_*` tables +
  RLS policies). Only needed if the project is ever recreated from scratch.
- `expert products/*/expert_import_*.csv` — record-keeping copies of what was imported; **not** meant
  to be re-imported (would create duplicates).
- `cat-images/` — the 17 category tile background images.

## 4) Changes made (chronological highlights)
- Split originally-monolithic files into the per-topic files listed above.
- Rebuilt "Shop by Category" as 17 real Expert-Hardware categories with real category images and rotating
  vertical side banners (brand-aware, up/down nav, adaptive sizing, 3s rotation), manageable from admin.
- Migrated Supabase project (new URL/key); built a full team-account permission system.
- Scraped and imported products in three batches: 1–100, 101–200 (96 real + 4 service placeholders), then
  201–300 (nails/wires, tapes, fasteners, gloves, welding electrodes), with images, verified brands, SKUs,
  hand-written SEO copy, and — for 201–300 — real per-product size/pack options where the source had them.
- Built full SEO: site meta tags + JSON-LD, per-product descriptions/keywords, admin UI for all of it,
  later extended with a full product list inside the SEO tab itself.
- Added category/brand filters and a "Products" manager per category; multi-category support synced to
  Supabase (was localStorage-only, invisible to visitors).
- Added Hide Price / Show Price toggle and per-product min/max order quantity limits.
- Built the **size/pack options ("variants") feature** end to end: data model, storefront card dropdown,
  storefront product-popup visual tile picker, admin editor with reordering and per-option
  image/description/SKU, variant-aware cart lines and order/WhatsApp text.
- Rebuilt cache-busting into a real global flush: asset version lives in Supabase, every page background-
  checks it and self-updates; Flush Cache bumps it for everyone instead of just the admin's own browser.
- Added "Did you mean...?" search suggestions and hid the "Generic" brand from Google's structured data.
- Reworked the product detail modal layout (SKU next to the name, Back to Products button aligned with
  the image) and added a brief loading flash on category switches instead of a visible instant scroll.
- Decluttered the Inventory table's action buttons and widened the admin layout so they stop clipping off
  wide-monitor screens; added a confirmation prompt to bulk stock actions once a selection is large.

## 5) Failed attempts / bugs found and fixed
- **Category images pointed one directory too high** (`../cat-images/...`) — broke because
  `admin/index.html` already has `<base href="../">`. Fixed by removing it.
- **`expert_photos` column name mismatch** (`url` vs real column `img_url`) — every photo save had been
  silently failing (HTTP 400) since the table was created. Fixed all 6 read/write sites.
- **Base64 images duplicated into `expert_products.img_url`** as a side effect of the bug above, bloating
  a single fetch to 3.2MB / 46–71s on Supabase's free tier. Fixed by migrating to lightweight
  `expert_photos` URL rows.
- **Removing the 60 demo products broke three things** still reading the now-empty hardcoded `PRODUCTS`
  array (stat cards, Analytics, per-product Stats modal). All three now read `getAllAdminProducts()`.
- **Random stock-photo fallback (`picsum.photos`)** made missing images look like wrong products.
  Replaced with a neutral tools icon everywhere.
- **CSV import parser broke on product names containing `"`** (e.g. `6" pliers`), silently dropping those
  rows. Rewrote the parser to handle quoted CSV fields properly.
- **`document.write` cache-busting loader silently broke styling** for visitors with ad-block/privacy
  extensions (Chrome interventions and several extensions neuter `document.write` entirely) — the whole
  site rendered as raw unstyled HTML for affected visitors, caught live on the admin panel. Fixed by
  switching the loader to `createElement`/`appendChild` DOM APIs, with `<noscript>` stylesheet fallbacks.
- **`saveVariants()` overwrote the entire `product_variants` blob from whatever was in the browser's
  memory**, not the live database — a stale in-memory copy (e.g. from an earlier action in the same
  session) could silently erase *other* products' options on save. This actually happened: one product
  lost 3 of its 4 options, another was overwritten with test data during verification. Reconstructed both
  from historical records where available, and fixed the function to re-fetch fresh from Supabase and
  merge in only the one product being edited, immediately before every save.
- **Admin inventory action buttons were getting clipped** off wide-monitor screens — the layout was
  capped at 1400px and the table wrapper used `overflow:hidden`, silently hiding the rightmost buttons
  (Hide Price / Delete) instead of scrolling to them. Widened the cap and switched to `overflow-x:auto`.
- **Mobile product-modal layout broke** (Back button collapsed into a vertical one-letter-per-line
  sliver) because `.pm-info-col`'s `grid-column:2` wasn't reset in the mobile media query, so the grid
  implicitly created a second column even with `grid-template-columns:1fr` explicitly set. Fixed by
  resetting `grid-column:1` on mobile.
- **Bulk "+50/+5000 Stock" had no confirmation**, unlike Clear Stock and Delete — combined with the brand
  menu's "select all" (which can silently select 70+ products), one click could mass-restock an entire
  brand with zero warning. Added a confirmation once a selection exceeds 5 products.
- **GitHub Pages deployment lag/stuck builds** happened repeatedly across sessions (confirmed via the
  Actions API showing no build run at all for a given push, not just slow) — fixed each time with an
  empty trigger commit. The Supabase-driven asset-version flush should prevent the *symptom* (stale files
  after a real deploy) from mattering as much, but a stuck GitHub Pages build itself is outside anyone's
  control.
- **User corrections on approach** (kept for context): initially misread "remove the banner/hero" as the
  About section; initially removed the category grid entirely instead of adding banners alongside it.
  Both corrected immediately once clarified.

## 6) Next steps (not yet done / explicitly deferred)
- **Products 301+**: not yet scraped; no explicit ask yet for a further batch.
- **Google Search Console "Missing field image" validation**: the root cause (photos loading in a second,
  delayed pass) is fixed and every product now has a complete image in its structured data from the first
  render — but Google needs to *recrawl* before this shows as fixed in Search Console. Once it does,
  re-run "Validate Fix" on that issue. The "Improve item appearance" recommendations (return policy,
  shipping details) are optional and were not actioned — only worth doing if the owner wants richer
  Google Shopping-style listings, not because anything is currently broken.
- **Security issue flagged but not fixed (owner has not said yes)**: admin passwords are stored in
  plaintext (hardcoded JS constants and the `expert_admin_accounts` table), and Supabase RLS is fully
  permissive (`using (true) with check (true)`), meaning anyone with the public anon key could read them.
  Offered to fix for free; no response yet.
- **Supabase free-tier cold starts**: occasional first-request-after-idle delays (up to ~60s) are a
  platform limitation, not a code bug. Only real fix is upgrading off the free tier — discussed, not
  actioned.
- **Ongoing discipline**: bump the baked-in `?v=` fallback timestamp constant in `index.html` and
  `admin/index.html` on every push that touches JS/CSS/HTML (existing visitors now self-update via Flush
  Cache regardless, but a brand-new visitor with empty localStorage needs the fallback to be current).
