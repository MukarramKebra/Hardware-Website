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
  const [s, p, c, h, b, sk, bm] = await Promise.all([
    sbFetch(SB_URL + '/rest/v1/expert_stock?select=*',                         { headers: SB_H }),
    sbFetch(SB_URL + '/rest/v1/expert_photos?select=*',                        { headers: SB_H }),
    sbFetch(SB_URL + '/rest/v1/expert_products?select=*',                        { headers: SB_H }),
    sbFetch(SB_URL + '/rest/v1/expert_hidden?select=product_id',               { headers: SB_H }),
    sbFetch(SB_URL + '/rest/v1/expert_banners?select=*&order=id.asc',          { headers: SB_H }),
    sbFetch(SB_URL + '/rest/v1/expert_settings?key=eq.sku_map&select=value',   { headers: SB_H }),
    sbFetch(SB_URL + '/rest/v1/expert_settings?key=eq.brand_map&select=value', { headers: SB_H })
  ]);
  if (!sk.error && Array.isArray(sk.data) && sk.data[0] && sk.data[0].value) {
    try { _sbSkuMap = JSON.parse(sk.data[0].value) || {}; } catch(e) {}
  }
  if (!bm.error && Array.isArray(bm.data) && bm.data[0] && bm.data[0].value) {
    try { _sbBrandMap = JSON.parse(bm.data[0].value) || {}; } catch(e) {}
  }
  if (s.error) {
    console.warn('Supabase offline — using localStorage fallback');
    try { _sbStock  = JSON.parse(localStorage.getItem('jain_stock')  || '{}'); } catch(_) {}
    try { _sbPhotos = JSON.parse(localStorage.getItem('jain_photos') || '{}'); } catch(_) {}
  } else {
    if (Array.isArray(s.data)) s.data.forEach(r => { _sbStock[r.product_id]  = r.qty; });
    if (Array.isArray(p.data)) p.data.forEach(r => { _sbPhotos[r.product_id] = r.img_url; });
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

