#!/usr/bin/env node
/*
 * generate-product-pages.js
 * ---------------------------------------------------------------------------
 * Static SEO page generator for Expert Hardware.
 *
 * WHY: the storefront (index.html) renders every product client-side from
 * Supabase, so no individual product has a crawlable URL and Google cannot
 * surface individual products. This script pre-renders one real, static HTML
 * page per product into /product/<slug>.html — each with its own <title>,
 * meta description, canonical, Open Graph / Twitter tags and JSON-LD Product
 * schema visible in the initial HTML (no JS required) — and rebuilds
 * sitemap.xml so Google can discover them all.
 *
 * It has NO external dependencies (built-in fetch + fs only) so it runs
 * anywhere Node 18+ is available (locally and in GitHub Actions).
 *
 * Data source: the live Supabase project. The URL + public anon key are read
 * straight out of js/01-config-data.js (the same values the site itself uses)
 * so there is no second copy of any secret to keep in sync.
 *
 * Local testing: set SEO_FIXTURE=/path/to/fixture.json to render from a local
 * JSON snapshot instead of hitting Supabase (used by the sandbox test — a
 * no-op in production where the env var is unset).
 * ---------------------------------------------------------------------------
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
// SEO_OUT redirects output to a scratch dir for local testing; unset in
// production, where pages are written into the repo for GitHub Pages to serve.
const OUT_BASE = process.env.SEO_OUT ? path.resolve(process.env.SEO_OUT) : ROOT;
const OUT_DIR = path.join(OUT_BASE, 'product');
const SITE_BASE = 'https://mukarramkebra.github.io/Hardware-Website/';
const TODAY = new Date().toISOString().slice(0, 10);

// ── Supabase config (read from the site's own file — no separate secret) ────
function readSupabaseConfig() {
  const src = fs.readFileSync(path.join(ROOT, 'js', '01-config-data.js'), 'utf8');
  const urlM = src.match(/const\s+SB_URL\s*=\s*'([^']+)'/);
  const keyM = src.match(/const\s+SB_KEY\s*=\s*(?:atob\('([^']+)'\)|'([^']+)')/);
  if (!urlM || !keyM) throw new Error('Could not read SB_URL / SB_KEY from js/01-config-data.js');
  const SB_URL = urlM[1];
  const SB_KEY = keyM[1] ? Buffer.from(keyM[1], 'base64').toString('utf8') : keyM[2];
  return { SB_URL, SB_KEY };
}

async function sbGet(SB_URL, SB_KEY, query) {
  const res = await fetch(SB_URL + '/rest/v1/' + query, {
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
  });
  if (!res.ok) throw new Error('Supabase ' + query + ' -> HTTP ' + res.status);
  return res.json();
}

// ── Load everything the pages need, from Supabase or a local fixture ────────
async function loadData() {
  if (process.env.SEO_FIXTURE) {
    const fx = JSON.parse(fs.readFileSync(process.env.SEO_FIXTURE, 'utf8'));
    return {
      products: fx.products || [],
      photos: fx.photos || [],
      hidden: fx.hidden || [],
      stock: fx.stock || [],
      reviews: fx.reviews || [],
      skuMap: fx.skuMap || {},
      brandMap: fx.brandMap || {},
      keywords: fx.keywords || {},
      hiddenPrices: fx.hiddenPrices || {}
    };
  }
  const { SB_URL, SB_KEY } = readSupabaseConfig();
  const [products, photos, hidden, stock, reviews, settings] = await Promise.all([
    sbGet(SB_URL, SB_KEY, 'expert_products?select=*'),
    sbGet(SB_URL, SB_KEY, 'expert_photos?select=product_id,img_url'),
    sbGet(SB_URL, SB_KEY, 'expert_hidden?select=product_id'),
    sbGet(SB_URL, SB_KEY, 'expert_stock?select=product_id,qty'),
    sbGet(SB_URL, SB_KEY, 'expert_reviews?select=product_id,rating'),
    sbGet(SB_URL, SB_KEY, 'expert_settings?key=in.(sku_map,brand_map,product_keywords,hidden_prices)&select=key,value')
  ]);
  const settingVal = (k) => {
    const row = settings.find((s) => s.key === k);
    if (!row || !row.value) return {};
    try { return JSON.parse(row.value) || {}; } catch (_) { return {}; }
  };
  return {
    products, photos, hidden, stock, reviews,
    skuMap: settingVal('sku_map'),
    brandMap: settingVal('brand_map'),
    keywords: settingVal('product_keywords'),
    hiddenPrices: settingVal('hidden_prices')
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────
// slugify + productSlug are mirrored verbatim in js/02-catalog-render.js so the
// storefront's card links point at exactly the files this script writes.
function slugify(s) {
  return String(s == null ? '' : s)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80)
    .replace(/-+$/, '');
}
// A trailing "-<id>" guarantees a unique, collision-free URL without needing a
// global dedupe pass, and lets the client compute the identical slug from just
// the product's name + id. Arabic / empty names fall back to "product-<id>".
function productSlug(p) {
  return (slugify(p.name) || 'product') + '-' + p.id;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function isHttp(u) { return typeof u === 'string' && (u.startsWith('http://') || u.startsWith('https://')); }
function clip(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; }

function skuLabel(id, skuMap) {
  const val = skuMap[String(id)];
  if (val === undefined || val === null || val === '') return 'SKU-' + String(id).padStart(4, '0');
  return /^\d{1,4}$/.test(String(val)) ? 'SKU-' + String(val).padStart(4, '0') : String(val);
}

// ── Page template ───────────────────────────────────────────────────────────
function renderPage(p) {
  const url = SITE_BASE + 'product/' + p.slug + '.html';
  const brandTxt = (p.brand && p.brand !== 'Generic') ? p.brand : '';
  const catTxt = (p.category || '').replace(/-/g, ' ');
  const titleName = brandTxt ? p.name + ' — ' + brandTxt : p.name;
  const title = clip(titleName, 65) + ' | Expert Hardware Kuwait';
  const descBase = p.desc
    ? p.desc
    : [brandTxt, p.name, catTxt ? 'in ' + catTxt : '', 'Buy from Expert Hardware, a wholesale & retail hardware store in Kuwait City.']
        .filter(Boolean).join(' ');
  const metaDesc = clip(descBase, 155);
  const priceShown = (p.price > 0 && !p.priceHidden);
  const inStock = p.availability !== 'out-of-stock';
  const ogImage = isHttp(p.image) ? p.image : SITE_BASE + 'logo.png';

  // JSON-LD Product — same shape as _injectProductSchema() in the storefront
  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.desc || undefined,
    sku: p.sku,
    brand: brandTxt ? { '@type': 'Brand', name: brandTxt } : undefined,
    category: p.category || undefined,
    keywords: p.keywords || undefined,
    image: isHttp(p.image) ? p.image : undefined,
    aggregateRating: (p.reviewCount > 0) ? {
      '@type': 'AggregateRating',
      ratingValue: Math.round(p.reviewAvg * 10) / 10,
      reviewCount: p.reviewCount
    } : undefined,
    offers: priceShown ? {
      '@type': 'Offer',
      priceCurrency: 'KWD',
      price: p.price,
      priceValidUntil: new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10),
      itemCondition: 'https://schema.org/NewCondition',
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: url
    } : undefined
  };
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_BASE },
      { '@type': 'ListItem', position: 2, name: p.name, item: url }
    ]
  };
  const jsonld = (o) => JSON.stringify(o, (k, v) => v === undefined ? undefined : v);

  const priceHtml = priceShown
    ? `<p class="p-price">${p.price.toFixed(3)} <span>KWD</span></p>`
    : `<p class="p-price p-ask">Price on request</p>`;
  const availHtml = priceShown
    ? `<p class="p-avail ${inStock ? 'in' : 'out'}">${inStock ? '✔ In stock' : '✖ Out of stock'}</p>`
    : '';
  const imgHtml = `<img class="p-img" src="${esc(ogImage)}" alt="${esc(p.name)}" width="480" height="480" />`;

  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(metaDesc)}" />
  <link rel="canonical" href="${esc(url)}" />
  <meta name="robots" content="index, follow" />
  <meta property="og:type" content="product" />
  <meta property="og:site_name" content="Expert Hardware" />
  <meta property="og:title" content="${esc(titleName)}" />
  <meta property="og:description" content="${esc(metaDesc)}" />
  <meta property="og:url" content="${esc(url)}" />
  <meta property="og:image" content="${esc(ogImage)}" />
  ${priceShown ? `<meta property="product:price:amount" content="${p.price}" />
  <meta property="product:price:currency" content="KWD" />` : ''}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(titleName)}" />
  <meta name="twitter:description" content="${esc(metaDesc)}" />
  <meta name="twitter:image" content="${esc(ogImage)}" />
  <link rel="icon" type="image/png" href="../favicon.png" />
  <link rel="stylesheet" href="../css/01-base.css" />
  <script type="application/ld+json">${jsonld(product)}</script>
  <script type="application/ld+json">${jsonld(breadcrumb)}</script>
  <style>
    body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1a1a;background:#f6f7f9}
    .p-header{display:flex;align-items:center;gap:10px;padding:14px 20px;background:#fff;border-bottom:1px solid #e5e7eb}
    .p-header img{height:34px;width:auto}
    .p-header a{display:flex;align-items:center;gap:10px;text-decoration:none;color:#c8151b;font-weight:800;font-size:18px}
    main{max-width:960px;margin:0 auto;padding:22px 20px 60px}
    .crumb{font-size:13px;color:#6b7280;margin:4px 0 18px}
    .crumb a{color:#6b7280;text-decoration:none}
    .p-wrap{display:flex;gap:32px;flex-wrap:wrap;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:24px}
    .p-img{width:min(420px,100%);height:auto;object-fit:contain;border-radius:10px;background:#fafafa;border:1px solid #eee}
    .p-info{flex:1;min-width:260px}
    .p-brand{font-size:12px;font-weight:700;letter-spacing:.5px;color:#c8151b;text-transform:uppercase;margin:0 0 6px}
    h1{font-size:26px;line-height:1.25;margin:0 0 8px}
    .p-sku{font-size:12px;color:#9ca3af;margin:0 0 14px}
    .p-price{font-size:28px;font-weight:800;margin:0 0 4px}
    .p-price span{font-size:15px;font-weight:600;color:#6b7280}
    .p-price.p-ask{font-size:18px;color:#6b7280}
    .p-avail{font-size:14px;font-weight:700;margin:0 0 16px}
    .p-avail.in{color:#16a34a}.p-avail.out{color:#dc2626}
    .p-desc{font-size:15px;line-height:1.7;color:#374151;margin:0 0 22px;white-space:pre-line}
    .p-btn{display:inline-block;background:#c8151b;color:#fff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:10px;font-size:15px}
    .p-back{display:inline-block;margin-left:14px;color:#6b7280;text-decoration:none;font-size:14px}
    footer{max-width:960px;margin:0 auto;padding:24px 20px;color:#6b7280;font-size:13px;line-height:1.7}
    @media(max-width:640px){.p-wrap{padding:16px}h1{font-size:22px}}
  </style>
</head>
<body>
  <header class="p-header">
    <a href="../"><img src="../logo.png" alt="Expert Hardware Kuwait" />Expert Hardware</a>
  </header>
  <main>
    <nav class="crumb"><a href="../">Home</a> &rsaquo; ${esc(catTxt || 'Products')} &rsaquo; ${esc(clip(p.name, 40))}</nav>
    <div class="p-wrap">
      ${imgHtml}
      <div class="p-info">
        ${brandTxt ? `<p class="p-brand">${esc(brandTxt)}</p>` : ''}
        <h1>${esc(p.name)}</h1>
        <p class="p-sku">${esc(p.sku)}</p>
        ${priceHtml}
        ${availHtml}
        ${p.desc ? `<div class="p-desc">${esc(p.desc)}</div>` : ''}
        <a class="p-btn" href="../?q=${encodeURIComponent(p.name)}">View in store &amp; order &rarr;</a>
        <a class="p-back" href="../">&larr; Back to all products</a>
      </div>
    </div>
    <footer>
      <strong>Expert Hardware</strong> — wholesale &amp; retail hardware store in Kuwait City.
      Hand tools, power tools, welding machines, fasteners, safety gear and more.
      <br />This page is a catalog listing; browse the full store to order.
    </footer>
  </main>
</body>
</html>
`;
}

// ── Sitemap ──────────────────────────────────────────────────────────────────
function renderSitemap(products) {
  const urls = [
    `  <url>\n    <loc>${SITE_BASE}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`
  ];
  for (const p of products) {
    urls.push(
      `  <url>\n    <loc>${SITE_BASE}product/${p.slug}.html</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
    );
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const data = await loadData();

  const hiddenSet = new Set((data.hidden || []).map((r) => r.product_id));
  const stockMap = {};
  (data.stock || []).forEach((r) => { stockMap[r.product_id] = r.qty; });
  const photoMap = {};
  (data.photos || []).forEach((r) => { if (isHttp(r.img_url)) photoMap[r.product_id] = r.img_url; });
  const reviewAgg = {};
  (data.reviews || []).forEach((r) => {
    const a = reviewAgg[r.product_id] || (reviewAgg[r.product_id] = { total: 0, count: 0 });
    a.total += r.rating; a.count++;
  });

  // Match the storefront's getAllProducts() visibility rules: not hidden, and
  // custom products keep IDs > 60 (IDs 1-60 are reserved base slots).
  const built = [];
  const seenSlug = new Set();
  let skipped = 0;
  for (const row of (data.products || [])) {
    const id = row.id;
    const name = (row.name || '').trim();
    if (!name) { skipped++; continue; }
    if (row.hidden === true) { skipped++; continue; }
    if (hiddenSet.has(id)) { skipped++; continue; }
    if (!(id > 60)) { skipped++; continue; }

    const rawImg = photoMap[id] || row.img_url || row.image || row.img || '';
    const qty = (stockMap[id] !== undefined) ? stockMap[id] : null;
    const rv = reviewAgg[id];
    let slug = productSlug({ name, id });
    // Defensive: id suffix already makes this unique, but guard anyway.
    while (seenSlug.has(slug)) slug += '-x';
    seenSlug.add(slug);

    built.push({
      id, name, slug,
      brand: data.brandMap[String(id)] || row.brand || '',
      category: (row.category || '').toLowerCase().replace(/[\s_]+/g, '-'),
      price: parseFloat(row.price) || 0,
      priceHidden: !!data.hiddenPrices[String(id)],
      desc: row.description || row.desc || '',
      image: rawImg,
      sku: skuLabel(id, data.skuMap),
      keywords: data.keywords[String(id)] || '',
      availability: (qty !== null && qty <= 0) ? 'out-of-stock' : 'in-stock',
      reviewAvg: rv ? rv.total / rv.count : 0,
      reviewCount: rv ? rv.count : 0
    });
  }

  built.sort((a, b) => a.id - b.id);

  // Clear stale pages so products deleted in Supabase don't leave orphan files.
  // Wrapped because some mounts (e.g. the Cowork sandbox) block unlink; there,
  // we just overwrite in place — CI runs on a normal FS where this succeeds.
  try { fs.rmSync(OUT_DIR, { recursive: true, force: true }); } catch (_) {}
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const p of built) {
    fs.writeFileSync(path.join(OUT_DIR, p.slug + '.html'), renderPage(p));
  }
  fs.writeFileSync(path.join(OUT_BASE, 'sitemap.xml'), renderSitemap(built));

  console.log(`Generated ${built.length} product pages into /product (skipped ${skipped}).`);
  console.log(`Wrote sitemap.xml with ${built.length + 1} URLs (homepage + products).`);
}

main().catch((e) => { console.error('generate-product-pages failed:', e.message); process.exit(1); });
