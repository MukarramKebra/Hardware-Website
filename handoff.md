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
storefront) — used this session as the source of truth for what prices/sales/options should actually show.

**Important operational note**: multiple Claude Code sessions (and a GitHub Action, see section 2) are
routinely working on this exact repo at the same time, sometimes concurrently with this one. `git status`/
`git fetch` before every push, expect divergence, and verify byte-for-byte identical content before
discarding any "conflicting" untracked file rather than assuming. Real logical merge conflicts (not just
identical-content ones) have now happened too — see section 4/5 for how one was resolved carefully instead
of blindly taking one side.

## 2) Current state
- **1468 products** live in `expert_products` (verified via a live count query — this number is stale
  almost as soon as it's written; re-verify live). Products keep arriving in large batches from ongoing
  scraping/import work, ids strictly increasing (`identity`, `start with 100000`), currently up to id
  `101471`.
- **Pricing now matches the real site, deliberately, for almost every product.** This session did a full
  category-by-category sweep of `expertshardware.com` (all ~17 top categories + every subcategory) and
  found that only a small, specific set of products (~32, all from one batch, ids in the 100445–100924
  range — chargers, saws, a few power tools) actually show a real price there; everything else is
  quote-only ("Ask on WhatsApp" territory) on the real site. Built and now maintain
  `expert_settings.hidden_prices` (a `{ "<product_id>": true }` map, read into `window._sbPriceHidden` by
  `loadSBData()`) so the storefront matches: **1436 of 1468 products currently show "Ask Price on
  WhatsApp"** instead of a number + Add to Cart. This has to be re-run (matching new product names against
  the confirmed real-price list, defaulting everything else to hidden) every time a new batch lands — it's
  an ongoing maintenance task, not a one-time fix. The confirmed "real price" name list is saved nowhere
  in the repo (only in this session's history) — if picking this up again, re-derive it by re-sweeping
  `expertshardware.com`'s categories rather than guessing.
- **Sales are also now real-site-accurate for the one case checked.** "Wall chaser 5000W with waterflow for
  black wall" (id 100820) sells at a genuine ~20% off on the real site (KD 59.500 vs 75.000) and is now the
  only product with an actual verified discount in `featured_offers`. Everything else in `featured_offers`
  still has `sale: 0` (or the pre-existing blanket 20% badge on ~158 older items, unchanged/unverified from
  before this session — see Failed Attempts / Next Steps, this wasn't re-audited against the real site).
- **Featured Products (homepage scrolling strip)**: still admin-curated via its own **Featured** tab
  (unchanged UI), stored in `expert_settings.featured_offers` as `{ id, sale }[]`. **Still not actually
  curated** — holds most of the catalog, owner's explicit choice to leave as-is. **New this session**: the
  ticker rendering is now hard-capped at **40 cards** regardless of how many are in `featured_offers`
  (`initOffersTicker()` in `js/02-catalog-render.js`) — it was duplicating the *entire* list 2–4x for the
  seamless-scroll loop, rendering 2000+ DOM nodes and dominating page weight on every load. This was the
  single biggest mobile/desktop performance fix this session.
- **Full-page loading splash + category-switch spinner**, both using the owner's "iTrust" gear logo
  (`loader-gear.png`, root), not a generic spinner. The page-load one is inline CSS/JS in `index.html`
  (deliberately not in the async-loaded `css/*.css` files, so it renders correctly even before those load).
  Hides on `DOMContentLoaded` (not `window.load` — see Failed Attempts for why that mattered). The
  category-switch overlay (`#catLoadOverlay` / `.cat-load-gear` in `css/01-base.css`) now uses the same
  gear instead of a plain FontAwesome spinner.
- **Full-screen welcome modal on first visit** (once per browser, 2.5s after load, signed-out visitors
  only) — reuses the existing `#authOverlay` Sign In/Create Account modal, now with a benefits list
  (`#authBenefits` in `index.html`) above the tabs. Went through an intermediate design (a small
  corner "subscribe to offers" nudge) before landing here on direct feedback — see section 5. Closing it
  any way marks `jain_welcome_modal_dismissed` in localStorage so it never auto-pops again in that browser.
  The corner offers-nudge markup/logic (`#offersNudge`, `showOffersNudge()`) is still in the codebase but
  no longer auto-triggered — dead-but-harmless unless intentionally reused.
- **Signup password now requires 8+ characters with both letters and numbers** (was: 6 chars, no complexity
  check) — `doAuthSignup()` in `js/05-accounts.js`.
- **Every order now emails an invoice to `muk@expertshardware.com`.** New Supabase Edge Functions
  `notify-order` (fires after checkout saves the order — re-fetches server-side rather than trusting client
  data, idempotent via a `notified` boolean column + atomic conditional UPDATE) and `order-invoice` (JSON
  API backing a real printable invoice page). See section 3/4 for why the invoice itself had to be a static
  HTML page rather than served directly from the function.
- **The `unsubscribe` Edge Function was silently broken since it was first built** (by concurrent work,
  discovered and fixed this session) — every customer who ever clicked "unsubscribe" in a marketing email
  was shown raw HTML source instead of a confirmation page. Root cause and fix below (section 4) — this is
  a real Supabase platform behavior worth knowing about for any future Edge Function that wants to return
  HTML from a GET request.
- **The legacy Supabase anon API key was disabled project-wide this session** (most likely the owner's own
  response, via the Supabase dashboard, to the shared-anon-key access-control gap flagged earlier — see
  below) — this broke *every* Supabase call on both the storefront and admin panel simultaneously (offers
  ticker, product data, checkout, accounts, and the SEO-page-generator GitHub Action, which reads the key
  straight out of `js/01-config-data.js`'s source at build time). Fixed by swapping to the new
  `sb_publishable_...` key everywhere it's hardcoded. **This has the exact same effective permissions as
  the old key** — RLS is still wide open for `anon` on `expert_products`/`expert_stock`/`expert_settings`/
  `expert_admin_accounts` (see below), so this key rotation did not fix the real security gap, only the
  format.
- **Admin panel security posture — audited in depth this session, mostly unchanged, now precisely
  documented instead of just flagged:**
  - Confirmed via `pg_policies` that `expert_products`, `expert_stock`, `expert_settings`, and
    **`expert_admin_accounts` itself** all grant full INSERT/UPDATE/DELETE to the public `anon` role with
    no restriction (`qual: true`). The admin login is a pure client-side UI gate; anyone with the site's
    public key (visible to any visitor) can bypass it entirely via direct REST calls.
  - The three built-in admin accounts' credentials are hardcoded plaintext constants in
    `admin/js/01-core-data.js` (a publicly-fetchable static file). Two disposable-looking team accounts
    also exist in `expert_admin_accounts` (`test`/`test123`, `2`/`123`) — likely test entries, not deleted.
  - Removed one small piece of dead code in `admin/js/03-auth.js` that used to write the admin
    username/password into `#fpUser`/`#fpPass` elements — those elements don't exist in the current
    `admin/index.html`, so this was already a no-op, not a live exposure, but worth not leaving lying
    around (see section 5 for the correction — this was initially mis-reported as an active bug).
  - **Real fix (proper Supabase Auth for the admin panel, or at minimum routing all admin writes through a
    secret-gated Edge Function with RLS locked down) was explicitly deferred again this round** — "not
    for admin only for users" — see section 6.
  - Session tokens (customer-facing, real Supabase Auth) are stored in plain `localStorage`
    (`jain_access_token`/`jain_refresh_token`) — normal for a backend-less SPA, mitigated by a real,
    verified **1-hour access-token expiry** (confirmed via an actual test signup, not assumed) plus
    single-use rotating refresh tokens (Supabase's own default behavior). No rate limiting on the admin
    login form, but since the credentials are already in the shipped JS, rate-limiting the form itself
    would be close to security theater — the real fix is the same one deferred above.
- **Privacy Policy is now actually linked from the site** — the content already existed in `terms.html`
  under a `#privacy` anchor (added earlier for Google OAuth), but nothing linked to it labeled as "Privacy
  Policy". Added to the footer and all four consent checkboxes (signup, footer subscribe, offers-nudge
  subscribe).
- **New Accessibility Statement page** (`accessibility.html`, linked from the footer) — describes what's
  actually implemented (alt text, keyboard operability, no forced color scheme, bilingual EN/AR, Lighthouse
  audits) rather than claiming formal compliance. Backed one specific claim on that page (respects
  `prefers-reduced-motion`) with a real global CSS rule in `css/01-base.css`, since previously only the
  preloader honored it.
- **Search-as-you-type is now debounced (180ms)** — both the grid's own search box and the header search
  dropdown were calling `renderProducts()` (which rebuilds the whole grid via `innerHTML`, up to ~1000+
  cards) on every raw keystroke. Shared via `debouncedRenderProducts()` in `js/02-catalog-render.js`.
- **A stale `pg_cron` job was silently failing every minute** (`send-offers` with `action:'run_scheduled'`)
  — 401 Unauthorized on every run because its hardcoded `x-admin-token` header predated a token rotation
  earlier this session. Fixed via `cron.alter_job()`; verified via `net._http_response` that runs
  immediately after the fix return real 200s.
- **The email campaign system (`admin/js/13-offers.js` + `send-offers`/`unsubscribe` Edge Functions,
  described as "added by concurrent work, not deeply exercised" in the prior handoff) turned out to have
  never actually been deployed** — the source existed in the repo but the functions weren't live on
  Supabase. Deployed both, set up `ADMIN_SEND_TOKEN` and `RESEND_API_KEY` secrets, sent and confirmed a
  real test email. It works now.
- Everything else from before is unchanged unless noted above: admin panel tabs (Inventory, Analytics,
  Deleted, Orders, Reports, Categories, Banners, Featured, SEO, Owner Controls), size/pack variants,
  skeleton shimmer, matched cart/WhatsApp FABs, hidden "View details" SEO links, Sign In/Guest checkout
  choice, Google Sign-In still stuck in Testing publishing status, per-product SEO pages + sitemap
  generation, the code-only knowledge graph at `graphify-out/`, and the generic `expert_settings` key/value
  store.

## 3) Active files
**Storefront (root):**
- `index.html` — main markup; **new this session**: inline page-load preloader (`#pagePreloader`, styled
  inline on purpose — see section 2), full-screen welcome modal with benefits list (`#authBenefits`),
  footer Privacy Policy link, cache-busting fallback timestamp (bump on every JS/CSS/HTML change — see
  section 6)
- `js/01-config-data.js` — Supabase config (**`SB_KEY` now the new `sb_publishable_...` key, not the
  legacy anon JWT — see section 2**), `loadSBData()` (now also reads `hidden_prices`), `sbFetchAll()`
  (paginates past PostgREST's 1000-row cap — added by concurrent work, survived a real merge conflict this
  session), `getFeaturedSale()`/`applySale()`, `checkAssetVersion()`
- `js/02-catalog-render.js` — category/offer rendering, **`initOffersTicker()` now hard-capped at 40
  cards**, product card rendering, search matching + sort, **`debouncedRenderProducts()`** (shared by both
  search entry points), skeleton-shimmer wiring
- `js/03-product-cart-checkout.js` — product modal, cart, checkout; search input now calls
  `debouncedRenderProducts` instead of `renderProducts` directly
- `js/04-i18n-order.js` — translations/RTL, order submission (`saveOrderToSupabase()` now also fires
  `notifyOrderByEmail()` after a successful save)
- `js/05-accounts.js` — customer accounts; **`doAuthSignup()` password check now 8+ chars + letters &
  numbers**; welcome-modal auto-show/dismiss logic (`showOffersNudge`/`dismissOffersNudge` renamed
  conceptually — the actual auto-trigger now calls `openAuthModal('login')` directly, gated on
  `jain_welcome_modal_dismissed`)
- `js/06-features.js` — wishlist/reviews/WhatsApp share/recently-viewed, header search dropdown (now calls
  `debouncedRenderProducts`)
- `js/07-subscribe.js` — refactored to share one `_submitSubscribe()` core between the footer form and the
  offers-nudge form (`doSubscribe`/`doNudgeSubscribe` are now thin wrappers)
- `css/01-base.css` — **new this session**: `.cat-load-gear` (category-switch spinner, now the gear image),
  global `prefers-reduced-motion` rule; `.cat-icon` rules removed (category tile icon badges deleted)
- `css/02-sections.css`, `css/05-responsive.css` — `.cat-icon` rules removed
- `css/08-account-auth.css` — `.auth-benefits` (welcome-modal benefits list), `.lp-sub-form` (offers-nudge
  compact subscribe form, still present but currently unused UI)
- `css/03-cart-features-contact.css`, `css/09-widgets.css` — unchanged this session
- `terms.html` — unchanged this session (still has the `#privacy` anchor from before)
- `accessibility.html` — **new this session**
- `order-invoice.html` — **new this session**: static printable-invoice page, fetches order JSON from the
  `order-invoice` Edge Function client-side and renders it (has to be a real static page, not served
  directly from the function — see section 4)
- `unsubscribed.html` — **new this session**: static confirmation page the `unsubscribe` function now
  redirects to (same reason as above)
- `loader-gear.png` — **new this session**: the cropped, transparent-background gear logo used for both
  loading spinners
- `product/*.html` — auto-generated, unchanged mechanism

**Admin (`admin/`):**
- `admin/js/01-core-data.js` — **`SB_KEY` swapped to the new publishable key** (same as storefront);
  duplicate `sbFetchAll()` definition left by a merge was cleaned up to one
- `admin/js/03-auth.js` — removed the dead `#fpUser`/`#fpPass` credential-display lines (see section 2)
- All other `admin/js/*.js` files unchanged this session

**Backend (`supabase/functions/`):**
- `send-offers/index.ts` — **deployed live this session** (existed in repo, was never actually pushed to
  Supabase before)
- `unsubscribe/index.ts` — **rewritten this session**: does its DB work then 302-redirects to
  `unsubscribed.html` instead of returning HTML directly (see section 4 for why)
- `notify-order/index.ts` — **new this session**: order → invoice email
- `order-invoice/index.ts` — **new this session**: returns one order as JSON (not HTML — see section 4)

**Data/reference:** unchanged this session — see prior version of this file for the full list
(`expert-hardware-*.sql` migrations, `expert products/*/expert_import_*.csv`, `cat-images/`,
`.github/workflows/generate-seo.yml`, `scripts/generate-product-pages.js`, `graphify-out/`).

## 4) Changes made
*(Earlier history — full pre-session list of category/banner rebuild, Supabase migration, RLS hardening,
id-sequence fix, Sign In/Guest checkout, Resend SMTP, header search dropdown, sort dropdown, skeleton
shimmer, matched FABs, `#privacy` anchor, knowledge graph — unchanged, see git history / prior version of
this file for full detail. This session's changes, roughly in order:)*
- Deployed the email campaign system for real (`send-offers`, `unsubscribe`) — it existed only as
  undeployed source before. Generated and set `ADMIN_SEND_TOKEN` + `RESEND_API_KEY` secrets, sent and
  confirmed a real test campaign email.
- Added a full-page loading splash and category-switch spinner using the owner's iTrust gear logo. Cropped
  the source image precisely via canvas pixel-scanning (not eyeballed), made it self-contained (inline
  CSS/JS), fixed it hiding on `window.load` instead of `DOMContentLoaded` (was making desktop feel much
  slower than mobile, since more images sit "above the fold" on a wide screen), swapped in a
  transparent-background version, then reused the same gear for the category-switch spinner (previously a
  plain red FontAwesome icon).
- Found and fixed the real cause of "site feels slow": `initOffersTicker()` duplicating the *entire*
  (uncurated) featured-offers list 2–4x for the scroll loop, rendering 2000+ DOM nodes. Capped at 40 cards.
- Fixed `full-phone.jpg` and (separately, later) `loader-gear.png` 404ing on mobile/category-switch — both
  were CSS `url()` references missing the `../` needed from inside `css/`.
- Shrunk `loader-gear.png` from 868KB to 106KB (later 87KB with a transparent-background swap) by cropping
  to the actual badge content instead of shipping the full source image's large blank margins.
- Debounced search-as-you-type (180ms, shared between the grid search box and header dropdown) — was
  rebuilding the whole product grid on every keystroke.
- Removed the small icon badge from category tiles (cosmetic request); cleaned up the now-dead `.cat-icon`
  CSS.
- Did a full category-by-category (+ subcategory) sweep of `expertshardware.com`'s real storefront to
  compare pricing/sales/options against ours. Found and fixed one genuine missing sale (Wall chaser 5000W,
  now 20% off matching the real ~20.7%). Found several genuine missing product options/variants (flagged,
  not implemented — see section 6). Found that only ~32 products site-wide actually show a real price on
  the real site; built `expert_settings.hidden_prices` and marked the rest (1436 of 1468 as of last run) as
  "Ask Price on WhatsApp" instead of showing a stored number with an Add to Cart button. Re-ran this same
  matching process against each new product batch that landed during the session.
- Replaced the auto-popping sign-in modal with a corner "subscribe to offers" nudge (lower ask, no account
  required) — then, on direct follow-up feedback, replaced *that* with a full-screen welcome modal (reusing
  the existing auth modal, adding a benefits list) instead, since the owner wanted the full sign-in
  experience back, just redesigned to be less naggy (deliberate, dismissible, once per browser).
- Ran a full security audit at the owner's request: confirmed session-token localStorage storage, confirmed
  (via `pg_policies`) that admin authorization is not enforced server-side at all, confirmed no rate
  limiting on the admin login, strengthened signup password requirements (8+ chars, letters+numbers),
  provided the full admin credential list on request. Corrected one over-stated finding from that audit
  (see section 5).
- Added an explicit Privacy Policy link (footer + all consent checkboxes) pointing at the pre-existing
  `terms.html#privacy` anchor.
- Added `accessibility.html`, linked from the footer; added a real site-wide `prefers-reduced-motion` CSS
  rule to back one of its claims.
- Built the order → invoice-email system: `notify-order` (idempotent, server-side re-fetch) and
  `order-invoice` + `order-invoice.html` (printable invoice with a working Print button). Discovered along
  the way that Supabase Edge Functions silently rewrite any GET request returning `text/html` to
  `text/plain` (documented platform behavior) — confirmed this had *already* been breaking the live
  `unsubscribe` confirmation page since it was built. Fixed both using the same pattern: functions do their
  work and either return JSON (fetched client-side by a real static page) or 302-redirect to one.
- Fixed a stale `pg_cron` job (`send-offers` / `run_scheduled`, running every minute) that had been failing
  with 401 since an earlier token rotation — updated the token in the job definition via
  `cron.alter_job()`, verified via `net._http_response`.
- Fixed a site-wide outage: Supabase's legacy anon API key was disabled project-wide (most likely the
  owner's own response to the admin-security findings above), breaking every Supabase call site-wide
  including the SEO-generator GitHub Action. Swapped to the new `sb_publishable_...` key in both
  `js/01-config-data.js` and `admin/js/01-core-data.js`. This required resolving a real merge conflict
  against a concurrent, unrelated fix (`sbFetchAll()` pagination past PostgREST's 1000-row cap) — verified
  the two sides' logic was equivalent before resolving, rather than blindly taking one side, and cleaned up
  a duplicate function definition the merge left behind in both files.

## 5) Failed attempts
*(Earlier history retained — see prior version of this file / git log for the full pre-session list:
category image path bug, `expert_photos` column mismatch, base64 image bloat, demo-product removal breaking
admin views, CSV parser quoted-name bug, `document.write` cache-busting under ad-blockers, clipped inventory
buttons, mobile modal layout break, GitHub Pages deployment lag, header-search-scrolls-the-page (corrected
on feedback), cart-button sizing iterations, `.git/index.lock` contention, Google OAuth Testing-status /
Branding-verification blockers, `sitemap.xml` "Couldn't fetch" in Search Console. This session adds:)*
- **The page-load preloader's crop math (percentage-based `background-size`/`background-position`) silently
  rendered nothing** (0×0, background `none`) despite being logically correct — root cause never fully
  pinned down; switching to absolute-pixel values for the same crop worked immediately. If building another
  cropped-background-image effect, prefer pixel values over percentages until this is understood.
- **The category-switch gear fix looked broken during local `file://` testing** (computed styles showed no
  background image) purely because the local preview browser was serving a cached parse of the versioned
  CSS `<link>` across reloads, seemingly ignoring the query-string cache-buster for `file://` URLs
  specifically. Confirmed the actual code was correct by manually injecting a freshly-fetched copy of the
  stylesheet — worth remembering as a test-environment quirk, not a real site bug, before chasing it further
  next time.
- **Mis-reported an admin-panel security finding as an active bug**: initially said the "forgot password"
  screen was live-displaying the admin username/password in plaintext. It wasn't — the code that would do
  that (`admin/js/03-auth.js`) targets `#fpUser`/`#fpPass` elements that don't exist anywhere in the current
  `admin/index.html`, so it was dead code with a null-guard, never actually executing. Corrected this
  directly rather than letting the overstated claim stand. Lesson: verify the HTML side exists before
  reporting a client-side "this is displayed" finding, not just the JS that would display it.
- **`order-invoice`/`unsubscribe` Edge Functions originally returned HTML directly** — Supabase silently
  rewrites any GET request's `text/html` response to `text/plain` (documented, not a bug in the function
  code). Cost real debugging time (checked response headers, re-deployed, compared against a known-working
  function before finding this in Supabase's own docs). Fixed by moving the actual HTML to a static page
  and having the function return JSON or redirect instead. Any future Edge Function meant to render a page
  directly to a browser needs this same workaround.
- **A merge conflict this session was a real logical conflict, not just noise** — both this session and a
  concurrent one edited `js/01-config-data.js`/`admin/js/01-core-data.js` at the same time (the key swap vs.
  the 1000-row pagination fix). A naive "just take mine" or "just take theirs" resolution would have either
  reintroduced the disabled key or silently dropped the pagination fix. Read every conflict block, confirmed
  the two sides' logic was actually equivalent apart from the key value, and caught a duplicate
  `sbFetchAll()` function definition the merge tool left in both files (harmless — second definition just
  shadows the first — but worth cleaning up).

## 6) Next steps
- **`hidden_prices` needs to be re-run against every new product batch, indefinitely.** This isn't a
  one-time fix — it's now a standing maintenance task. The "confirmed real price" name list (~32 items) was
  derived from a full sweep of `expertshardware.com` and isn't saved anywhere in the repo; whoever picks
  this up next should either keep it from this session's history or re-derive it.
- **Admin panel has no real server-side authorization** (RLS wide open to `anon` on
  `expert_products`/`expert_stock`/`expert_settings`/`expert_admin_accounts`; login is client-side only).
  Explicitly deferred again this round ("not for admin only for users"). Two real paths forward when it's
  time to fix it: proper Supabase Auth for the admin panel (biggest but most correct fix), or route all
  admin writes through a secret-gated Edge Function (reusing the `notify-order`/`send-offers` pattern) with
  RLS locked down to deny direct anon writes. Either way, the two disposable-looking team accounts
  (`test`/`test123`, `2`/`123`) are worth deleting regardless of which path is taken.
- **Supabase Auth "Confirm email" needs to be turned off in the dashboard** (Authentication → Sign In / Up →
  Email) so customer signup doesn't require a manual email-confirmation click — the owner asked for this,
  but no available tool can change Supabase Auth provider settings (not exposed via the Management API
  tools currently connected, and it's platform config, not a database row). No code change is needed once
  it's toggled — `authSignUp()` already branches correctly on whether Supabase returns an access token
  immediately.
- **Genuine missing product options from the real-site sweep — now implemented (2026-08-09).** DROP IN
  ANCHOR (100301), WEDGE ANCHOR (100318), STAPLE PIN READER (100499), and RAIN COAT YELLOW (100306) all
  now have their real size/pack options (labels, per-option prices, SKUs, sourced from a live sweep of each
  product page on `expertshardware.com`, including switching the option dropdown there to read each
  option's own price/SKU) written into `expert_settings.product_variants`. While wiring this up, found and
  fixed a real, pre-existing bug: the size/pack selector was gated behind the same branch that hides price
  ("Ask Price on WhatsApp"), so it was **never reachable on any price-hidden product** — including all 18
  products that already had options configured before this fix, since every one of them turned out to also
  be in `hidden_prices`. Moved the variant tiles (product modal, `js/03-product-cart-checkout.js`) and
  dropdown (grid card, `js/02-catalog-render.js`) out of that branch so they render regardless of price
  visibility, and threaded the selected option through to `askPriceOnWhatsApp()` (`js/06-features.js`, now
  takes an optional variant index) so the WhatsApp message names the specific size the customer picked.
- **The ~158-item blanket 20% sale badge in `featured_offers` (pre-existing, not from this session) was
  never cross-checked against the real site** — only the one specific "Wall chaser" case was verified and
  fixed. If sale-accuracy matters going forward, that whole set needs the same real-site verification
  treatment.
- **Featured Products still isn't actually curated** — unchanged, owner's explicit choice.
- **Google OAuth is still stuck in Testing publishing status**, and the Google Cloud Branding verification
  blocker is still unresolved — unchanged from before this session, see prior version of this file for full
  detail.
- **`sitemap.xml` "Couldn't fetch" in Search Console** — unchanged, recheck after it's had more time.
- **Lighthouse performance items** (unused CSS/JS reduction, cache-control headers, minification) — still
  not attempted, still hard to do safely without introducing a build step this site intentionally doesn't
  have. Note that the two biggest real perf wins found this session (offers-ticker DOM bloat, preloader
  waiting on the wrong load event) were both logic bugs, not Lighthouse-style asset optimization — worth
  checking for more of that class of issue before reaching for a build step.
- **Concurrent work on this repo is the norm, not the exception** — the `generate-seo` GitHub Action pushes
  independently, and other sessions can and do touch the exact same files at the same time (this session hit
  a real logical merge conflict, not just an identical-content one, for the first time — see section 5).
  Always `git fetch` before pushing, verify actual file content before treating anything as a conflict, and
  when a real conflict does happen, read both sides' logic before resolving rather than picking a side by
  default.
- **Standing workflow, still in effect**: bump the baked-in `?v=` fallback timestamp in `index.html` (two
  occurrences), commit, push, and flush the Supabase cache (`expert_settings.asset_version`) on every change
  that touches JS/CSS/HTML — pre-authorized, no need to ask before doing it each time. GitHub Pages itself
  also has a real deploy lag (seen repeatedly this session, usually clears within a couple of minutes) —
  don't mistake that for a real bug when verifying a just-pushed change live.
