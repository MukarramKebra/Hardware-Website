# Expert Hardware Kuwait — Handoff

## 1) Goal
Build and maintain **Expert Hardware** — a Kuwait-based hardware/tools store's public website plus an
admin/inventory panel. It's a plain HTML/CSS/vanilla-JS static site (no build step, no framework) hosted
on **GitHub Pages**, with **Supabase** (Postgres + REST API + Edge Functions) as the backend for products,
stock, orders, photos, email, and all admin-configurable settings.

Live storefront: `https://mukarramkebra.github.io/Hardware-Website/`
Admin panel: `https://mukarramkebra.github.io/Hardware-Website/admin/`
Repo: `MukarramKebra/Hardware-Website`, working copy at `C:\Users\mukke\Desktop\Hardware-Website new`
(a second clone without "new" exists and should be kept in sync via `git reset --hard origin/main`).

A second reference site exists — **`https://expertshardware.com`** (the owner's real, older Magento-based
storefront) — used across sessions as the source of truth for pricing, categories, and subcategories, and
still the origin a large slice of product images are hotlinked from (see section 6 — worth re-hosting).
**A third site, `marhabahardwares.com`, is a competitor's storefront** — a request in an earlier session to
scrape its generator products/images into this catalog was declined (copying a competitor's product photos
and descriptions, even with superficial changes, is a real IP problem, not a gray area like mirroring
`expertshardware.com`). The existing `marhaba` category slug is unrelated to that competitor.

**Important operational note**: multiple Claude Code sessions (and a GitHub Action, see section 2) are
routinely working on this exact repo at the same time. `git status`/`git fetch` before every push, expect
divergence, and verify byte-for-byte identical content before discarding any "conflicting" untracked file
rather than assuming. Real logical merge conflicts (not just identical-content ones) have happened before —
read both sides' logic before resolving rather than picking a side by default.

## 2) Current state
### Most recent session — storefront UI/UX pass (2026-10-11)
Visual/UX-only work on the public storefront; no catalog, admin, or backend changes. All pushed and
live-verified, each push followed by a Supabase cache flush (see section 6 standing workflow).
- **Product detail page (PDP) fully redesigned, desktop + phone, every feature kept.** Rebuilt
  `openProduct()`/`renderRelatedProducts()`/`closeProduct()`/`pmSelectVariant()`/`pmAddToCart()` in
  `code/js/03-product-cart-checkout.js` and the PDP block in `code/css/07-modals.css`: breadcrumb in the
  red top bar (`#pmCrumbs`), sticky product image, price in a highlighted panel, stock pill, SKU chip,
  quantity stepper with min/max hints and disabled-at-limit − / +, Save/Share/Reviews row, 2×2 trust
  tiles, 6-card "Customers Also Bought". Preserved: variants, sale was/now price, price-on-request
  WhatsApp button, out-of-stock, wishlist, qty limits, history/back behaviour. Accessibility added: real
  `<button>` variant tiles (`role=radio`), focus rings, `aria-pressed` on Save, darker-green WhatsApp
  button for contrast, reduced-motion handling; the Save button now updates its own label (was stale).
  The `.pm-action-row` rules moved out of `code/css/09-widgets.css` into `07-modals.css`.
- **Phone PDP is a compact one-frame card**: small photo left, title/SKU/stock/price beside it, quantity
  + Add to Cart underneath, plus a sticky bottom buy bar (`#pmSticky`) that slides in once the inline
  button scrolls away (IntersectionObserver in `openProduct`).
- **Desktop side banners now stay pinned while scrolling.** `.side-banner-slot` (`code/css/02-sections.css`)
  changed from `position:absolute` inside `#categories` to `position:fixed` in the viewport gutters,
  shown via a `.banner-pinned` class toggled by new `_updateBannerPin()` (`code/js/02-catalog-render.js`)
  on scroll: appears once the category section reaches the top (so it no longer overlaps the offers
  carousel), rides along through the products, fades out before the footer. On owner feedback the banner
  was shrunk (`TARGET` 560→380, height capped to `min(vh−56, 680)`) so it reads as a side ad, not a
  full-height wall, and `#categories` top padding was trimmed 88px→28px to remove an empty band above
  "Shop by Category".
- **Header + category-tile polish.** Nav links get an animated underline on hover/focus
  (`code/css/01-base.css`); category tiles get larger/bolder titles, a resting shadow, a stronger
  legibility gradient, and a hover arrow chip (`code/css/02-sections.css`). Offers carousel and the
  keyword marquee were explicitly left unchanged at the owner's request.

- **1,577+ products** live in `expert_products` (re-verify live — this number moves as new batches land,
  ids strictly increasing from `100000`, now past `101580`).
- **Admin panel now has real authentication and authorization — this reverses a prior "permanent decision"
  not to build one.** A security review this session found the previous setup (owner/manager/admin
  passwords as plaintext constants in the public `admin/js/01-core-data.js`, plus RLS granting the public
  anon key full read/write/delete on nearly every operational table) was actively exploitable — not a
  theoretical gap. Full rebuild:
  - The 4 login types (owner `ultimate15`, manager `expert15`, regular admin `expert`, and "Team Accounts"
    from Owner Controls) are now real **Supabase Auth** users. `doLogin()` (`admin/js/03-auth.js`) calls
    `/auth/v1/token?grant_type=password` directly; a synthetic email (`<username>@expert-admin.internal`)
    keeps the login form username-based. Session tokens refresh in the background and restore on reload.
  - New `is_admin(uid)` Postgres helper backs a fresh RLS policy (`authenticated` + `is_admin(auth.uid())`)
    on every write-sensitive table: `expert_products`, `expert_stock`, `expert_photos`, `expert_hidden`,
    `expert_banners`, `expert_cat_bgs`, `expert_settings`. Anon keeps read-only. Verified with raw `curl`
    using only the public key that writes are now rejected while reads and real admin writes still work.
  - `SB_HDRS.Authorization` (one shared object already used by every existing admin write call) is mutated
    in place after login — no per-call-site changes were needed to authenticate ~40 existing write paths.
  - Team account create/update/delete/list now goes through a new `admin-manage-accounts` Edge Function
    (service-role-backed — only the service role can create/delete Supabase Auth users), not written
    directly from the browser. `expert_admin_accounts`/`expert_admin_master` (old plaintext-password tables)
    are dead, RLS-locked with zero policies.
  - The 3 order-management RPCs (`admin_list_orders`, `admin_update_order_status`, `admin_delete_order`)
    check `is_admin(auth.uid())` instead of the `ADMIN_ORDER_TOKEN` that used to sit in plain client JS. Two
    real gotchas hit and fixed along the way, now in `CLAUDE.md`: `create or replace function` with a
    changed parameter list creates a *new* overload rather than replacing the old (possibly-vulnerable) one
    — had to explicitly `drop function` the old token-checking versions; and a newly created function grants
    `EXECUTE` to the `PUBLIC` pseudo-role by default, so `revoke ... from anon` alone didn't stop anon from
    calling it — had to `revoke ... from public` explicitly.
  - The storefront's own checkout stock write goes through a new `decrement_stock` RPC (only ever subtracts,
    still anon-callable since real customers aren't logged in) instead of a direct `expert_stock` write, so
    that table could be locked down without breaking real checkouts.
  - **Not done, flagged as remaining gaps**: `cancel_order`/`get_orders_by_phone` RPCs still have no
    ownership check (anyone can cancel or look up any order by guessing an id/phone — smaller, same family
    of issue, not touched this session). Supabase's "leaked password protection" (HaveIBeenPwned check on
    new/changed passwords) requires a paid plan — this project is on Free, confirmed unavailable via the
    dashboard, not an oversight.
- **Category hide/show now has two levels.** Previously hiding a category only removed its nav pill/tile —
  every product in it stayed fully browsable via All Products, search, and direct links. A new checkbox
  ("Also hide all its products," admin Categories tab, only shown once a category is already hidden) filters
  every product in that category out of the whole storefront — `getAllProducts()` in
  `code/js/01-config-data.js` is the single choke point this hooks into, since every listing/search/product-
  lookup already goes through it. Un-hiding the category restores both together by design (no separate
  "un-hide products only" step). `cat_hidden[slug]` values: `true` (nav only, unchanged from before) or
  `'all'` (nav + products, new). Verified end-to-end against the database, not just the UI: hid a real
  category, confirmed 0 matching products anywhere including search, un-hid it, confirmed all came back.
- **Several smaller storefront fixes**, all pushed and live-verified this session:
  - Custom `404.html` (previously fell through to GitHub's default 404).
  - Fixed a race where clicking a category before `loadSBData()`'s Supabase fetch resolved showed
    "No products found" for a moment before the real catalog painted — `window._catalogReady` flag
    distinguishes "still loading" from "genuinely empty" in `renderProducts()`.
  - Header logo now actually navigates home (`goHome()` in `code/js/02-catalog-render.js`) — previously the
    `<a href="#header">` did nothing, since `#header` is `position: fixed` and has no real scroll-anchor
    position.
  - Removed a full-screen "Sign In" modal that auto-popped 2.5s after any page load for signed-out visitors
    (`code/js/05-accounts.js`) — the auth modal now only opens from explicit user actions.
  - "Loading products…" now shows the same branded rotating gear (`loader-gear.png`) as the initial page
    splash instead of a generic FontAwesome spinner (`.loading-gear` in `code/css/02-sections.css`).
  - Added a 5-question bilingual (EN/AR) FAQ section (delivery, payment, bulk pricing, returns, order
    tracking) between Features and Contact, linked from header + footer nav.
  - Checkout's "Order Sent!" screen is a real order-confirmation now: shows a generated order reference,
    a recap of items + total, and a "Track Order" button that reopens the order tracker pre-filled with the
    phone number just used — instead of a bare thank-you message.
  - Two `Banners/itrust1.jpg`/`itrust4.jpg` side-banner images were unfinished draft exports (one still had
    a raw "1080x1920px" size label baked into the design; the other had garbled AI-generated placeholder
    text) — regenerated both to match the finished style of the other iTrust banners already in rotation.
- Everything from earlier sessions (catalog reconciliation against `expertshardware.com`'s live GraphQL
  catalog, the `cant-find-products` unverified-import category, the 36-subcategory system, admin category
  drag/rename/hide management, the Featured tab's drag-reorder + bulk tools, unified header/grid search with
  Enter-to-results, the offers-ticker load-order fix, the signup offers-opt-in checkbox) is unchanged except
  where noted above/below — see git history / a prior version of this file for full detail if it needs
  re-verifying.
- **Cleaned up 25 genuinely-orphaned product-image batch folders under `expert-products/`** (1,174 files) —
  built an audit script cross-referencing local files against `expert_photos.img_url`/`expert_products.img_url`
  before deleting anything. Correctly excluded `big-red/` and `cat-images/`, which looked identically
  "0 referenced" by the same plain `img_url` check but are actually pulled in via `expert_cat_bgs`
  (base64-embedded images — a different mechanism than a plain `img_url` link).
- **Fixed a live "Generators category shows no products" bug.** Root cause: the critical products fetch in
  `loadSBData()` had zero retry logic, and `window._catalogReady` was set `true` unconditionally regardless of
  whether the fetch actually succeeded — a transient network hiccup on that one fetch silently rendered an
  empty catalog with no error shown. Added `sbFetchAllWithRetry()` (2 retries, 600ms×attempt backoff) plus a
  distinct `window._catalogLoadFailed` state so a real fetch failure now shows a "Couldn't load products —
  Retry" message instead of "No products found" (which implies the catalog is legitimately empty). Confirmed
  the underlying category/data logic itself was not broken (re-verified 45 marhaba products returned correctly)
  before concluding it was fetch reliability, not a data bug.
- **Fixed `ADMIN_SEND_TOKEN` sitting in the admin browser's `localStorage` indefinitely** (Offers/email-campaign
  tab) — every other admin write already goes through a real logged-in Supabase Auth session
  (`is_admin(auth.uid())`); this was the one exception, a shared secret pasted into a form and persisted
  client-side with no expiry. `send-offers`'s non-cron actions now check `is_admin()` the same way every other
  admin write does; the token-paste UI in `admin/index.html` and its save/load code in `admin/js/13-offers.js`
  are gone.
- **Found and fixed a second, real bug while verifying that fix**: `pg_cron`'s hardcoded header token for the
  `send-offers` `run_scheduled` job had drifted out of sync with the `ADMIN_SEND_TOKEN` Edge Function secret
  (most likely an old, undocumented rotation that only updated one side) — scheduled campaign sends had been
  silently failing with 401 for an unknown period. There's no tool in this session that can read or set
  Supabase Edge Function secrets directly, so the fix routes the shared value through a new
  `expert_service_secrets` table instead (RLS-enabled, zero policies — service-role only, same lockdown
  pattern as `expert_admin_master`) that both the cron job definition and the Edge Function read from, so the
  two sides can't drift apart silently again. Verified live via `curl` for both the cron path and the
  admin-session path.
- **Read-only catalog comparison against `expertshardware.com`'s live catalog**, done on request with an
  explicit constraint to not remove anything: no Generators/`marhaba` or Big Red products, and nothing
  unhidden, regardless of findings. Built `scripts/audit-vs-expertshardware.js` (paginates their GraphQL
  `products(filter: {category_id: {eq: "2"}})` query and our `expert_products` table, compares normalized
  names, excludes `big-red`/`marhaba` from the "ours but not theirs" side entirely). Results: 1,012 products on
  their site vs. 1,626 in ours. 521 "ours but not theirs" (excluding big-red/marhaba) — 436 of those are
  already the known `cant-find-products` bucket (nothing new), the other 85 are in active categories
  (`door-handle` 41, `construction` 21, `household` 14, `tools` 5, `hand-tools` 4) and were reported to the
  owner for their own review rather than acted on. Only 3 "theirs but not ours": `OOR-3200` (TDS METER WATER),
  `WATER PUMP 3/4 HP-1`, and a `Test Product 2230` entry that looks like their own placeholder listing rather
  than a real product. No catalog writes were made — purely a report.

## 3) Active files
**UI/UX session (most recent, 2026-10-11) — storefront visual/UX only:**
- `code/js/03-product-cart-checkout.js` — PDP rebuilt (`openProduct`, `renderRelatedProducts`,
  `closeProduct`, `pmSelectVariant`, `pmAddToCart`, new `pmToggleWishlist`, `_pmSyncQty`, `_pmEsc`);
  phone sticky buy bar + IntersectionObserver.
- `code/css/07-modals.css` — PDP styles rebuilt (desktop + phone compact card + `#pmSticky` bar).
- `code/css/09-widgets.css` — old `.pm-action-row` rules removed (moved into `07-modals.css`).
- `code/css/02-sections.css` — `.side-banner-slot` now `position:fixed` + `.banner-pinned`; category-tile
  polish (bigger titles, shadow, hover arrow chip); `#categories` top padding 88→28px.
- `code/js/02-catalog-render.js` — `_updateBannerPin()` + scroll listener; banners pinned to the viewport
  gutters; `TARGET` 560→380; height capped to `min(vh−56, 680)`.
- `code/css/01-base.css` — header nav link animated underline on hover/focus.
- `index.html` — `#pmCrumbs` breadcrumb nav added to the PDP top bar.
- `CLAUDE.md` — new "Standing instructions from the owner" section: never ask to commit/push; flush cache
  after every push via Supabase `execute_sql` bumping `expert_settings.asset_version`.

**New (earlier admin-security session):**
- `scripts/audit-expert-products-images.js` — cross-references local `expert-products/` files against
  `img_url` columns before any folder deletion; not committed (one-off maintenance script, run-and-discard).
- `scripts/audit-vs-expertshardware.js` — read-only catalog comparison vs `expertshardware.com`; not
  committed. Writes `.audit-vs-expertshardware.json` (also not committed).
- `expert_service_secrets` (new table) — `key text primary key, value text not null`, RLS-locked (zero
  policies, service-role only); currently holds one row, `send_offers_cron_token`, read by both the
  `send-offers` Edge Function and the `send-offers-scheduled` cron job.

**From an earlier session (still active/current):**
- `supabase/functions/admin-login/index.ts` — verifies {username, password} server-side (service role) against
  `expert_admin_master`/`expert_admin_accounts`; superseded for the built-in 3 accounts by real Supabase Auth,
  but still deployed/functional, not removed.
- `supabase/functions/admin-manage-accounts/index.ts` — create/update/delete/list for admin accounts
  (service-role-backed, since only it can touch Supabase Auth users); has a one-time `bootstrap` action that
  self-disables once `expert_admin_profiles` has any row.
- `404.html` — self-contained custom 404 page (no dependency on `code/css`/`code/js`).

**Storefront (root):**
- `index.html` — first-line `history.scrollRestoration = 'manual'` (fixes mobile tabs landing at the
  footer on reopen); new FAQ section + nav links; header logo `onclick="goHome(event)"`.
- `code/js/01-config-data.js` — `window._catalogReady` flag; `_catFullyHiddenSlugs` set + `getAllProducts()`
  filter for the new category-hides-products option.
- `code/js/02-catalog-render.js` — `goHome()`; `_catalogReady`-aware "loading" vs "empty" state in
  `renderProducts()`; `applyCatVisibilityOverrides()` now also populates `_catFullyHiddenSlugs`;
  `deductStock()` calls the new `decrement_stock` RPC instead of writing `expert_stock` directly.
- `code/js/03-product-cart-checkout.js` — real order-confirmation screen (`orderRef`, item/total recap,
  `trackJustPlacedOrder()`) in `handleCheckoutSubmit()`.
- `code/js/04-i18n-order.js` — FAQ translation keys (EN/AR); `saveOrderToSupabase()` accepts a caller-
  supplied `order.id` instead of always generating its own (needed for the confirmation screen's reference).
- `code/js/05-accounts.js` — removed the auto-popup welcome/sign-in modal trigger.
- `code/css/02-sections.css` — `.loading-gear` (branded spinner), FAQ section styles.
- `code/css/06-lang-rtl.css`, `code/css/07-modals.css` — FAQ RTL + checkout confirmation-screen styles.

**Admin (`admin/`):**
- `admin/js/01-core-data.js` — removed the hardcoded `ADMIN_USER`/`ADMIN_PASS`/`SUPER_USER`/`SUPER_PASS`/
  `MANAGER_USER`/`MANAGER_PASS`/`ADMIN_ORDER_TOKEN` constants entirely; `SB_HDRS` comment updated to explain
  it's mutated post-login.
- `admin/js/03-auth.js` — real-Supabase-Auth `doLogin()`, `setAdminSession()`/`refreshAdminSession()`/
  `clearAdminSession()`; all 4 `logout*()` functions now also clear the session; team-account
  create/update/delete/list rewired to `admin-manage-accounts`.
- `admin/js/05-categories.js` — `catToggleHideProducts()`; `_orderedCatDefs()` exposes `hiddenAll`; category
  card UI gets the "Also hide all its products" checkbox + an updated hidden-badge label.
- `admin/js/07-orders.js`, `admin/js/09-deleted.js` — order RPC calls drop the `p_token` param (server checks
  `is_admin()` now, not a shared token).
- `admin/js/11-multiselect-brand-cat.js` — auto-login block now awaits `refreshAdminSession()` and bails to
  the login screen if the saved session token can't actually be refreshed, instead of trusting a stale
  `jain_auth` role flag alone.

**Backend / data:** `expert_admin_profiles` (role/permissions/display_name keyed by Supabase Auth uuid),
`is_admin(uid)`, `decrement_stock(product_id, qty)`, `expert_service_secrets` (new this session, see above).
`expert_admin_accounts`/`expert_admin_master` still exist but are dead (RLS-locked, zero policies, nothing
reads/writes them). See prior version of this file for the rest of the Edge Functions list (`notify-order`,
`order-invoice`, `unsubscribe`) and general data/migration file list, unchanged.
- `supabase/functions/send-offers/index.ts` — `run_scheduled` (cron) still checks a shared token, now read
  from `expert_service_secrets` instead of an env var (`cronToken()`); every other action now checks
  `isRealAdmin(authHeader)` (same `is_admin()` pattern as every other admin write) instead of the old pasted
  `ADMIN_SEND_TOKEN`.
- `admin/js/13-offers.js` — `_offCall()` sends `SB_HDRS.Authorization`; the token-paste save/load functions
  are gone.
- `admin/index.html` — the "Admin Send Token" paste UI block is gone.
- `code/js/01-config-data.js` — `sbFetchAllWithRetry()`; `window._catalogLoadFailed` set on products-fetch
  failure.
- `code/js/02-catalog-render.js`, `code/js/06-features.js` — `renderProducts()`'s empty-state branch checks
  `_catalogLoadFailed` first (real "couldn't load, retry" message vs. genuine "no products found").

## 4) Changes made
**Most recent session (UI/UX pass, 2026-10-11):**
- Redesigned the product detail page for desktop and phone, keeping every feature; verified at 1440/375
  and across variant / sale / price-on-request / out-of-stock / wishlist / qty-limit states. Several
  pushes, each followed by a cache flush.
- Made the desktop side banners stay pinned in the viewport gutters while scrolling (fixed + a scroll
  handler); then, on owner feedback, shrank them and delayed their appearance so they no longer overlap
  the offers carousel, and trimmed the empty band above "Shop by Category".
- Polished the header nav (hover/focus underline) and category tiles (bigger titles, shadow, hover arrow),
  leaving the offers carousel and keyword marquee untouched per the owner.
- Added the "never ask to commit/push; flush cache after every push" standing rule to `CLAUDE.md` and
  started following it (cache flushed via Supabase `execute_sql`, since Claude can't use the admin Flush
  Cache button).

*(Earlier session history — catalog reconciliation, subcategories, category drag/rename/hide management,
Featured tab tools, unified search, offers-ticker load order, signup opt-in — unchanged, see git history /
prior version of this file for full detail. This session's changes, roughly in order:)*
- Found and fixed the header logo not navigating home, the DCK-category loading-flash race, and added a
  custom 404 page — three independent small bugs reported together, fixed and verified live individually.
- Regenerated a branded "Loading products…" spinner to match the existing page-load splash instead of a
  generic icon.
- **Security review found the admin panel's real security boundary didn't exist**: owner/manager/admin
  passwords were plaintext constants in a public JS file, and RLS granted the public anon key full
  read/write/delete on nearly every table that mattered — the login screen was cosmetic, bypassable outright
  via a raw REST call with the public key. Confirmed via direct `curl` against the live site before touching
  anything. Fixed in two stages at the user's explicit direction (first the login-credential exposure alone,
  then — after walking through exactly what a full fix would mean and require — the deeper RLS lockdown):
  see section 2 for the full technical breakdown. Verified twice: once with the old permissive policies still
  live as a safety net, again after removing them, covering all 4 login types, every admin write path, order
  management, team-account lifecycle (create → login → delete → login-now-fails), and storefront checkout.
- Added the FAQ section and a real order-confirmation screen (see section 2) — requested together, built and
  shipped together.
- Investigated a report of category-page images not loading. Found ~1,500 product images are hotlinked from
  `expertshardware.com` rather than hosted here; a stress test loading all ~1,564 catalog images at once
  produced real timeouts on some of those external URLs, but the same URLs loaded in under a second when
  requested individually right after — points to load congestion (this codebase forcing a burst of requests
  at an external host under some conditions), not a dead link. Could not reproduce a permanently-broken image
  in normal (lazy-loaded) browsing. Flagged the external-hosting dependency itself as a real fragility risk
  regardless of root cause — see section 6.
- Found and fixed two unfinished draft banner images (`itrust1.jpg`, `itrust4.jpg` — one had a raw
  "1080x1920px" export label baked into the design, the other had garbled placeholder text) by regenerating
  both to match the finished style already used by the site's other banners.
- Built the "also hide all its products" category option (see section 2), end-to-end verified against the
  live database before and after.
- Updated this file and `CLAUDE.md` to reflect all of the above.
- Committed a pre-existing `product-images/` deletion the user had made outside of git tracking (their own
  cleanup, just needed staging/committing).
- Audited `expert-products/` for orphaned image batch folders and deleted the 25 confirmed-unreferenced ones
  (see section 2).
- Fixed the live "Generators shows no products" bug (retry + real error state, see section 2).
- Asked directly whether three specific security practices had actually been followed (secrets out of
  frontend/localStorage, secret storage, backend rate limiting) rather than assuming — found one real
  violation (`ADMIN_SEND_TOKEN` in the admin's `localStorage`) and fixed it; the other two checked out.
- While verifying that fix, found and fixed the `pg_cron`/`ADMIN_SEND_TOKEN` drift bug (see section 2) —
  scheduled campaign sends had been silently failing.
- Ran a read-only catalog comparison against `expertshardware.com`'s live catalog on request, with an explicit
  instruction to not remove any Generators/Big Red products or unhide anything — reported findings only (see
  section 2), no catalog changes made.

## 5) Failed attempts
*(Earlier history retained — see prior version of this file / git log for the full pre-session list. This
session adds:)*
- **`create or replace function` on an RPC with a changed parameter list does not remove the old
  overload.** Rewriting `admin_list_orders`/`admin_update_order_status`/`admin_delete_order` to drop the
  `p_token` parameter left the old, token-checking 2-/3-arg versions callable right alongside the new ones —
  caught by querying `pg_proc`/`pg_get_function_identity_arguments` after the fact, not assumed fixed just
  because the new version worked. Had to explicitly `drop function` each old signature. Now in `CLAUDE.md`.
- **`revoke execute ... from anon` on those same RPCs didn't actually stop anon from calling them** — the
  function body's own `is_admin()` check was still correctly rejecting unauthorized calls, so this wasn't
  exploitable, but the grant itself was still open because Postgres grants new functions to the `PUBLIC`
  pseudo-role by default, which every role (including `anon`) implicitly inherits from. Caught by checking
  `information_schema.routine_privileges` directly rather than trusting the `revoke` statement's apparent
  success. Fixed with an explicit `revoke ... from public`. Now in `CLAUDE.md`.
- **An early attempt to bump the site's cache-busting `asset_version` for local testing used a non-integer
  value** (`extract(epoch from now())` returns a value with a decimal point) — the client's own regex
  validation (`/^[0-9]+$/`) silently rejected it and fell back to an old hardcoded default version instead of
  actually busting the cache, which briefly affected the *live* site too (shared `expert_settings` row).
  Caught by checking the actual script-tag URLs rendered in the browser rather than assuming the SQL update
  alone was sufficient. Fixed immediately with a proper integer-millisecond value.

## 6) Next steps
- **85 catalog items in active categories (not the `cant-find-products` bucket) don't match anything on
  `expertshardware.com`'s current live catalog** — `door-handle` (41), `construction` (21), `household` (14),
  `tools` (5), `hand-tools` (4). Reported to the owner this session for their own review; nothing removed or
  changed. Full list is in `.audit-vs-expertshardware.json` (not committed) if it's needed again — otherwise
  re-run `scripts/audit-vs-expertshardware.js` (also not committed) to regenerate it.
- **3 products exist on `expertshardware.com` but not in our catalog**: `OOR-3200` (TDS METER WATER),
  `WATER PUMP 3/4 HP-1`, and a `Test Product 2230` entry that's likely their own placeholder, not real stock.
  Not added — flagged for the owner to decide.
- **No tool available in this session to read or set Supabase Edge Function secrets directly** — worth
  keeping in mind for any future secret-rotation work; the `expert_service_secrets` table pattern (see
  section 2) is the established workaround for any value that needs to be shared between a cron job and an
  Edge Function.
- **Re-host the ~1,500 product images currently hotlinked from `expertshardware.com`** into
  `expert-products/`/`expert_photos` — flagged this session as a real fragility risk (that site going down,
  restructuring, or rate-limiting breaks images here with nothing fixable on this side), not yet started.
- **`cancel_order`/`get_orders_by_phone` RPCs still have no ownership check** — anyone can cancel or look up
  any order by guessing/knowing an id or phone number. Same family of issue as the admin-auth work this
  session, smaller blast radius, not yet fixed.
- **Supabase "leaked password protection" is off and can't be turned on** — requires a paid plan, this
  project is on Free. Confirmed via the dashboard, not an oversight. Revisit if the plan ever changes.
- **`hidden_prices` needs to be re-run against every new product batch, indefinitely** — unchanged standing
  task. The confirmed "real price" name list (~32 items) still isn't saved anywhere in the repo.
- **The 437 `cant-find-products` items still need real verification against `expertshardware.com`, or a
  decision to just keep them as permanently-unverified stock** — unchanged, not touched this session.
- **Custom categories (added via admin's "+ Category" button) are still stored in `localStorage` only, not
  synced through Supabase** — unchanged, not touched this session. Separate from `cat_order`/`cat_labels`/
  `cat_hidden`, which *are* properly synced.
- **The ~158-item blanket 20% sale badge in `featured_offers` was never cross-checked against the real
  site** — unchanged, only one specific case ("Wall chaser") was ever verified.
- **Google OAuth is still stuck in Testing publishing status** — unchanged, Google Cloud Branding
  verification blocker unresolved.
- **`sitemap.xml` "Couldn't fetch" in Search Console** — unchanged, recheck after more time has passed.
- **Lighthouse performance items** (unused CSS/JS reduction, cache-control headers, minification) — still not
  attempted; the image-hosting/congestion finding this session (see above) is the same *class* of issue as
  prior sessions' real dependency/load-order bugs — worth continuing to look for more of that class before
  reaching for a build step this site intentionally doesn't have.
- **Concurrent work on this repo is the norm, not the exception** — unchanged, always `git fetch` before
  pushing, verify actual file content before treating anything as a conflict.
- **The storefront renders all ~1,564 products into the DOM at once on load** (default All-Products view),
  making the page ~146,000px tall — noticed this session while testing, left unchanged. Pagination or
  on-scroll (virtualized) rendering would cut initial DOM size and help on slower devices; offered to the
  owner, not yet actioned.
- **Standing workflow (now codified in `CLAUDE.md`, section "Standing instructions from the owner")**:
  never ask the owner whether to commit or push — when a storefront change is finished and verified
  locally, commit (explicit paths; merge `origin/main` first if the push is rejected) and push straight
  away. After every push that touches anything the storefront loads, flush the cache by bumping
  `expert_settings.asset_version` to a fresh integer-millisecond value via the Supabase `execute_sql` tool
  (the admin Flush Cache button needs the admin password, which Claude never enters), then poll the live
  GitHub Pages URL to confirm the deploy landed. The value must be a plain integer (see section 5 — a
  decimal silently breaks the client's `/^[0-9]+$/` validation). GitHub Pages deploy lag (usually clears
  within a couple of minutes) is real; confirm fixes with a cache-busted URL / `fetch(url,{cache:'no-store'})`
  rather than a plain reload.
  GitHub Pages deploy lag (usually clears within a couple of minutes) is real and not itself a bug — always
  confirm a fix live with a cache-busted URL/fresh tab rather than trusting a plain reload, and be aware the
  browser tooling itself can serve a stale cached copy of a JS/CSS file under an *identical* `?v=` URL across
  repeated local test navigations — a `fetch(url, {cache:'no-store'})` check is the reliable way to confirm
  what's actually being served versus what a given tab happens to have cached.
