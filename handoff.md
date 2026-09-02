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
- Everything from the prior session (catalog reconciliation against `expertshardware.com`'s live GraphQL
  catalog, the `cant-find-products` unverified-import category, the 36-subcategory system, admin category
  drag/rename/hide management, the Featured tab's drag-reorder + bulk tools, unified header/grid search with
  Enter-to-results, the offers-ticker load-order fix, the signup offers-opt-in checkbox) is unchanged this
  session except where noted above — see git history / a prior version of this file for that session's full
  detail if it needs re-verifying.

## 3) Active files
**New this session:**
- `supabase/functions/admin-login/index.ts` — verifies {username, password} server-side (service role) against
  `expert_admin_master`/`expert_admin_accounts`; superseded for the built-in 3 accounts by real Supabase Auth
  partway through the session, but still deployed/functional, not removed.
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

**Backend / data:** `expert_admin_profiles` (new — role/permissions/display_name keyed by Supabase Auth
uuid), `is_admin(uid)`, `decrement_stock(product_id, qty)` — all new this session. `expert_admin_accounts`/
`expert_admin_master` still exist but are dead (RLS-locked, zero policies, nothing reads/writes them). See
prior version of this file for the rest of the Edge Functions list (`notify-order`, `order-invoice`,
`send-offers`, `unsubscribe`) and general data/migration file list, unchanged.

## 4) Changes made
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
- **Standing workflow, still in effect**: bump the baked-in `?v=` fallback timestamp in `index.html` and
  `admin/index.html` on every JS/CSS/HTML change, commit, push, and flush the Supabase cache
  (`expert_settings.asset_version`) — pre-authorized, no need to ask before doing it each time. That value
  must be a plain integer (see section 5 — a decimal value silently breaks the client's own validation).
  GitHub Pages deploy lag (usually clears within a couple of minutes) is real and not itself a bug — always
  confirm a fix live with a cache-busted URL/fresh tab rather than trusting a plain reload, and be aware the
  browser tooling itself can serve a stale cached copy of a JS/CSS file under an *identical* `?v=` URL across
  repeated local test navigations — a `fetch(url, {cache:'no-store'})` check is the reliable way to confirm
  what's actually being served versus what a given tab happens to have cached.
