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

**Important operational note**: multiple Claude Code sessions (and a GitHub Action, see section 2) are
routinely working on this exact repo at the same time, sometimes concurrently with this one. `git status`/
`git fetch` before every push, expect divergence, and verify byte-for-byte identical content before
discarding any "conflicting" untracked file rather than assuming — this has been the actual cause of every
merge conflict hit so far, not real disagreements.

## 2) Current state
- **721 products** live in `expert_products` (verified via a live count query, not the stale "300" figure
  from earlier in the project). Products keep arriving in batches (300–350, 350–400, ..., up to 500–550
  seen so far) from ongoing scraping work, each with a real name, price (KWD), category, verified brand,
  SKU, and images. All product ids are sequential in `expert_products` (identity column, `start with
  100000`) — see the id-sequence fix below.
- **Featured Products (homepage scrolling strip)**: admin-curated via its own **Featured** tab (thumbnail,
  name, SKU, brand, price, description; category/brand filters; a real Select All ⇄ Unselect All toggle;
  bulk Sale % apply/clear; its own tab-aware Undo/Redo). Stored in `expert_settings.featured_offers` as
  `{ id, sale }[]`. **Still not actually curated**: it holds the whole catalog from an early accidental
  Select All, and the owner chose to leave it that way rather than re-curate — unchanged since last check.
- **Sale % is a real, site-wide discount** via `getFeaturedSale()`/`applySale()` (`js/01-config-data.js`),
  applied everywhere a price is shown or charged (grid card, product modal, cart, wishlist, recently
  viewed), including at add-to-cart time so the charged price matches what was displayed.
- **Size/pack options ("variants")**: any product can carry priced/imaged sub-options; storefront shows
  them as a card dropdown and product-popup image tiles; admin edits them with drag-and-drop reordering.
- **Sort dropdown** on the product grid: Recommended (default — existing badge-priority order, unchanged),
  Price Low→High / High→Low (sale-aware, price-hidden items pushed to the end), Newest (id descending —
  ids were assigned in strictly increasing order across every batch, so this is an accurate proxy without
  a real timestamp field), Name A→Z / Z→A.
- **Header search** (desktop) is an inline expanding dropdown anchored under the search icon — typing
  mirrors into the real `#searchInput` and reuses its existing live-filter listener. Replaced an earlier
  version that scrolled the whole page down to the product grid's own search box, which read as
  disorienting and was corrected on direct feedback.
- **Skeleton shimmer** on product/offer-strip images while they load — pure CSS gradient animation, zero
  added network requests or JS libraries; fades to the real photo via a class the `<img>`'s own `onload`
  adds. Handles "no photo at all" and "image ultimately failed" so the shimmer never runs forever.
- **Cart FAB and WhatsApp chat FAB** are now a matched pair — same circle size at each breakpoint (mobile:
  60px tall circles; desktop: matched padding/icon size), cart's count badge moved to an absolute overlay
  on the circle's corner instead of an inline flex child (so it doesn't stretch the circle into an oval).
  WhatsApp moved from `bottom:82px;right:14px` to `bottom:18px;right:10px` on mobile — it was floating
  well above the actual corner before.
- **The "View details →" product-card link is visually hidden** (`display:none`) but deliberately still in
  the DOM — it's a real crawlable link to the per-product SEO pages (see below), not decorative; removing
  it outright would cut off an easy path for Google to discover those pages.
- Checkout: guests get a **Sign In / Continue as Guest choice** immediately when opening checkout, instead
  of the old post-order "Create free account" nudge (which showed up only after the order was already
  sent, too late to matter). Signed-in customers skip straight to the pre-filled form.
- **Email**: signup/password-reset emails now send via **Resend custom SMTP** (`smtp.resend.com`, sender
  `muk@expertshardware.com`, domain verified) instead of Supabase's low-volume, unreliable-for-production
  default sender. Also fixed: `authSignUp()` wasn't passing `redirect_to`, so every confirmation link
  pointed at `localhost` instead of the live site — no customer could actually complete signup confirmation
  until this was fixed.
- **RLS hardened** (`expert-hardware-rls-hardening.sql`, applied 2026-07-18): closed a real IDOR on
  `expert_orders` (a signed-in customer could previously read/edit *any* order by id, not just their own —
  now scoped via `auth.uid() = user_id` for the `authenticated` role), removed unused anon
  `INSERT`/`DELETE` on `expert_analytics` (only the now-`security definer` `increment_expert_analytics` RPC
  writes) and unused `UPDATE`/`DELETE` on `expert_reviews`/`expert_settings`. **Structural limit, not
  fixed**: the admin panel and every public visitor still share the exact same public anon API key (no
  real admin login), so RLS cannot restrict admin-only writes on `expert_products`/`expert_stock`/etc.
  without a real admin auth system — explicitly declined for now ("dont do supabase auth"). Admin passwords
  remain plaintext and technically anon-key-readable. Accepted residual risk, unchanged from before.
- **`expert_products.id` identity-sequence desync fixed** (`expert-hardware-fix-id-sequence.sql`) — the
  sequence backing the id column had fallen behind because earlier batches were inserted with explicit ids
  rather than letting it auto-generate, so the admin CSV importer was silently failing on new rows
  (23505 unique violation). One `setval()` run in the Supabase SQL Editor fixed it permanently; verified
  live (`setval` returned `100320`, matching the last manually-assigned id at the time).
- **Google Sign-In was added** (by concurrent work, not this session) — `authGoogleSignIn()` in
  `js/05-accounts.js`, redirects through Supabase's `/auth/v1/authorize?provider=google`. **Not fully
  usable by real customers yet**: the Google Cloud OAuth app is still in **Testing** publishing status
  (unverified), which caps sign-in to ~100 manually-allowlisted test accounts and shows the raw Supabase
  domain (`qhebhvllkovfbkqrcnmm.supabase.co`) instead of "Expert Hardware" branding on the initial "Choose
  an account" screen — confirmed via a live web search that this is standard Google behavior for
  unverified apps, not a config bug. App name/support email/logo/authorized domains are already correctly
  set in Google Cloud Branding. Blocked on: publishing to Production, and a separate "home page URL is not
  registered to you" branding-verification error despite Search Console showing the URL-prefix property
  verified under the same account — root cause not yet found (see section 5/6).
- **Per-product SEO pages**: `scripts/generate-product-pages.js` + a GitHub Action
  (`.github/workflows/generate-seo.yml`, `chore(seo): regenerate product pages + sitemap [skip ci]`)
  auto-generates a static `product/<slug>-<id>.html` page per product and regenerates `sitemap.xml`,
  committing straight back to `main`. This is the actual source of most of the git-divergence noise in
  section 1 — it runs independently of any Claude Code session. 521 generated pages as of the last check.
- **Email campaign system was added** (concurrent work): `admin/js/13-offers.js` (Offers admin tab —
  compose/send/status), `supabase/functions/send-offers/index.ts` (Resend-backed sender, RFC-8058
  one-click unsubscribe headers), `supabase/functions/unsubscribe/index.ts`, schema in
  `expert-hardware-offers.sql` (`offer_campaigns`, `offer_subscribers`), storefront opt-in widget in
  `js/07-subscribe.js`. Not deeply exercised/verified by this session — flagged for whoever picks this up
  next to sanity-check before relying on it.
- **T&C / Privacy**: `terms.html` (Terms + Privacy + marketing-consent in one document, not separate
  pages) now has a `#privacy` anchor on its "Privacy and your data" section, added so Google's OAuth
  consent-screen setup had a real privacy-policy URL to point at.
- **A code-only knowledge graph exists** at `graphify-out/` (via `/graphify`), scoped to the 28 real
  source files (`js/`, `admin/js/`, `supabase/functions/`, root SQL/config, `scripts/`) — deliberately
  excludes the 500+ generated product pages and all images/CSVs, which would've dominated a full-corpus
  graph with repetitive template content instead of real architecture. `graph.html` to explore visually,
  `GRAPH_REPORT.md` for the audit trail. Purely informational, no code changes from running it.
- Everything else from before is unchanged: admin panel tabs (Inventory, Analytics, Deleted, Orders,
  Reports, Categories, Banners, Featured, SEO, Owner Controls), three built-in accounts + Team Accounts,
  site-wide SEO meta/JSON-LD, Lighthouse accessibility pass, "Did you mean...?" search suggestions,
  two-layered cache-busting (see section 6 for the standing workflow), and the generic `expert_settings`
  key/value store for all non-column site settings.

## 3) Active files
**Storefront (root):**
- `index.html` — main page markup, header (incl. inline search dropdown), SEO meta/JSON-LD, dynamic
  CSS/JS loader with the cache-busting fallback timestamp
- `js/01-config-data.js` — Supabase config, `loadSBData()`, `getFeaturedSale()`/`applySale()`,
  `checkAssetVersion()`
- `js/02-catalog-render.js` — category/offer rendering, product card rendering, search matching + sort
  (`currentSort`/`onSortChange`/`_sortProducts`), skeleton-shimmer `onload`/`onerror` wiring
- `js/03-product-cart-checkout.js` — product detail modal, cart, checkout incl. the Sign In/Guest choice
  (`toggleHeaderSearch` lives in 06, not here — see below)
- `js/04-i18n-order.js` — translations/RTL, order submission to Supabase
- `js/05-accounts.js` — customer accounts, `authSignUp`/`authSignIn`/`authGoogleSignIn`, password reset
- `js/06-features.js` — wishlist/reviews/WhatsApp share/recently-viewed, `?q=` search-param handling,
  header search dropdown (`toggleHeaderSearch`/`onHeaderSearchInput`), final bootstrap calls
- `js/07-subscribe.js` — newsletter/offers opt-in widget
- `css/01-base.css` … `css/09-widgets.css` — styles by topic; header search dropdown, cart/chat FAB, and
  skeleton-shimmer rules live in `01-base.css`, `08-account-auth.css`, and `02-sections.css` respectively
- `robots.txt`, `sitemap.xml` — SEO crawl config; `sitemap.xml` is now auto-regenerated by the GitHub
  Action, don't hand-edit it
- `terms.html` — Terms + Privacy + marketing consent, one document (`#privacy` anchor added)
- `product/*.html` — **auto-generated**, one per product, via `scripts/generate-product-pages.js` +
  the `generate-seo` GitHub Action. Don't hand-edit; regenerates on every relevant push.

**Admin (`admin/`):**
- `admin/index.html` — all admin markup + modals, incl. the Featured tab and Offers tab
- `admin/js/01-core-data.js` — Supabase config, `getAllAdminProducts()`, `loadFromSupabase()`
- `admin/js/02-helpers.js` — stock undo/redo, tab-aware Ctrl+Z/Ctrl+Y dispatch
- `admin/js/03-auth.js` — login (client-side only, no real Supabase Auth — see RLS note in section 2),
  team-account permission enforcement, `flushCache()`, `toggleSiteDisabled()`
- `admin/js/04-tabs-nav.js` — tab switching
- `admin/js/05-categories.js` — category backgrounds, banner management, the whole Featured tab
- `admin/js/06-reports.js` — Excel export (inventory/sales workbooks), file-handle persistence
- `admin/js/07-orders.js` — Orders tab, Inventory table rendering, stats/alerts
- `admin/js/08-inventory.js` — SKU helpers, Add Product, Options/variants editor
- `admin/js/09-deleted.js` — Deleted Products/Orders tab, CSV-based bulk restore
- `admin/js/10-csv-import.js` — CSV/Excel bulk import
- `admin/js/11-multiselect-brand-cat.js` — multi-category picker, photo/crop editor, brand-menu bulk actions
- `admin/js/12-seo.js` — site-wide + per-product SEO editor
- `admin/js/13-offers.js` — Offers/email-campaign admin tab

**Backend:**
- `supabase/functions/send-offers/index.ts` — Resend-backed campaign sender, one-click unsubscribe headers
- `supabase/functions/unsubscribe/index.ts` — unsubscribe landing/handler
- `expert-hardware-supabase.sql` — full schema for a fresh Supabase project. Only needed from scratch.
- `expert-hardware-offers.sql` — `offer_campaigns`/`offer_subscribers` schema
- `expert-hardware-rls-hardening.sql` — RLS tightening migration (see section 2), run once already
- `expert-hardware-fix-id-sequence.sql` — one-time identity-sequence fix, run once already

**Data/reference:**
- `expert products/*/expert_import_*.csv` — record-keeping copies of imports; not meant to be re-imported
- `cat-images/` — category tile background images
- `.github/workflows/generate-seo.yml` — the auto product-page/sitemap regeneration Action
- `scripts/generate-product-pages.js` — the generator the Action runs
- `graphify-out/` — code-architecture knowledge graph (see section 2), informational, not site output

## 4) Changes made
*(Earlier history — category/banner rebuild, Supabase migration, product batches 1–300, full SEO/JSON-LD
build, size/pack variants, cache-busting rebuild, Featured Products system, Lighthouse accessibility pass —
unchanged, see git history for full detail. This session's changes:)*
- Hardened Supabase RLS across `expert_*` tables (closed a real order-IDOR, removed unused write grants on
  analytics/reviews/settings) — `expert-hardware-rls-hardening.sql`.
- Fixed the `expert_products.id` identity-sequence desync that was silently breaking CSV import on new
  rows — `expert-hardware-fix-id-sequence.sql`.
- Replaced the post-order "Create Account" nudge with a Sign In / Continue as Guest choice shown
  immediately when checkout opens.
- Fixed signup confirmation emails linking to `localhost` instead of the live site (missing `redirect_to`).
- Set up Resend custom SMTP for auth emails, replacing Supabase's unreliable default sender.
- Added a desktop header search icon, later reworked into an inline expanding dropdown (see section 5 for
  why the first version was replaced).
- Added a sort dropdown to the product grid (Recommended default, Price asc/desc, Newest, Name asc/desc).
- Added a CSS-only skeleton shimmer to product/offer card images while they load.
- Hid the "View details" product-card link visually while keeping it in the DOM for SEO crawlability.
- Enlarged, then reshaped, the cart FAB to match the WhatsApp chat FAB's size/circle shape at every
  breakpoint; repositioned WhatsApp into its actual corner.
- Closed the ~176px empty gap left in the categories/products section after another session removed the
  sticky category-icon nav strip, by trimming `#categories`'s bottom padding and `#products`'s top padding
  (they'd previously matched, so removing what sat between them doubled the visible gap).
- Added an Instagram `sameAs` entity link to the `HardwareStore` JSON-LD, for Google's brand-identity
  signals.
- Added a `#privacy` anchor to `terms.html`'s Privacy section, for the Google OAuth consent-screen setup.
- Resolved two real git merge conflicts from concurrent product-batch work landing mid-session — both were
  identical-content ("both added") conflicts, verified byte-for-byte before resolving.
- Built a code-only knowledge graph (`/graphify`) scoped to the 28 real source files.

## 5) Failed attempts
*(Earlier history retained — see prior version of this file / git log for the full pre-session list:
category image path bug, `expert_photos` column mismatch, base64 image bloat, demo-product removal
breaking three admin views, random stock-photo fallback, CSV parser breaking on quoted names,
`document.write` cache-busting breaking under ad-blockers, `saveVariants()` overwriting other products'
options, clipped inventory buttons, mobile product-modal layout break, unconfirmed bulk stock actions,
GitHub Pages deployment lag, Select All behavior iterations, sale % gap outside the offers strip, invisible
bulk-bar text + forced-dark-mode contrast. This session adds:)*
- **Header search icon originally just scrolled the page down to the product grid's own search box and
  focused it** — flagged directly as disorienting ("not take me above to the search bar"). Replaced with
  an inline dropdown anchored in the header itself; typing mirrors into the real search input with zero
  page scroll.
- **Cart button sizing went through several iterations** (bigger → bigger again → narrower-but-taller →
  finally a true circle matching WhatsApp's exact size) before landing on the final design — each round
  was a direct, specific correction ("nope it's not same size," "make it 4x bigger" tempered to avoid
  mobile overflow, then "same circle type just like whatsapp").
- **Repeated `.git/index.lock` contention** from GitHub Desktop and/or other concurrent sessions touching
  this same working directory at the same time as this one. Resolved each time by confirming no live
  `git.exe` process was actually holding the lock (checked age + 0-byte size) before removing it — never
  force-removed a lock without that check.
- **Two real "both added" merge conflicts** on product-batch CSV files, from the `generate-seo` GitHub
  Action / another session pushing the same product batch independently. Verified line-for-line identical
  content on both sides before resolving (not a real disagreement to adjudicate).
- **Google OAuth "Choose an account" screen still shows the raw Supabase domain instead of "Expert
  Hardware"** despite branding (App name, logo, support email) being correctly set — traced via a live web
  search to Google's standard behavior for apps still in unverified **Testing** publishing status, not a
  config bug. Real fix is publishing to Production (see section 6).
- **`sitemap.xml` showed "Couldn't fetch" in Search Console** despite the file being valid XML, reachable
  (200 OK), correctly typed, robots.txt-correct, and fetchable even under Googlebot's own user-agent string
  (tested directly). Concluded to be a Google-side processing-timing issue, not a real technical problem —
  confirmed via the separate URL Inspection tool that (correctly) doesn't apply to sitemap files at all
  (that mistake is noted so it isn't repeated: URL Inspection checks page-indexing status, not sitemap
  fetchability, they're different Google systems).
- **Google Cloud OAuth Branding verification says "the website of your home page URL is not registered to
  you"** even though Search Console shows that exact URL-prefix property verified under the same Google
  account — root cause not found yet (property-type mismatch suspected: URL-prefix vs. Domain property
  scoping, since `robots.txt Report`/`Crawl Stats` are confirmed unavailable for this property type,
  though that's a separate, expected limitation, not proven to be the same cause). Open item.

## 6) Next steps
- **Google OAuth app is still in Testing publishing status** — real customers cannot use "Sign in with
  Google" at all right now (capped at ~100 manually-allowlisted test accounts). Needs publishing to
  Production via Google Auth Platform → Audience. Since only basic (non-sensitive) scopes are requested,
  this likely doesn't need Google's full manual review, but hasn't been done yet.
- **Google Cloud Branding verification blocker** ("home page URL not registered to you") is still
  unresolved — worth a fresh look with Google's current docs/support before assuming it's the property-type
  mismatch theory above.
- **`sitemap.xml` "Couldn't fetch" status** — recheck the Sitemaps page (not URL Inspection) after it's had
  a day or two; if it's still failing with no other error after that, that would be genuinely unusual and
  worth escalating, but there was no actionable fix found as of this session.
- **Featured Products still isn't actually curated** (holds the full catalog) — unchanged, owner's explicit
  choice to leave as-is for now.
- **Admin auth is still plaintext/anon-key-shared** — unchanged, accepted residual risk since a real fix
  needs Supabase Auth for admin, which was explicitly declined this round.
- **Email campaign system (admin/js/13-offers.js + the two edge functions) hasn't been deeply exercised**
  by this session — worth a real test send before relying on it for actual customer communication.
- **Products keep arriving in batches from ongoing scraping/import work** (300+ new products added just
  during this session) — expect the live count in section 2 to already be stale by the time this is read;
  re-verify with a live count query rather than trusting the written number.
- **Concurrent work on this repo is the norm, not the exception** — the `generate-seo` GitHub Action alone
  pushes commits independently of any Claude Code session. Always `git fetch` before pushing, and verify
  file content (not just filenames) before treating anything as a real conflict.
- **Lighthouse performance items** (unused CSS/JS reduction, cache-control headers, minification) — still
  not attempted, still hard to do safely without introducing a build step this site intentionally doesn't
  have.
- **`hasMerchantReturnPolicy`/shipping-cost structured data** — still deliberately not added, would mean
  asserting unconfirmed policy details.
- **Standing workflow, still in effect**: bump the baked-in `?v=` fallback timestamp in `index.html` (only
  one occurrence is load-bearing now — confirm both instances if `admin/index.html` also loads CSS/JS via
  the same versioned pattern), commit, push, and flush the Supabase cache on every change that touches
  JS/CSS/HTML — pre-authorized, no need to ask before doing it each time.
