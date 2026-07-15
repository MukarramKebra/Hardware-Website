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
- **Featured Products (homepage scrolling strip)**: what used to be 8 hardcoded category tiles is now a
  real, admin-curated product showcase. Admin's own **Featured** tab (full-width table, not a modal —
  reads like Inventory: thumbnail, name, SKU, brand, price, description) lets the owner tick any number of
  products (no cap) to feature, with category/brand filters, a Select All/Unselect All toggle (button
  label and header checkbox both flip to show which action a click performs next — it's a real toggle,
  not select-only), a bulk Sale % bar (search/filter a group → Select All → apply one % to all of them at
  once), and its own Undo/Redo (Ctrl+Z/Ctrl+Y, tab-aware so it doesn't fire Inventory's stock undo at the
  same time). Order picked = display order on the storefront, except products with an active sale sort
  first (stable sort, so ties keep pick order). Stored in `expert_settings` key `featured_offers` as a
  JSON array of `{ id, sale }` (older saves were a plain id array — migrated in-memory on load).
  **Current live data**: the owner accidentally featured the entire 300-product catalog via Select All
  before it was a proper toggle, and chose to leave it that way rather than re-curate — see section 6.
- **Sale % is a real, site-wide discount**, not just a strip decoration: `getFeaturedSale()`/`applySale()`
  (`js/01-config-data.js`) are the single source of truth, used by the offers strip, the main product grid
  card, the product detail modal, Add to Cart (both the card and modal paths — the cart line is charged the
  discounted price), wishlist, recently viewed, and "Customers Also Bought". Regular price shows struck
  through with the discounted price first wherever there's room; a red `-X%` badge replaces the product's
  own badge on the grid card when a sale is active.
- **Size/pack options ("variants")**: any product can carry a list of options (e.g. 2" vs 3" nails, a
  tarpaulin's 24 different sizes), each with its own optional price/SKU/image/description — anything left
  blank falls back to the product's own. Storefront shows options as a dropdown directly on the product
  card (price updates live, sale-aware) and as clickable image tiles in the product popup (replacing a
  plain `<select>`); whichever option is picked becomes its own cart line, sharing the parent product's
  stock pool and qty limits. Admin edits options per product (Inventory row → Options) with **drag-and-drop
  reordering** (grab a handle, drop it where you want — replaced the old up/down chevron buttons), an
  Upload-from-Computer button per option's image field, and duplicates the parent's own image/description
  into new option rows as a starting point. Stored in `expert_settings` key `product_variants`.
- Product images live as files in the repo (`expert products/1-50/` … `251-300/`, named by SKU) and are
  referenced from Supabase's `expert_photos` table by **URL**, not inline base64. Photos are fetched in
  the *same* batched request as the rest of product data (not a separate delayed fetch — that split only
  mattered when photos carried base64 blobs; now they're lightweight URL strings, ~25KB total).
- Admin panel tabs: Inventory, Analytics, Deleted, Orders, Reports, Categories, Banners, **Featured**, SEO,
  and Owner Controls (ultimate15 only). Three built-in accounts (`expert`/admin, `expert15`/manager,
  `ultimate15`/owner) plus a Team Accounts system for restricted logins with per-tab view/edit permissions.
- **SEO**: site-wide meta title/description/keywords editable in admin (SEO tab), which also lists every
  product (thumbnail, category, description preview with a "Missing" flag, keyword count, Edit button).
  Full JSON-LD structured data: `HardwareStore`, a `WebSite`/`SearchAction` (Google sitelinks search box —
  backed by real `?q=` handling in `js/06-features.js`, not decorative markup), and a dynamic Product
  `ItemList` that now also carries real `aggregateRating` (bulk-fetched from `expert_reviews`, omitted
  entirely — never fabricated — when a product has no reviews yet), `priceValidUntil`, and `itemCondition`.
  "Generic"-branded products omit the `brand` field entirely rather than literally telling Google the
  brand is "Generic". `hreflang` (en/ar/x-default) reflects the site's real bilingual toggle. robots.txt +
  sitemap.xml in place; Google Search Console verified.
- **Accessibility**: a Lighthouse audit (81/62/96/100 desktop, 66/62/96/100 mobile) drove a pass that
  raised the Accessibility score from 62 — added the page's one missing `<h1>` and a `<main>` landmark,
  fixed a heading-order skip (footer nav went straight from h2 to h4), removed the
  `maximum-scale`/`user-scalable=no` viewport flags that disabled pinch-zoom, added `aria-label` to every
  icon-only button/link, associated every form `<label>` with its control via `for`/`id`, and raised
  several low-contrast grays (~2–3:1) to a passing ~4.6:1. Also added `preconnect` hints for the external
  font/icon CDNs and a `color-scheme:light` meta tag (storefront only — see section 5) so forced/auto dark
  mode in some browsers stops re-inverting the site's own already-dark colors.
- **Storefront search** offers "Did you mean...?" suggestions when a query returns nothing — compares each
  typed word (edit distance) against every real word in product names/brands/categories/keywords, only
  surfacing a suggestion that actually returns results. Works in Arabic too.
- **Cache-busting is two-layered**: each JS/CSS file's `?v=` version comes from `localStorage`, falling
  back to a baked-in timestamp constant for a visitor's very first-ever load; a background check compares
  that local version against `expert_settings.asset_version` in Supabase and auto-reloads once if they
  differ. Admin's **Flush Cache** button (Owner Controls) bumps that shared Supabase value, which forces
  *every* visitor onto fresh files on their next page check. The loader itself uses DOM
  `createElement`/`appendChild`, not `document.write` (see section 5 — document.write silently breaks
  under ad-blockers). **Remaining manual step**: still bump the baked-in fallback timestamp constant in
  both HTML files on any push that changes JS/CSS/HTML — now done automatically as part of the standing
  commit/push/flush workflow for this project (see section 6).
- All site "settings" that aren't simple product columns (SKUs, brands, multi-category assignments,
  ignored stock alerts, per-product keywords/variants/featured-sale, hidden-price flags, qty limits,
  banner list, site-disabled flag, SEO text, asset version) live in the generic `expert_settings`
  key/value table in Supabase — nothing requires manual SQL; every feature reads/writes it via the REST
  API directly.

## 3) Active files
**Storefront (root):**
- `index.html` — main page markup (header, `<main>` landmark, `<h1>` (visually hidden), categories grid,
  offers strip, products, cart, checkout, footer, SEO meta tags + JSON-LD incl. `WebSite`/`SearchAction`,
  hreflang, `color-scheme` meta, preconnect hints, category-switch loading overlay, dynamic CSS/JS loader)
- `js/01-config-data.js` — Supabase config, `loadSBData()` (main data fetch incl. photos, variants,
  featured_offers, bulk review stats), SKU/brand/keyword/price-hidden/qty-limit/variant maps,
  `getFeaturedSale()`/`applySale()` (shared sale-price helpers used everywhere), `checkAssetVersion()`,
  site-disabled check
- `js/02-catalog-render.js` — category/offer rendering, product card rendering (incl. card-level variant
  dropdown, `_priceHtml()`/`_cardRawPrice()` for sale was/now display), banners, search matching +
  `_didYouMean()` suggestions, `_injectProductSchema()` (JSON-LD incl. aggregateRating/priceValidUntil),
  `initOffersTicker()` (admin-curated featured strip, sale-first sort), `_switchCategoryWithLoading()`,
  multi-category helper
- `js/03-product-cart-checkout.js` — product detail modal (incl. visual variant tile picker via
  `pmSelectVariant`/`_pmApplyVariantDisplay`, `_pmPriceHtml()` for sale was/now display, side-margin back
  button beside the image), cart (variant- and sale-aware lines — `applySale()` at add-to-cart time so
  charged price matches displayed price), checkout, qty limit enforcement
- `js/04-i18n-order.js`, `js/05-accounts.js`, `js/06-features.js` — translations/RTL, customer accounts,
  wishlist/reviews/WhatsApp share/recently-viewed (sale-aware prices), `?q=` search-param handling (backs
  the SearchAction schema) + final bootstrap calls (`renderProducts(); loadSBData();`)
- `css/01-base.css` … `css/09-widgets.css` — styles, split by topic; incl. `.visually-hidden` utility,
  offer/product sale price + badge classes
- `robots.txt`, `sitemap.xml` — SEO crawl config

**Admin (`admin/`):**
- `admin/index.html` — all admin markup + every modal (Add Product, CSV import, Photo, Stats, SEO, Qty
  Limits, Options/variants, Category Products, Team Account, Edit Banner) + the **Featured** tab section
  (search, category/brand filter dropdowns, Select All, Undo/Redo, bulk Sale % bar, full-width table).
  Has `<base href="../">` so all relative asset paths resolve to the repo root, not `admin/`.
- `admin/js/01-core-data.js` — Supabase config (duplicated from storefront), `DEFAULT_CATS`,
  `getAllAdminProducts()`, `loadFromSupabase()` (Promise.all fetch incl. variants)
- `admin/js/02-helpers.js` — stock undo/redo; the global Ctrl+Z/Ctrl+Y handler is now tab-aware, dispatching
  to Inventory's stock undo or the Featured tab's own undo depending on which is visible
- `admin/js/03-auth.js` — login, team-account permission enforcement, `flushCache()` (global flush),
  `toggleSiteDisabled()`
- `admin/js/05-categories.js` — category background image editor, banner management, **and the whole
  Featured Products tab**: `renderFeaturedTab()`, `foToggle`/`foSetSale`/`foToggleSelectAll`
  (real toggle)/`foApplyBulkSale`/`foClearBulkSale`, its own undo/redo stack (`_foPushUndo`/`foUndo`/
  `foRedo`), category/brand filter dropdowns (`foFcToggle` etc., parallel to Inventory's own so they don't
  collide), `saveFeaturedOffers()`
- `admin/js/07-orders.js` — Orders tab, Inventory table rendering (row actions), stats/alerts, ignore-alert,
  price-hide toggle
- `admin/js/08-inventory.js` — SKU helpers, Add Product, qty-limit modal, **Options editor**
  (`openVariants`/`addVariantRow`/`saveVariants`) with **drag-and-drop reordering** (`_vrWireDrag` — grab a
  handle, drop it above/below another row; replaced the old `moveVariantRow` up/down-arrow approach),
  per-option image/description/SKU, Upload-from-Computer, safe read-fresh-merge-write save
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
  storefront product-popup visual tile picker, admin editor with per-option image/description/SKU,
  variant-aware cart lines and order/WhatsApp text.
- Rebuilt cache-busting into a real global flush: asset version lives in Supabase, every page background-
  checks it and self-updates; Flush Cache bumps it for everyone instead of just the admin's own browser.
- Added "Did you mean...?" search suggestions and hid the "Generic" brand from Google's structured data.
- Reworked the product detail modal layout (SKU next to the name, Back to Products button aligned with
  the image, then a second back button beside the image itself) and added a brief loading flash on
  category switches instead of a visible instant scroll.
- Decluttered the Inventory table's action buttons and widened the admin layout so they stop clipping off
  wide-monitor screens; added a confirmation prompt to bulk stock actions once a selection is large.
- **Turned the homepage offers strip from 8 hardcoded category tiles into a real, admin-curated Featured
  Products system**: its own admin tab (search, category/brand filters, Select All/Unselect All toggle,
  bulk Sale % apply/clear, Undo/Redo), no product-count cap, and a per-product **Sale %** that's a genuine
  site-wide discount applied everywhere a price is shown or charged, with sale items sorting first in the
  strip.
- Converted the product Options/variants reorder control from up/down arrows to drag-and-drop.
- Expanded SEO: hreflang, a real `WebSite`/`SearchAction` schema backed by working `?q=` search-param
  handling, and richer Product schema (aggregateRating from real reviews, priceValidUntil, itemCondition).
- Ran a Lighthouse-driven accessibility/performance/best-practices pass across the whole storefront (see
  section 2 for the full list).

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
  memory**, not the live database — a stale in-memory copy could silently erase *other* products' options
  on save. This actually happened: one product lost 3 of its 4 options, another was overwritten with test
  data during verification. Reconstructed both where possible, and fixed the function to re-fetch fresh
  from Supabase and merge in only the one product being edited, immediately before every save.
- **Admin inventory action buttons were getting clipped** off wide-monitor screens — the layout was
  capped at 1400px and the table wrapper used `overflow:hidden`, silently hiding the rightmost buttons
  (Hide Price / Delete) instead of scrolling to them. Widened the cap and switched to `overflow-x:auto`.
- **Mobile product-modal layout broke** (Back button collapsed into a vertical one-letter-per-line
  sliver) because `.pm-info-col`'s `grid-column:2` wasn't reset in the mobile media query. Fixed by
  resetting `grid-column:1` on mobile.
- **Bulk "+50/+5000 Stock" had no confirmation**, unlike Clear Stock and Delete — combined with the brand
  menu's "select all" (which can silently select 70+ products), one click could mass-restock an entire
  brand with zero warning. Added a confirmation once a selection exceeds 5 products.
- **GitHub Pages deployment lag/stuck builds** happened repeatedly across sessions — fixed each time with
  an empty trigger commit. The Supabase-driven asset-version flush prevents the *symptom* (stale files
  after a real deploy) from mattering as much, but a stuck build itself is outside anyone's control.
- **Select All silently featured the entire 300-product catalog** when clicked with no category/brand/
  search filter narrowing it down first — this is exactly what happened live on the real site (see
  section 6). Went through two behavior iterations per direct feedback: first made it select-only (never
  removes anything, to prevent accidental mass-unfeature), then — per updated instruction — reverted to a
  real toggle: Select All ⇄ Unselect All, with the toolbar button's label and the header checkbox both
  flipping to show which action a click will perform next.
- **Sale % was only ever shown in the homepage offers strip**, not the main product grid, product page,
  cart, wishlist, or recently-viewed — a real gap flagged directly ("sales aren't getting updated here").
  Fixed by extracting shared `getFeaturedSale()`/`applySale()` helpers in `js/01-config-data.js` and
  applying them everywhere a price is displayed or charged, including at add-to-cart time so the charged
  price always matches what was shown.
- **Invisible text on the admin's red bulk-action bar** — `.bulk-sel-count`/`.bulk-btn` used `var(--orange)`
  on a `#d20d17` background (two near-identical reds). Fixed with explicit white text. Separately diagnosed
  a related but distinct bug class: some browsers' forced/auto dark mode re-inverts a page's *own* already-
  dark colors when it hasn't declared a `color-scheme`, muddying contrast further. Added
  `color-scheme:light` to the admin panel to fix this — then reverted that specific admin change at
  explicit request ("reset everything, that was a mistake"). The same `color-scheme:light` fix was later
  re-added, correctly this time, to the **storefront** (`index.html`) during the Lighthouse pass, since
  it's a distinct, requested fix on a different page, not a re-application of the reverted one.
- **User corrections on approach** (kept for context): initially misread "remove the banner/hero" as the
  About section; initially removed the category grid entirely instead of adding banners alongside it.
  Both corrected immediately once clarified.

## 6) Next steps (not yet done / explicitly deferred)
- **Featured Products isn't actually curated right now**: live `featured_offers` currently holds all 300
  products (the full catalog), not a hand-picked homepage set — a consequence of Select All being used
  before it became a real toggle (see section 5). The owner was asked and explicitly chose to leave it
  this way for now rather than re-curate. Revisit if/when a smaller, hand-picked set is wanted.
- **Products 301+**: not yet scraped; no explicit ask yet for a further batch.
- **Google Search Console "Missing field image" validation**: the root cause (photos loading in a second,
  delayed pass) is fixed and every product now has a complete image in its structured data from the first
  render — but Google needs to *recrawl* before this shows as fixed in Search Console. Once it does,
  re-run "Validate Fix" on that issue.
- **Lighthouse performance items not attempted**: reducing unused CSS/JS, long-term cache-control headers,
  and JS/CSS minification are the remaining line items from the audit, but they're hard to do safely on
  GitHub Pages without introducing a build step, which this site intentionally doesn't have (plain
  HTML/CSS/JS, no bundler). Re-run Lighthouse to confirm the Accessibility score improvement landed.
- **`hasMerchantReturnPolicy`/shipping-cost structured data**: deliberately not added — doing so would mean
  asserting a specific return-window day count or shipping fee that hasn't been confirmed with the owner,
  which risks misrepresenting the store's actual policy rather than being a safe technical SEO tweak.
- **Security issue flagged but not fixed (owner has not said yes)**: admin passwords are stored in
  plaintext (hardcoded JS constants and the `expert_admin_accounts` table), and Supabase RLS is fully
  permissive (`using (true) with check (true)`), meaning anyone with the public anon key could read them.
  Offered to fix for free; no response yet.
- **Supabase free-tier cold starts**: occasional first-request-after-idle delays (up to ~60s) are a
  platform limitation, not a code bug. Only real fix is upgrading off the free tier — discussed, not
  actioned.
- **Ongoing discipline**: bump the baked-in `?v=` fallback timestamp constant in `index.html` and
  `admin/index.html`, commit, push, and flush the Supabase cache on every change — this is now a standing,
  pre-authorized workflow for this project (no need to ask before doing it each time).
