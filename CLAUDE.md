# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Expert Hardware** — the public storefront and admin/inventory panel for a Kuwait-based hardware/tools
store. Plain HTML/CSS/vanilla-JS, **no build step, no framework, no package.json**. Hosted on GitHub
Pages; **Supabase** (Postgres + PostgREST + Edge Functions) is the entire backend for products, stock,
orders, photos, subscribers, and every admin-configurable setting.

- Live storefront: `https://mukarramkebra.github.io/Hardware-Website/`
- Admin panel: `https://mukarramkebra.github.io/Hardware-Website/admin/`

`handoff.md` in the repo root is a running project log (goals, current state, file map, past bugs/fixes,
open items) — read it for deep history/context before making non-trivial changes. Keep it updated when
you make significant changes; it is the project's memory across sessions.

## Commands

There is no build/lint/test tooling — no `package.json`, no bundler, no test runner. "Development" means
editing HTML/CSS/JS files directly and viewing them (a static file server or opening the HTML directly is
enough; nothing needs compiling). The only Node script in the repo is:

```bash
node scripts/generate-product-pages.js
```

Regenerates `/product/*.html` (static per-product SEO pages) and `sitemap.xml` from the live Supabase
catalog. It has no npm dependencies (uses built-in `fetch`/`fs`, Node 18+). It reads `SB_URL`/`SB_KEY`
straight out of `js/01-config-data.js` — no separate secret to keep in sync. For a local dry run without
hitting the live database, set `SEO_FIXTURE=/path/to/fixture.json` (and optionally `SEO_OUT=/scratch/dir`
to avoid writing into the repo).

This script also runs automatically in CI — see **CI/CD** below. You normally don't need to run it by
hand; editing product data in Supabase (or via the admin panel) is enough, and the next push or the daily
schedule regenerates the static pages.

## Architecture

### Storefront vs. admin, same backend

Two independent static apps share one Supabase project:

- **Storefront** (`index.html` + `js/01-…07-…js` + `css/01-…09-…css`) — the public site.
- **Admin panel** (`admin/index.html` + `admin/js/*.js` + `admin/css/*.css`) — inventory/order/content
  management. `admin/index.html` has `<base href="../">`, so every relative asset path in it resolves to
  the repo root, not `admin/` — a common source of broken-path bugs if you forget this when adding assets.

Both load Supabase config (`SB_URL`/`SB_KEY`) duplicated in their own `01-*.js` file — there is no shared
module system, so a Supabase project change means updating it in **both** places (also update it in
`scripts/generate-product-pages.js`'s read target, since that script parses it out of the storefront's
file directly).

### `expert_settings`: the generic config store

Almost everything that isn't a product's own row lives as JSON blobs in one key/value Supabase table,
`expert_settings`, read/written directly via the PostgREST REST API — no server-side code needed for new
settings. Known keys include `featured_offers` (homepage curated picks + per-product sale %),
`product_variants` (size/pack options), `asset_version` (cache-busting, see below), plus SKU/brand/
category/keyword/hidden-price/qty-limit/banner/site-disabled data. When adding a new admin-configurable
feature, prefer adding another key here over a new table, matching the existing pattern.

### JS/CSS file numbering = load order, not modules

Files are named `01-`, `02-`, … and loaded in that order via `<script>`/`<link>` tags built at runtime
(see cache-busting below) — there's no bundler enforcing dependency order, so a file can only use globals
already defined by a lower-numbered file that loaded before it. When adding new logic, put it in the
existing topical file it belongs to (see the map in `handoff.md` section 3) rather than creating a new
numbered file, unless it's a genuinely new concern.

Key files to know:
- `js/01-config-data.js` — Supabase config, `loadSBData()` (the one batched fetch for products/photos/
  stock/variants/featured_offers/review stats), `getFeaturedSale()`/`applySale()` (the single source of
  truth for sale pricing — used by every place a price is shown or charged).
- `js/02-catalog-render.js` — category/product/offer rendering, search + "Did you mean?" suggestions,
  JSON-LD injection.
- `js/03-product-cart-checkout.js` — product detail modal, cart, checkout, qty-limit enforcement.
- `js/06-features.js` — wishlist/reviews/recently-viewed, `?q=` search param handling, and the final
  bootstrap calls (`renderProducts(); loadSBData();`) — i.e. this is the last file, loaded last.
- `admin/js/08-inventory.js` — Add Product, the Options/variants editor (drag-and-drop reordering), and
  the "read-fresh-merge-write" save pattern (see below).
- `admin/js/05-categories.js` — category/banner management **and** the whole Featured Products tab.

### Sale pricing has one source of truth

`getFeaturedSale()` / `applySale()` in `js/01-config-data.js` are called everywhere a price is displayed
or charged: offers strip, product grid card, product detail modal, Add to Cart (both card and modal
paths), wishlist, recently-viewed, and "Customers Also Bought". If you add a new place that shows a
price, route it through these helpers rather than reading `product.price` directly — a past bug (see
`handoff.md` section 5) came from sale % only being applied in one place and not others.

### Variants ("options") save pattern: read-fresh-merge-write

Product size/pack options are stored as one JSON blob (`product_variants` in `expert_settings`) covering
*all* products, not one row per product. Never overwrite this blob from in-memory state — a stale local
copy can silently erase other products' options that changed elsewhere since you loaded the page. Always
re-fetch the current blob from Supabase immediately before saving, merge in only the one product being
edited, then write. This is exactly the bug described in `handoff.md` section 5 ("saveVariants() overwrote
the entire product_variants blob") — don't reintroduce it.

### Cache-busting is two-layered and requires a manual step

CSS/JS are loaded with a `?v=` query param sourced from `localStorage['expert_asset_v']`, falling back to
a baked-in timestamp constant (e.g. `'202607221500'`) on a visitor's first-ever load. A background check
(`checkAssetVersion()` in `js/01-config-data.js`) compares the local version against
`expert_settings.asset_version` in Supabase and auto-reloads once if they differ; admin's **Flush Cache**
button (Owner Controls tab) bumps that shared value to force everyone onto fresh files. The loader uses
`document.createElement`/`appendChild`, **not** `document.write` (which several ad-blockers/Chrome
interventions neuter, breaking styling entirely for affected visitors — see `handoff.md` section 5).

**Standing, pre-authorized workflow**: whenever you change any JS/CSS/HTML, bump the baked-in fallback
timestamp constant in **both** `index.html` and `admin/index.html` (search for `expert_asset_v` in each),
commit, push, and flush the Supabase cache. No need to ask before doing this each time — it's expected on
every push that changes front-end assets.

### Products are served two ways

1. **Client-side, live**: `index.html` renders the full catalog from Supabase on every page load — no
   crawlable per-product URL exists from this path alone.
2. **Static, pre-rendered SEO pages**: `scripts/generate-product-pages.js` generates one real
   `/product/<slug>.html` per product (own `<title>`, meta description, canonical, OG/Twitter tags,
   JSON-LD `Product` schema in the raw HTML, no JS required) plus `sitemap.xml`, committed straight into
   the repo so GitHub Pages serves them statically.

### CI/CD

`.github/workflows/generate-seo.yml` runs `scripts/generate-product-pages.js` and commits any resulting
changes back to `main`:
- On every push to `main` (paths-ignore excludes `product/**` and `sitemap.xml`, so the bot's own commits
  don't retrigger itself) — so a template/code change regenerates pages immediately.
- Daily at 03:17 UTC — so product edits made directly in Supabase (not through a code push) still get
  reflected in the static pages.
- Manually via `workflow_dispatch`.

There is no other CI (no lint/test workflow exists).

### Supabase Edge Functions (`supabase/functions/`)

Deno/TypeScript functions for anything that needs a secret a static frontend can't hold:
- `send-offers` — sends/schedules marketing campaigns via Resend, using a shared `x-admin-token` header
  for auth (no Supabase Auth session) and the service-role key server-side to bypass RLS.
- `unsubscribe` — public unsubscribe-link handler for `offer_subscribers`.

Secrets for these are set via `supabase secrets set …` and are never in git.

### Root-level `.sql` files

Schema/migration scripts meant to be run manually in the Supabase SQL editor, not applied automatically:
- `expert-hardware-supabase.sql` — full schema for recreating the project from scratch (all `expert_*`
  tables + RLS policies).
- `expert-hardware-rls-hardening.sql` — RLS tightening pass; read its header for rationale before
  changing any `expert_*` table's row-level security.
- `expert-hardware-offers.sql` — `offer_subscribers` + campaign tables for the subscribe/send-offers
  feature.
- `expert-hardware-fix-id-sequence.sql` — one-off fix for an identity-sequence desync on
  `expert_products.id`; safe to re-run, touches no data.

### Known accepted security posture (don't "fix" without asking)

The storefront and admin panel share the same public Supabase anon key — there is no real admin
authentication distinct from any other site visitor. Admin passwords are stored in plaintext (hardcoded
JS constants and the `expert_admin_accounts` table) and are technically readable via the anon key. This
has been explicitly discussed and declined to fix (would require moving admin to real Supabase Auth,
which the owner has declined so far) — treat this as a known, accepted residual risk, not an oversight to
silently patch. RLS policies were separately hardened in `expert-hardware-rls-hardening.sql` to close
actual data-access gaps (e.g. an IDOR on `expert_orders`) without touching this larger auth question.

### Static images, no CDN

Product/category/banner images are plain files committed to the repo (`expert products/<range>/`,
`Bahar-Products/`, `Banners/`, `cat-images/`, `product-images/`), referenced by URL from Supabase tables
(e.g. `expert_photos.img_url`) rather than stored as base64 blobs in the database — a past bug bloated a
single data fetch to 3.2MB by doing the latter (see `handoff.md` section 5). Keep new product images as
files + URL references, not inline base64.
