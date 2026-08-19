const U   = (id) => `https://images.unsplash.com/photo-${id}?w=420&h=320&fit=crop&auto=format&q=80`;
const UL  = (id) => `Bahar-Products/SKU-${String(id).padStart(4,'0')}.jpg`;  // local product images

// ── SITE DISABLE CHECK ───────────────────────────────────────────────────
// Owner can close the site to visitors via the admin Owner Controls panel.
// This runs on every page load and shows a "closed" overlay if the flag is set.
(async function checkSiteStatus() {
  try {
    const SB_URL_CHK = 'https://qhebhvllkovfbkqrcnmm.supabase.co';
    const SB_KEY_CHK = atob('c2JfcHVibGlzaGFibGVfakN3cnAteTE2VFdWblg4QWszcjFtd19laEtBU2lwZA==');
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
    const SB_KEY_CHK = atob('c2JfcHVibGlzaGFibGVfakN3cnAteTE2VFdWblg4QWszcjFtd19laEtBU2lwZA==');
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
const SB_KEY = atob('c2JfcHVibGlzaGFibGVfakN3cnAteTE2VFdWblg4QWszcjFtd19laEtBU2lwZA==');
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

// Supabase's PostgREST caps any unpaginated "select=*" query at 1000 rows by
// default. The catalog just crossed 1000 products, so a plain sbFetch() on
// expert_products/expert_stock/etc silently truncates — newest rows go
// missing from the live site with no error. sbFetchAll() pages through with
// limit/offset until a page comes back short, and returns the same
// { data, error } shape as sbFetch() so every existing call site keeps working.
async function sbFetchAll(baseUrl, headers) {
  const pageSize = 1000;
  let offset = 0;
  let all = [];
  while (true) {
    const sep = baseUrl.includes('?') ? '&' : '?';
    const { data, error } = await sbFetch(baseUrl + sep + 'limit=' + pageSize + '&offset=' + offset, { headers });
    if (error) return { data: null, error };
    if (!Array.isArray(data)) return { data, error: null };
    all = all.concat(data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return { data: all, error: null };
}

// Live data loaded from Supabase (falls back to localStorage if offline)
let _sbStock    = {};
let _sbPhotos   = {};
let _customProds = [];      // admin-added products from jain_products table
let _hiddenIds   = new Set(); // base product IDs hidden by admin
let _sbBanners   = [];       // admin-managed side banners (brand + img_url)
let _sbBrandMap  = {};       // product id -> brand name, set from admin
let _sbProductKeywords = {}; // product id -> SEO keyword phrases, set from admin
window._sbPriceHidden = {};  // product id -> true if price is manually hidden (Ask Price on WhatsApp instead)
window._sbQtyLimits = {};    // product id -> { min, max } order quantity, set from admin (0 = no limit)
function getQtyLimits(id) { return (window._sbQtyLimits || {})[id] || { min: 0, max: 0 }; }
// product id -> [{ label, price }] size/pack options ("accolades") shown as a
// dropdown on the product; price is optional — options without one sell at
// the product's own price
window._sbVariants = {};
function getVariants(id) {
    var v = (window._sbVariants || {})[id];
    return Array.isArray(v) ? v : [];
}
// Single source of truth for "does this product show a real price / Add to
// Cart UI, or Price on request / Ask Price on WhatsApp" — both the grid card
// and the product modal branch on this exact condition, plus reuse it to
// decide whether a variant option's own price suffix is safe to show.
function hasVisiblePrice(p) {
    return p.price > 0 && !window._sbPriceHidden[p.id];
}

// ── FEATURED SALE % ───────────────────────────────────────────────────────
// The per-product Sale % set in admin's Featured tab (expert_settings
// 'featured_offers', { id, sale } entries) is a real, site-wide discount —
// it applies wherever that product's price is shown or charged (grid card,
// product page, cart/checkout), not just the homepage strip. p.price itself
// is never modified; this only affects what's displayed/charged at runtime.
function getFeaturedSale(id) {
    var items = window._sbFeaturedOffers;
    if (!Array.isArray(items)) return 0;
    var item = items.find(function(x) { return x.id === id; });
    return (item && item.sale > 0) ? item.sale : 0;
}
function applySale(price, id) {
    if (!(price > 0) || (window._sbPriceHidden || {})[id]) return price;
    var sale = getFeaturedSale(id);
    return sale > 0 ? price * (1 - sale / 100) : price;
}

async function loadSBData() {
    // Photos (expert_photos) used to carry every product's full image as
  // base64 — several MB total, slow enough on Supabase's free tier that it
  // was split into its own delayed fetch so the rest of the page didn't sit
  // blank waiting for it. Photos are now just lightweight URL strings
  // (~25KB for all 200 products), so it's back in the same batch as
  // everything else — this also means the SEO product schema below is
  // complete on the very first render instead of missing images until a
  // second pass, which is what Google's Merchant Listings report was flagging.
  try { _sbPhotos = JSON.parse(localStorage.getItem('jain_photos') || '{}'); } catch(_) {}

  // All the per-key settings rows (hidden_prices, featured_offers, sku_map,
  // brand_map, multi_cats, product_keywords, qty_limits, product_variants)
  // used to be EIGHT separate requests — each a full round trip to Supabase
  // (700ms-1.7s measured), and the browser's ~6-connection cap per origin
  // meant most of them queued behind each other instead of truly running in
  // parallel. One key=in.(...) request returns all of them in a single trip.
  const productsP = sbFetchAll(SB_URL + '/rest/v1/expert_products?select=*', SB_H);
  const photosP   = sbFetchAll(SB_URL + '/rest/v1/expert_photos?select=*',   SB_H);
  const settingsP = sbFetch(SB_URL + '/rest/v1/expert_settings?key=in.(hidden_prices,featured_offers,sku_map,brand_map,multi_cats,product_keywords,qty_limits,product_variants,cat_labels,cat_hidden,cat_order)&select=key,value', { headers: SB_H });

  const stockP   = sbFetchAll(SB_URL + '/rest/v1/expert_stock?select=*',           SB_H);
  const hiddenP  = sbFetchAll(SB_URL + '/rest/v1/expert_hidden?select=product_id', SB_H);
  const bannersP = sbFetchAll(SB_URL + '/rest/v1/expert_banners?select=*&order=id.asc', SB_H);
  const reviewsP  = sbFetchAll(SB_URL + '/rest/v1/expert_reviews?select=product_id,rating', SB_H);

  // The offers ticker used to wait on the SAME Promise.all as the full
  // 1577+ row product catalog below (productsP) — by far the slowest of the
  // three requests it was grouped with, so the ticker rendered a beat after
  // everything else on the page even though it only ever shows up to 40
  // cards. settingsP (a handful of small settings rows) resolves much
  // sooner; as soon as it does, fetch ONLY the featured-offer products by id
  // — a small targeted request, not the whole catalog — and render the
  // ticker right away. The authoritative Promise.all below still re-renders
  // it once the real full catalog is in, so this is a head start, not a
  // separate source of truth; if it loses the race to the full fetch (fast
  // network) the guard below just makes it a no-op.
  settingsP.then(async function(st) {
    if (st.error || !Array.isArray(st.data)) return;
    var byKey = {};
    st.data.forEach(function(row) { byKey[row.key] = row.value; });
    function early(key, fb) { try { return JSON.parse(byKey[key]) || fb; } catch(e) { return fb; } }
    window._sbFeaturedOffers = early('featured_offers', []).map(function(x) {
      return (typeof x === 'number') ? { id: x, sale: 0 } : { id: x.id, sale: x.sale || 0 };
    });
    window._sbPriceHidden = early('hidden_prices', {});
    if (_customProds.length || !window._sbFeaturedOffers.length) return; // full catalog already won the race, or nothing to show
    var ids = window._sbFeaturedOffers.map(function(o) { return o.id; });
    var tp = await sbFetch(SB_URL + '/rest/v1/expert_products?select=*&id=in.(' + ids.join(',') + ')', { headers: SB_H });
    if (!tp.error && Array.isArray(tp.data) && tp.data.length && !_customProds.length) {
      _customProds = tp.data.filter(function(r) { return !r.hidden; });
      _invalidateAllProductsCache();
      if (typeof initOffersTicker === 'function') initOffersTicker();
    }
  });

  const [c, ph, st] = await Promise.all([productsP, photosP, settingsP]);

  if (Array.isArray(c.data) && c.data.length > 0) _customProds = c.data.filter(r => !r.hidden);
  _invalidateAllProductsCache();
  if (Array.isArray(ph.data)) {
        ph.data.forEach(function(r) { _sbPhotos[r.product_id] = r.img_url; });
        localStorage.setItem('jain_photos', JSON.stringify(_sbPhotos));
  }
  const _settingsByKey = {};
  if (!st.error && Array.isArray(st.data)) {
    st.data.forEach(function(row) { _settingsByKey[row.key] = row.value; });
  }
  function _settingJSON(key, fallback) {
    var raw = _settingsByKey[key];
    if (!raw) return fallback;
    try { return JSON.parse(raw) || fallback; } catch(e) { return fallback; }
  }
  window._sbPriceHidden = _settingJSON('hidden_prices', {});
  // Older saves stored plain product ids (no sale support yet) — migrate.
  window._sbFeaturedOffers = _settingJSON('featured_offers', []).map(function(x) {
    return (typeof x === 'number') ? { id: x, sale: 0 } : { id: x.id, sale: x.sale || 0 };
  });
  if (typeof initOffersTicker === 'function') initOffersTicker();

  _sbSkuMap = _settingJSON('sku_map', {});
  _sbBrandMap = _settingJSON('brand_map', {});
  window._sbMultiCats = _settingJSON('multi_cats', {});
  _sbProductKeywords = _settingJSON('product_keywords', {});
  window._sbQtyLimits = _settingJSON('qty_limits', {});
  window._sbVariants = _settingJSON('product_variants', {});
  // Category renames from the admin's category editor (drag-reorder tiles,
  // click a name to rename — see admin/js/05-categories.js) apply here too,
  // patching whatever static label is already in the page rather than
  // requiring the whole category nav to be rebuilt from JS.
  const catOrder = _settingJSON('cat_order', []);
  applyCatOrderOverride(catOrder);
  applyCatLabelOverrides(_settingJSON('cat_labels', {}));
  applyCatVisibilityOverrides(_settingJSON('cat_hidden', {}));
  // Cached so the very first paint on the NEXT visit can reorder the pill
  // row/tile grid synchronously (see the inline script right after them in
  // index.html) instead of showing the static HTML's built-in order for a
  // moment and then visibly jumping to the saved order once this async
  // fetch finally resolves.
  try { localStorage.setItem('cat_order_cache', JSON.stringify(catOrder)); } catch(e) {}

  const [s, h, b, rv] = await Promise.all([stockP, hiddenP, bannersP, reviewsP]);
  // Bulk review stats (avg + count per product) for the Product schema's
  // aggregateRating — fetched once here instead of per-product like
  // getAvgRating() in js/06-features.js, which is fine for the review-modal's
  // single lookup but would be one request per product for the whole catalog.
  window._sbReviewStats = {};
    if (Array.isArray(rv.data)) {
          var sums = {};
          rv.data.forEach(function(r) {
                  var s = sums[r.product_id] || (sums[r.product_id] = { total: 0, count: 0 });
                  s.total += r.rating; s.count++;
          });
          Object.keys(sums).forEach(function(id) {
                  window._sbReviewStats[id] = { avg: sums[id].total / sums[id].count, count: sums[id].count };
          });
    }
    if (s.error) {
          console.warn('Supabase offline — using localStorage fallback');
          try { _sbStock  = JSON.parse(localStorage.getItem('jain_stock')  || '{}'); } catch(_) {}
    } else {
          if (Array.isArray(s.data)) s.data.forEach(r => { _sbStock[r.product_id]  = r.qty; });
          if (Array.isArray(h.data)) {
                  var hidSet = new Set(h.data.map(r => r.product_id));
                  // Safety: if more than 55 of the 60 base products are "hidden", ignore — likely stale data
            if (hidSet.size < 55) _hiddenIds = hidSet;
          }
          if (Array.isArray(b.data) && b.data.length > 0) _sbBanners = b.data;
    }
    // _sbBrandMap and _hiddenIds may have changed since the cache was last
    // built above — invalidate once more before the first real grid render.
    _invalidateAllProductsCache();
    renderProducts();
    if (typeof initSideBanners === 'function') initSideBanners();
    if (typeof _injectProductSchema === 'function') _injectProductSchema();

  checkAssetVersion();
}

// ── ASSET VERSION CHECK ─────────────────────────────────────────────────────
// Lets admin's "Flush Cache" button force fresh JS/CSS onto every visitor,
// not just the admin's own browser: the current version lives in Supabase
// (expert_settings, key 'asset_version'). Each page load compares it in the
// background against what this browser last used; a mismatch means new
// files were deployed and flushed, so we save the new version and reload
// once to pick them up. No-op (just records the version) on a visitor's
// very first load, so nobody gets an unnecessary reload.
function checkAssetVersion() {
    sbFetch(SB_URL + '/rest/v1/expert_settings?key=eq.asset_version&select=value', { headers: SB_H }).then(function(r) {
          if (r.error || !r.data || !r.data[0] || !r.data[0].value) return;
          var serverV = r.data[0].value;
          var localV  = localStorage.getItem('expert_asset_v');
          if (!localV) { localStorage.setItem('expert_asset_v', serverV); return; }
          if (serverV !== localV) {
                  localStorage.setItem('expert_asset_v', serverV);
                  window.location.reload();
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

// Merged base + admin-added products, with hidden ones removed.
// Rebuilding this (a .filter+.map over all 1577+ products) used to happen
// on EVERY call — and it's called on every category click, search
// keystroke, and product lookup (21 call sites), several of them just to
// .find() a single product by id. That's what made opening a category feel
// slow, especially on phones. _customProds/_hiddenIds/_sbBrandMap only ever
// change inside loadSBData() (nothing on the storefront mutates them
// live), so the merged array is cached here and only rebuilt when
// _invalidateAllProductsCache() is called from those same few spots.
let _allProductsCache = null;
function _invalidateAllProductsCache() { _allProductsCache = null; }
function getAllProducts() {
    if (_allProductsCache) return _allProductsCache;
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
        // Finer-grained grouping within a category (e.g. "nails" inside
        // Nails/Wires), matched against expertshardware.com's own
        // subcategories. Optional — most products don't have one yet.
        subcategory: p.subcategory || '',
        price:    parseFloat(p.price),
        // No random stock-photo fallback (picsum) — if a product has no image
        // yet (e.g. photos still loading from Supabase), the card shows the
        // neutral tools icon instead of an unrelated internet photo.
        img:      p.img_url || p.img || '',
        desc:     p.description || p.desc || '',
        badge:    p.badge || null,
        brand:    _sbBrandMap[String(p.id)] || '',
        stock:    'in-stock'
  }));
    _allProductsCache = [...base, ...extra];
    return _allProductsCache;
}

const PRODUCTS = [];

// Subcategory display labels — matched against expertshardware.com's own
// subcategory names (e.g. Nails/Wires > Nails). Slugs not listed here just
// render title-cased from the slug (see subcatLabel() in 02-catalog-render.js),
// so a new subcategory works immediately even before a label is added.
var _SUBCAT_LABELS = {
    'nails':     'Nails',
    'tarp-mesh': 'Tarpaulin & Mesh',
    'wire':      'Wires & Electrodes',
    'gloves':    'Gloves',

    'hammer':       'Hammers',
    'measuring':    'Measuring Tools',
    'masonry':      'Masonry Tools',
    'hand-tool':    'Hand Tools',
    'woodworking':  'Woodworking',

    'zinc-handles':       'Zinc Handles',
    'iron-handles':       'Iron Handles',
    'aluminium-fittings': 'Aluminium Door Fittings',
    'door-fittings':      'Door Fittings',
    'pull-handles':       'Pull Handles',
    'hinges':             'Hinges',
    'cabinet-knobs':      'Cabinet Knobs',
    'rosette-handles':    'Rosette Handles',
    'drawer-slide':       'Drawer Slides',
    'shelf-support':      'Shelf Support',
    'cabinet-fittings':   'Cabinet Fittings',
    'lock':               'Locks',

    'faucets': 'Faucets',
    'pump':    'Pumps',
    'valves':  'Valves',
    'showers': 'Showers',
    'fixtures': 'Fixtures',

    'ppr':                  'PPR Pipes & Fittings',
    'pvc':                  'PVC Pipes & Fittings',
    'upvc':                 'UPVC Pipes & Fittings',
    'cpvc':                 'CPVC Pipes & Fittings',
    'chrome-tube-fittings': 'Chrome Tube & Fittings',

    'corded-tools':               'Corded Tools',
    'cordless-tools':             'Cordless Tools',
    'grinding-sanding-polishing': 'Grinding, Sanding & Polishing',
    'power-tools-accessories':    'Power Tool Accessories',
    'welding-machine-tools':      'Welding Machines & Tools',
    'drilling-fastening':         'Drilling & Fastening',
    'air-compressors':            'Air Compressors',

    'oil-filter':   'Oil Filters',
    'water-filter': 'Water Filters',

    'floor-cleaning': 'Floor Cleaning',

    'jacks-lifting':  'Jacks & Lifting',
    'garage-storage': 'Garage Storage',
    'diy-market':     'Magnetic Accessories',
    'car-lifts-tire': 'Car Lifts & Tire Machines',
    'e-vehicle':      'E-Vehicle'
};
var _AR_SUBCATS = {
    'nails':     'مسامير',
    'tarp-mesh': 'مشمع وشبك',
    'wire':      'أسلاك وأقطاب',
    'gloves':    'قفازات',

    'hammer':      'مطارق',
    'measuring':   'أدوات القياس',
    'masonry':     'أدوات البناء',
    'hand-tool':   'عدد يدوية',
    'woodworking': 'أدوات النجارة',

    'zinc-handles':       'مقابض زنك',
    'iron-handles':       'مقابض حديد',
    'aluminium-fittings': 'تجهيزات أبواب ألمنيوم',
    'door-fittings':      'تجهيزات الأبواب',
    'pull-handles':       'مقابض سحب',
    'hinges':             'مفصلات',
    'cabinet-knobs':      'مقابض خزائن',
    'rosette-handles':    'مقابض دائرية',
    'drawer-slide':       'سكك أدراج',
    'shelf-support':      'حوامل رفوف',
    'cabinet-fittings':   'تجهيزات خزائن',
    'lock':               'أقفال',

    'faucets':  'حنفيات',
    'pump':     'مضخات',
    'valves':   'صمامات',
    'showers':  'دشات',
    'fixtures': 'تجهيزات صحية',

    'ppr':                  'مواسير PPR',
    'pvc':                  'مواسير PVC',
    'upvc':                 'مواسير UPVC',
    'cpvc':                 'مواسير CPVC',
    'chrome-tube-fittings': 'مواسير وتجهيزات كروم',

    'corded-tools':               'عدد كهربائية سلكية',
    'cordless-tools':             'عدد كهربائية لاسلكية',
    'grinding-sanding-polishing': 'أدوات جلخ وصنفرة وتلميع',
    'power-tools-accessories':    'ملحقات العدد الكهربائية',
    'welding-machine-tools':      'ماكينات ومعدات لحام',
    'drilling-fastening':         'أدوات حفر وتثبيت',
    'air-compressors':            'ضواغط هواء',

    'oil-filter':   'فلاتر زيت',
    'water-filter': 'فلاتر مياه',

    'floor-cleaning': 'تنظيف الأرضيات',

    'jacks-lifting':  'رافعات',
    'garage-storage': 'تخزين الكراج',
    'diy-market':     'ملحقات مغناطيسية',
    'car-lifts-tire': 'روافع السيارات وأدوات الإطارات',
    'e-vehicle':      'المركبات الكهربائية'
};

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
    'filter':           'فلاتر',
    'marhaba':          'مرحبا',
    'big-red':          'بيج ريد'
};

let cart = [];
let activeFilter = 'all';
let activeSubFilter = 'all';
