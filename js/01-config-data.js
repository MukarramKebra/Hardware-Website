const U   = (id) => `https://images.unsplash.com/photo-${id}?w=420&h=320&fit=crop&auto=format&q=80`;
const UL  = (id) => `Bahar-Products/SKU-${String(id).padStart(4,'0')}.jpg`;  // local product images

// ── SITE DISABLE CHECK ───────────────────────────────────────────────────
// Owner can close the site to visitors via the admin Owner Controls panel.
// This runs on every page load and shows a "closed" overlay if the flag is set.
(async function checkSiteStatus() {
  try {
    const SB_URL_CHK = 'https://qhebhvllkovfbkqrcnmm.supabase.co';
    const SB_KEY_CHK = atob('ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnBjM01pT2lKemRYQmhZbUZ6WlNJc0luSmxaaUk2SW5Gb1pXSm9kbXhzYTI5MlptSnJjWEpqYm0xdElpd2ljbTlzWlNJNkltRnViMjRpTENKcFlYUWlPakUzTnpZd05UZ3dNVGtzSW1WNGNDSTZNakE1TVRZek5EQXhPWDAuQVFsNVdBQjFfbWEzemNya1c0TkZLazZvQ0tCVWxUdGhENjh1amNTbG5hcw==');
    const res = await fetch(SB_URL_CHK + '/rest/v1/expert_settings?key=eq.site_disabled&select=value', {
      headers: { 'apikey': SB_KEY_CHK, 'Authorization': 'Bearer ' + SB_KEY_CHK }
    });
    if (!res.ok) return; // if table doesn't exist yet, skip quietly
    const data = await res.json();
    if (data && data.length && data[0].value === 'true') {
      // Site is disabled — inject and show a full-screen maintenance overlay
      const overlay = document.createElement('div');
      overlay.id = 'siteClosedOverlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:#0c2340;z-index:999999;display:flex;align-items:center;justify-content:center;flex-direction:column;font-family:Inter,sans-serif;';
      overlay.innerHTML = `
        <div style="text-align:center;padding:40px 24px;max-width:460px">
          <div style="font-size:64px;margin-bottom:20px">🚧</div>
          <div style="font-size:26px;font-weight:900;color:#fff;margin-bottom:10px">Site Temporarily Closed</div>
          <div style="font-size:15px;color:rgba(255,255,255,0.55);margin-bottom:28px;line-height:1.7">
            We are currently performing maintenance.<br>We'll be back shortly. Thank you for your patience.
          </div>
          <div style="font-size:15px;font-weight:800;color:#c8151b;line-height:1.3">EXPERT HARDWARE</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.3);margin-top:6px;">Kuwait — For Wholesale &amp; Retail Trade</div>
        </div>`;
      document.body.appendChild(overlay);
      // Prevent scrolling while closed
      document.body.style.overflow = 'hidden';
    }
  } catch(e) { /* Network error — site remains visible */ }
})();

// ── SEO SETTINGS (editable in admin → SEO tab) ────────────────────────────
// Overrides the title/description/keywords/OG tags that are baked into
// index.html for crawlers that don't run JS — this lets the owner edit them
// from admin without touching code or redeploying.
(async function applySEOSettings() {
  try {
    const SB_URL_CHK = 'https://qhebhvllkovfbkqrcnmm.supabase.co';
    const SB_KEY_CHK = atob('ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnBjM01pT2lKemRYQmhZbUZ6WlNJc0luSmxaaUk2SW5Gb1pXSm9kbXhzYTI5MlptSnJjWEpqYm0xdElpd2ljbTlzWlNJNkltRnViMjRpTENKcFlYUWlPakUzTnpZd05UZ3dNVGtzSW1WNGNDSTZNakE1TVRZek5EQXhPWDAuQVFsNVdBQjFfbWEzemNya1c0TkZLazZvQ0tCVWxUdGhENjh1amNTbG5hcw==');
    const res = await fetch(SB_URL_CHK + '/rest/v1/expert_settings?key=eq.seo_settings&select=value', {
      headers: { 'apikey': SB_KEY_CHK, 'Authorization': 'Bearer ' + SB_KEY_CHK }
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!data || !data.length || !data[0].value) return;
    const seo = JSON.parse(data[0].value);
    if (seo.title) {
      document.title = seo.title;
      const ogTitle = document.querySelector('meta[property="og:title"]');
      const twTitle = document.querySelector('meta[name="twitter:title"]');
      if (ogTitle) ogTitle.setAttribute('content', seo.title);
      if (twTitle) twTitle.setAttribute('content', seo.title);
    }
    if (seo.description) {
      const desc   = document.querySelector('meta[name="description"]');
      const ogDesc = document.querySelector('meta[property="og:description"]');
      const twDesc = document.querySelector('meta[name="twitter:description"]');
      if (desc)   desc.setAttribute('content', seo.description);
      if (ogDesc) ogDesc.setAttribute('content', seo.description);
      if (twDesc) twDesc.setAttribute('content', seo.description);
    }
    if (seo.keywords) {
      const kw = document.querySelector('meta[name="keywords"]');
      if (kw) kw.setAttribute('content', seo.keywords);
    }
  } catch(e) { /* Network error — static meta tags in index.html remain as fallback */ }
})();

// ── SKU HELPER ────────────────────────────────────────────────────────────
// SKU is a separate display label from the internal product ID.
// Real SKUs live in Supabase (expert_settings key 'sku_map', loaded into
// _sbSkuMap by loadSBData) so every visitor sees them — localStorage is only
// a fallback for SKUs set before the cloud sync existed.
var _sbSkuMap = {};
function getProductSku(id) {
  var val = _sbSkuMap[String(id)];
  if (val === undefined) {
    try { val = JSON.parse(localStorage.getItem('jain_sku_map') || '{}')[String(id)]; } catch(e) {}
  }
  if (val === undefined || val === null || val === '') return 'SKU-' + String(id).padStart(4, '0');
  // legacy numeric labels keep the padded style; real catalogue SKUs (75721, P-43561…) show as-is
  return /^\d{1,4}$/.test(String(val)) ? 'SKU-' + String(val).padStart(4, '0') : 'SKU: ' + val;
}

// ── SUPABASE CONFIG ───────────────────────────────────────────────────────
const SB_URL = 'https://qhebhvllkovfbkqrcnmm.supabase.co';
const SB_KEY = atob('ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnBjM01pT2lKemRYQmhZbUZ6WlNJc0luSmxaaUk2SW5Gb1pXSm9kbXhzYTI5MlptSnJjWEpqYm0xdElpd2ljbTlzWlNJNkltRnViMjRpTENKcFlYUWlPakUzTnpZd05UZ3dNVGtzSW1WNGNDSTZNakE1TVRZek5EQXhPWDAuQVFsNVdBQjFfbWEzemNya1c0TkZLazZvQ0tCVWxUdGhENjh1amNTbG5hcw==');
const SB_H   = { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY };

// ── SUPABASE FETCH WRAPPER ────────────────────────────────────────────────
// Returns { data, error } — no try/catch needed anywhere else
async function sbFetch(url, options) {
  try {
    const res  = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { data: null, error: (data && (data.error || data.message)) || ('HTTP ' + res.status) };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e.message };
  }
}

// Live data loaded from Supabase (falls back to localStorage if offline)
let _sbStock    = {};
let _sbPhotos   = {};
let _customProds = [];      // admin-added products from jain_products table
let _hiddenIds   = new Set(); // base product IDs hidden by admin
let _sbBanners   = [];       // admin-managed side banners (brand + img_url)
let _sbBrandMap  = {};       // product id -> brand name, set from admin

async function loadSBData() {
  // Photos (expert_photos) carries every product's full image as base64 —
  // several MB total — and Supabase's free tier can take up to a minute to
  // respond on its first request after being idle-paused. Fetching it inside
  // the same Promise.all as everything else meant the ENTIRE page (names,
  // prices, stock) sat blank until that one slow call finished. It's now
  // fetched separately so the rest of the page renders immediately; photos
  // fill in — starting from whatever was cached last visit — once ready.
  try { _sbPhotos = JSON.parse(localStorage.getItem('jain_photos') || '{}'); } catch(_) {}

  const [s, c, h, b, sk, bm, mc] = await Promise.all([
    sbFetch(SB_URL + '/rest/v1/expert_stock?select=*',                         { headers: SB_H }),
    sbFetch(SB_URL + '/rest/v1/expert_products?select=*',                        { headers: SB_H }),
    sbFetch(SB_URL + '/rest/v1/expert_hidden?select=product_id',               { headers: SB_H }),
    sbFetch(SB_URL + '/rest/v1/expert_banners?select=*&order=id.asc',          { headers: SB_H }),
    sbFetch(SB_URL + '/rest/v1/expert_settings?key=eq.sku_map&select=value',   { headers: SB_H }),
    sbFetch(SB_URL + '/rest/v1/expert_settings?key=eq.brand_map&select=value', { headers: SB_H }),
    sbFetch(SB_URL + '/rest/v1/expert_settings?key=eq.multi_cats&select=value',{ headers: SB_H })
  ]);
  if (!sk.error && Array.isArray(sk.data) && sk.data[0] && sk.data[0].value) {
    try { _sbSkuMap = JSON.parse(sk.data[0].value) || {}; } catch(e) {}
  }
  if (!bm.error && Array.isArray(bm.data) && bm.data[0] && bm.data[0].value) {
    try { _sbBrandMap = JSON.parse(bm.data[0].value) || {}; } catch(e) {}
  }
  if (!mc.error && Array.isArray(mc.data) && mc.data[0] && mc.data[0].value) {
    try { window._sbMultiCats = JSON.parse(mc.data[0].value) || {}; } catch(e) {}
  }
  if (s.error) {
    console.warn('Supabase offline — using localStorage fallback');
    try { _sbStock  = JSON.parse(localStorage.getItem('jain_stock')  || '{}'); } catch(_) {}
  } else {
    if (Array.isArray(s.data)) s.data.forEach(r => { _sbStock[r.product_id]  = r.qty; });
    if (Array.isArray(c.data) && c.data.length > 0) _customProds = c.data.filter(r => !r.hidden);
    if (Array.isArray(h.data)) {
      var hidSet = new Set(h.data.map(r => r.product_id));
      // Safety: if more than 55 of the 60 base products are "hidden", ignore — likely stale data
      if (hidSet.size < 55) _hiddenIds = hidSet;
    }
    if (Array.isArray(b.data) && b.data.length > 0) _sbBanners = b.data;
  }
  renderProducts();
  if (typeof initSideBanners === 'function') initSideBanners();
  if (typeof _injectProductSchema === 'function') _injectProductSchema();

  // Photos load separately and re-render once ready (see comment above) —
  // products already show real names/prices/stock immediately either way.
  sbFetch(SB_URL + '/rest/v1/expert_photos?select=*', { headers: SB_H }).then(function(p) {
    if (Array.isArray(p.data)) {
      p.data.forEach(function(r) { _sbPhotos[r.product_id] = r.img_url; });
      localStorage.setItem('jain_photos', JSON.stringify(_sbPhotos));
      renderProducts();
      if (typeof _injectProductSchema === 'function') _injectProductSchema();
    }
  });
}

// Normalise category strings so "powertools", "power tools", "Power Tools" etc.
// all map to the hyphenated slug used by the filter pills
function normalizeCategory(raw) {
  const c = (raw || '').toLowerCase().replace(/[\s_]+/g, '-').trim();
  const map = {
    'handtools':    'hand-tools',
    'hand':         'hand-tools',
    'safety-gear':  'safety',
    'safetygear':   'safety',
    // old category slugs -> the Expert Hardware category set
    'powertools':      'tools',
    'power':           'tools',
    'power-tools':     'tools',
    'fasteners':       'fastener',
    'measuring':       'hand-tools',
    'measuring-tools': 'hand-tools',
    'measuringtools':  'hand-tools',
    'cutting':         'hand-tools',
    'cutting-tools':   'hand-tools',
    'cuttingtools':    'hand-tools',
    'accessories':     'hardware',
    'tool-storage':    'hardware',
    'toolstorage':     'hardware',
    'storage':         'hardware',
    'adhesive':        'spray-adhesive',
    'adhesives':       'spray-adhesive'
  };
  return map[c] || c;
}

// Merged base + admin-added products, with hidden ones removed
function getAllProducts() {
  const baseIds = new Set(PRODUCTS.map(p => p.id));  // IDs 1-60 are authoritative
  // normalizeCategory maps the old built-in slugs (power-tools, fasteners, …)
  // onto the Expert Hardware category set so these stay filterable
  const base  = PRODUCTS.filter(p => !_hiddenIds.has(p.id))
    .map(p => Object.assign({}, p, { category: normalizeCategory(p.category), brand: _sbBrandMap[String(p.id)] || p.brand || '' }));
  // Only show custom products with safe IDs > 60 (ID fix in admin handles conflicts)
  const extra = _customProds.filter(p => !baseIds.has(p.id) && p.id > 60).map(p => ({
    id:       p.id,
    name:     p.name,
    category: normalizeCategory(p.category),
    price:    parseFloat(p.price),
    img:      p.img_url || p.img || `https://picsum.photos/seed/dt${p.id}/420/320`,
    desc:     p.description || p.desc || '',
    badge:    p.badge || null,
    brand:    _sbBrandMap[String(p.id)] || '',
    stock:    'in-stock'
  }));
  return [...base, ...extra];
}

const PRODUCTS = [];

// ── ARABIC PRODUCT TRANSLATIONS ───────────────────────────────────────────
var _AR_PRODUCTS = {};

// Arabic category display names
var _AR_CATS = {
  'tools':            'عدد كهربائية DCK',
  'hand-tools':       'عدد يدوية',
  'fastener':         'مسامير وبراغي',
  'construction':     'مسامير وأسلاك',
  'safety':           'معدات السلامة',
  'spray-adhesive':   'لواصق ومواد لاصقة',
  'tape':             'أشرطة لاصقة',
  'door-handle':      'مقابض الأبواب',
  'hardware':         'أدوات معدنية',
  'paint-tool':       'أدوات الدهان',
  'gardening':        'أدوات الحديقة',
  'disc':             'أقراص القطع والجلخ',
  'trolley-caster':   'عربات وعجلات',
  'household':        'أدوات التنظيف',
  'plumbing-fitting': 'تمديدات السباكة',
  'sanitary':         'أدوات صحية',
  'filter':           'فلاتر'
};

let cart = [];
let activeFilter = 'all';

