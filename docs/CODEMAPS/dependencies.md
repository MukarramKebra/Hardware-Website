# Dependencies Codemap

<!-- Generated: 2026-10-11 | Files scanned: index.html, admin/index.html, code/js/*, supabase/functions/*, .github/workflows/* | Token estimate: ~500 -->

Zero `package.json` in the repo root — the storefront and admin are plain HTML/CSS/JS. All third-party code is loaded via CDN or deployed as Deno Edge Functions.

## Runtime services

| Service | Role | Where configured |
|---|---|---|
| **Supabase** (project `qhebhvllkovfbkqrcnmm`) | Postgres + Auth + Edge Functions | `code/js/01-config-data.js` (`SB_URL`, `SB_KEY` base64-wrapped), `admin/js/01-core-data.js` (`SB_HDRS`) |
| **GitHub Pages** | Static hosting of the whole repo at `/Hardware-Website/` | `.github/workflows/*` + repo settings |
| **Resend** | Transactional + campaign email | Edge Fns `notify-order`, `send-offers`, `order-invoice` via `RESEND_API_KEY` secret |
| **expertshardware.com** | Legacy Magento site, hotlinked as image source for many products | `getAllProducts()` img_url handling (`code/js/01-config-data.js`) — fragility: downtime breaks images here |

## CDNs loaded in HTML

- `cdnjs.cloudflare.com/.../font-awesome/6.5.0/...` (storefront + admin icons)
- `fonts.googleapis.com` → Inter font family (both apps)
- Unsplash (`images.unsplash.com`) via the `U(id)` helper, for a handful of placeholder product images

## Edge Function secrets (set via `supabase secrets set`, never committed)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `ADMIN_SEND_TOKEN` — gates `send-offers`; the admin keeps a copy in the browser's `localStorage` only.

## CI / automation

- **GitHub Actions**: `.github/workflows/generate-seo.yml` — regenerates `product/*.html` + `sitemap.xml` on every push to `main` (ignores `product/**` + `sitemap.xml` to avoid loop) and nightly at 03:17 UTC. Runs `node scripts/generate-product-pages.js` on `actions/setup-node@v4` (Node 20), commits with the `github-actions[bot]` identity, uses `GITHUB_TOKEN`.

## Shared libraries (none)

There is no shared code package. The storefront and admin each own their own copies of helpers (SB fetch wrappers, formatting, cart math) — kept intentionally separate because the admin loads on top of the same `localStorage` namespace and must not accidentally pick up storefront state.

## One-off maintenance scripts (`scripts/`)

| Script | Purpose |
|---|---|
| `generate-product-pages.js` | CI target — regenerate `product/*.html` + `sitemap.xml` from Supabase |
| `fix-expert-products-photo-urls.js`, `fix-marhaba-photo-urls.js` | Backfill/correct `expert_products.img_url` paths |
| `consolidate-cantfind-photos.js` | Fold `cant-find-products/` images into canonical paths |
| `save-bigred-images.js`, `save-dck-images.js` | Download brand image sets into `expert-products/<folder>/` |
| `add-bigred-keywords.js`, `expand-thin-keywords.js` | Enrich `expert_settings.product_keywords` for SEO |
| `audit-expert-products-images.js`, `audit-vs-expertshardware.js` | Read-only audits, emit `.audit-*.json` reports |

All are plain Node (built-in `fetch`/`fs`, no deps). Convention: write scripts take a `--dry-run` flag; run it first.
