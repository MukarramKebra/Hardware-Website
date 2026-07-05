/*
 * ============================================================
 *   Expert Hardware — ADMIN PANEL  (admin/index.html)
 * ============================================================
 *
 *  HOW IT WORKS (plain English):
 *  ─────────────────────────────
 *  1. LOGIN SCREEN
 *     • User types username + password.
 *     • "bahar"     → regular admin  → sees all tabs (Inventory, Orders, etc.)
 *     • "ultimate15" → owner/super   → same tabs + extra "Owner Controls" tab
 *     • Session is saved in localStorage (jain_auth) so refresh keeps you logged in.
 *
 *  2. DATA STORAGE
 *     • Products, stock, orders, photos are stored in Supabase (online database).
 *     • Some things (deleted items, settings) are stored in localStorage (browser).
 *     • Every time admin opens, it loads fresh data from Supabase.
 *
 *  3. TABS
 *     • Inventory   — View/edit all products, change stock, add/delete products
 *     • Analytics   — See which products are viewed and searched most
 *     • Deleted     — Recover deleted products or orders
 *     • Orders      — See customer orders, change status (pending/confirmed/delivered)
 *     • Reports     — Download Excel files of inventory, sales, and orders
 *     • Categories  — Change the banner images for each product category
 *     • Owner Controls (ultimate15 only) — disable/enable bahar account, undo bahar's actions
 *
 *  4. REPORTS / EXCEL
 *     • "Connect File" — links to a file on your computer (picks save location, no download)
 *     • "Download"     — writes the latest data into that Excel file
 *     • Auto-write happens every time you open the Reports tab (if file is connected)
 *
 *  5. AUDIT LOG (Owner Controls)
 *     • Every action bahar does (add/delete product, change stock, change order status)
 *       is recorded with a timestamp in localStorage (jain_audit_log).
 *     • "Undo All This Week" reverses all of bahar's actions from the last 7 days.
 *
 * ============================================================
 */

// ── LOGIN CREDENTIALS ──────────────────────────────────────────────────────────
// Change these to update usernames/passwords
const ADMIN_USER    = 'expert';       // Regular admin username
const ADMIN_PASS    = 'Kuw963258';   // Regular admin password
const SUPER_USER    = 'ultimate15';  // Owner (super-admin) username
const SUPER_PASS    = 'Zahab2011';   // Owner (super-admin) password
const MANAGER_USER  = 'expert15';     // Manager account — same powers as owner except cannot disable ultimate15 or site
const MANAGER_PASS  = 'Kuw963258';   // Manager password

// ── SUPABASE CONNECTION ────────────────────────────────────────────────────────
// Supabase is the online database where all products, stock, orders, photos live.
// SB_URL  = the database address
// SB_KEY  = the access key (like a password to talk to the database — read-only for public)
// SB_HDRS = the headers sent with every database request (authentication)
const SB_URL  = 'https://qhebhvllkovfbkqrcnmm.supabase.co';
const SB_KEY  = atob('ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnBjM01pT2lKemRYQmhZbUZ6WlNJc0luSmxaaUk2SW5Gb1pXSm9kbXhzYTI5MlptSnJjWEpqYm0xdElpd2ljbTlzWlNJNkltRnViMjRpTENKcFlYUWlPakUzTnpZd05UZ3dNVGtzSW1WNGNDSTZNakE1TVRZek5EQXhPWDAuQVFsNVdBQjFfbWEzemNya1c0TkZLazZvQ0tCVWxUdGhENjh1amNTbG5hcw==');
const SB_HDRS = { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };

// Default categories shown in the admin category filter dropdown
const DEFAULT_CATS = [
  { slug:'tools',            label:'DCK Power Tools' },
  { slug:'hand-tools',       label:'Hand Tools' },
  { slug:'fastener',         label:'Fasteners' },
  { slug:'construction',     label:'Nails/Wires' },
  { slug:'safety',           label:'Safety' },
  { slug:'spray-adhesive',   label:'Adhesives' },
  { slug:'tape',             label:'Tapes' },
  { slug:'door-handle',      label:'Door Handles' },
  { slug:'hardware',         label:'Hardware' },
  { slug:'paint-tool',       label:'Paint Tools' },
  { slug:'gardening',        label:'Garden Tools' },
  { slug:'disc',             label:'Discs' },
  { slug:'trolley-caster',   label:'Wheel Barrow' },
  { slug:'household',        label:'Cleaning' },
  { slug:'plumbing-fitting', label:'Fittings' },
  { slug:'sanitary',         label:'Sanitary Ware' },
  { slug:'filter',           label:'Filters' },
  // Admin-only category for non-purchasable/placeholder entries (e.g. items
  // scraped from a source catalog that aren't real products). Never appears
  // on the storefront — index.html's category grid/nav/pills don't reference
  // it — but it's a normal filterable category here, and products in it are
  // excluded from the low/out-of-stock alerts (see renderStats).
  { slug:'hidden',           label:'Hidden' }
];

// ── SUPABASE FETCH WRAPPER ─────────────────────────────────────────────────────
// encodeHtml — converts special characters so text is safe to show inside HTML
//              e.g. prevents product names with < or > from breaking the page
function encodeHtml(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/”/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
// sbFetch — the main function used for ALL database calls (get, add, update, delete)
//           Always returns { data, error } so we can check if it worked
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

// U  = placeholder image URL (used when a product has no real photo uploaded yet)
// UL = local product image path  (e.g. "product-images/1.jpg" stored in the repo)
const U  = id => 'https://picsum.photos/seed/' + id + '/80/80';
const UL = id => 'Bahar-Products/SKU-' + String(id).padStart(4, '0') + '.jpg';
// Neutral gray placeholder for products with no photo yet — never random
// internet stock photos (picsum), which made missing images look like
// completely wrong products.
const NO_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80' rx='8' fill='%23eef0f3'/><g stroke='%23b9bfc7' stroke-width='4' fill='none' stroke-linecap='round'><path d='M28 52 L52 28'/><circle cx='25' cy='55' r='7'/><circle cx='55' cy='25' r='7'/></g></svg>";

let _customProductRows = []; // products added by admin (fetched from Supabase jain_products table)
let _hiddenBaseIds     = new Set(); // IDs of base products that have been hidden from the store

// ── ID CONFLICT RESOLVER ─────────────────────────────────────────────────────
// Supabase auto-increment starts at 1, which conflicts with base product IDs 1-60.
// This function detects conflicts and re-inserts custom products with safe IDs (1001+).
async function _fixCustomProductIds() {
  const BASE_MAX = 60; // all custom products will get IDs > 60
  const baseNames = new Set(PRODUCTS.map(function(p){ return p.name.toLowerCase().trim(); }));
  const baseIds   = new Set(PRODUCTS.map(function(p){ return p.id; }));

  const conflicts = _customProductRows.filter(function(r){ return r.id <= BASE_MAX; });
  if (!conflicts.length) return; // nothing to fix

  console.log('[ID Fix] Resolving', conflicts.length, 'conflicting custom product IDs...');
  showToast('Fixing product IDs…');

  // Current max safe ID already in use
  // Next safe ID = max of all product IDs + 1 (sequential, no gap-filling)
  var allIds = PRODUCTS.map(function(p){return p.id;})
    .concat(_customProductRows.map(function(r){return r.id;}));
  var maxSafeId = allIds.reduce(function(m,id){return Math.max(m,id);}, BASE_MAX);

  for (var i = 0; i < conflicts.length; i++) {
    var p = conflicts[i];
    var isTrueDupe = baseIds.has(p.id) && baseNames.has((p.name||'').toLowerCase().trim());

    // 1. Delete old entry from Supabase
    await sbFetch(SB_URL + '/rest/v1/expert_products?id=eq.' + p.id, { method:'DELETE', headers:SB_HDRS });
    // Also clean up orphaned stock/photos for old ID
    await sbFetch(SB_URL + '/rest/v1/expert_stock?product_id=eq.' + p.id, { method:'DELETE', headers:SB_HDRS });

    // Remove from local array
    var idx = _customProductRows.findIndex(function(r){ return r.id === p.id; });
    if (idx >= 0) _customProductRows.splice(idx, 1);

    if (isTrueDupe) {
      console.log('[ID Fix] Deleted true duplicate:', p.name, '(was ID', p.id + ')');
      continue; // don't re-insert — it's a copy of a base product
    }

    // 2. Re-insert with a safe ID > 1000
    maxSafeId += 1;
    var payload = {
      id: maxSafeId,
      name: p.name,
      category: p.category,
      price: p.price,
      description: p.description || '',
      badge: p.badge || null,
      img_url: p.img_url || '',
      hidden: p.hidden || false
    };
    var result = await sbFetch(SB_URL + '/rest/v1/expert_products', {
      method: 'POST',
      headers: Object.assign({}, SB_HDRS, {'Prefer':'return=representation'}),
      body: JSON.stringify([payload])
    });
    if (result.data && result.data[0]) {
      _customProductRows.push(result.data[0]);
      // Migrate stock to new ID
      var oldQty = stockData[p.id] || 50;
      stockData[result.data[0].id] = oldQty;
      await sbFetch(SB_URL + '/rest/v1/expert_stock', {
        method: 'POST',
        headers: Object.assign({}, SB_HDRS, {'Prefer':'resolution=merge-duplicates'}),
        body: JSON.stringify([{ product_id: result.data[0].id, qty: oldQty }])
      });
      // Migrate photo to new ID
      var oldPhoto = null;
      try { var ph = JSON.parse(localStorage.getItem('jain_photos')||'{}'); oldPhoto = ph[String(p.id)]||null; } catch(_){}
      if (oldPhoto) {
        sbFetch(SB_URL + '/rest/v1/expert_photos', {
          method:'POST', headers:Object.assign({},SB_HDRS,{'Prefer':'resolution=merge-duplicates'}),
          body:JSON.stringify([{product_id:result.data[0].id, img_url:oldPhoto}])
        });
        // Update localStorage photo key
        try {
          var ph2 = JSON.parse(localStorage.getItem('jain_photos')||'{}');
          ph2[String(result.data[0].id)] = oldPhoto;
          delete ph2[String(p.id)];
          localStorage.setItem('jain_photos', JSON.stringify(ph2));
        } catch(_){}
      }
      console.log('[ID Fix] Moved', p.name, 'from ID', p.id, '→', result.data[0].id);
    } else {
      console.warn('[ID Fix] Failed to re-insert', p.name, result.error);
    }
  }
  if (conflicts.length) showToast('Products fixed ✓');
  // NOTE: No second pass — IDs do not need to be sequential. Non-sequential gaps are fine.
}

async function loadFromSupabase() {
  showToast('Loading from cloud…');
  // Photos (expert_photos) carries every product's full image as base64 —
  // several MB total — and Supabase's free tier can take up to a minute to
  // respond on its first request after being idle-paused. Fetching it inside
  // this same Promise.all meant the ENTIRE inventory table sat blank until
  // that one slow call finished (the "need to click Reload twice" symptom).
  // It's now fetched separately below so the table renders immediately;
  // thumbnails fill in once photos are ready.
  const [s, c, h, cb, sk, bm, mc, ia] = await Promise.all([
    sbFetch(SB_URL + '/rest/v1/expert_stock?select=*',          { headers: SB_HDRS }),
    sbFetch(SB_URL + '/rest/v1/expert_products?select=*',       { headers: SB_HDRS }),
    sbFetch(SB_URL + '/rest/v1/expert_hidden?select=product_id',{ headers: SB_HDRS }),
    sbFetch(SB_URL + '/rest/v1/expert_cat_bgs?select=*',        { headers: SB_HDRS }),
    sbFetch(SB_URL + '/rest/v1/expert_settings?key=eq.sku_map&select=value',    { headers: SB_HDRS }),
    sbFetch(SB_URL + '/rest/v1/expert_settings?key=eq.brand_map&select=value',  { headers: SB_HDRS }),
    sbFetch(SB_URL + '/rest/v1/expert_settings?key=eq.multi_cats&select=value', { headers: SB_HDRS }),
    sbFetch(SB_URL + '/rest/v1/expert_settings?key=eq.ignored_alerts&select=value', { headers: SB_HDRS })
  ]);
  // Real SKU labels (shared with the storefront via expert_settings)
  if (!sk.error && Array.isArray(sk.data) && sk.data[0] && sk.data[0].value) {
    try {
      window._sbSkuMap = JSON.parse(sk.data[0].value) || {};
      localStorage.setItem('jain_sku_map', JSON.stringify(window._sbSkuMap));
    } catch(e) {}
  }
  // Brand labels (shared with the storefront via expert_settings)
  if (!bm.error && Array.isArray(bm.data) && bm.data[0] && bm.data[0].value) {
    try { window._sbBrandMap = JSON.parse(bm.data[0].value) || {}; } catch(e) {}
  }
  // Extra category assignments (shared with the storefront via expert_settings)
  if (!mc.error && Array.isArray(mc.data) && mc.data[0] && mc.data[0].value) {
    try {
      window._sbMultiCats = JSON.parse(mc.data[0].value) || {};
      localStorage.setItem('bahar_multi_cats', JSON.stringify(window._sbMultiCats));
    } catch(e) {}
  }
  // Ignored low/out-of-stock alerts (see ignoreAlert() in 07-orders.js)
  if (!ia.error && Array.isArray(ia.data) && ia.data[0] && ia.data[0].value) {
    try { window._sbIgnoredAlerts = JSON.parse(ia.data[0].value) || {}; } catch(e) {}
  }
  // Category backgrounds
  if (!cb.error && Array.isArray(cb.data)) {
    var catBgs = {};
    try { catBgs = JSON.parse(localStorage.getItem('jain_cat_bgs') || '{}'); } catch(e) {}
    cb.data.forEach(function(r) { if (r.slug && r.img_url) catBgs[r.slug] = r.img_url; });
    localStorage.setItem('jain_cat_bgs', JSON.stringify(catBgs));
  }

  // Stock
  if (s.error) {
    console.warn('Stock load failed:', s.error);
    showToast('Offline — using local data');
  } else if (Array.isArray(s.data)) {
    s.data.forEach(function(r) { stockData[r.product_id] = r.qty; });
    localStorage.setItem('jain_stock', JSON.stringify(stockData));
  }

  // Custom products
  if (c.error) {
    console.warn('Products load failed:', c.error);
  } else if (Array.isArray(c.data)) {
    _customProductRows = c.data;
    // Fix any conflicting IDs (Supabase auto-increment starts at 1, conflicts with base IDs 1-60)
    await _fixCustomProductIds();
    console.log('Custom products ready:', _customProductRows.length);
  }

  // Hidden base products
  if (h.error) {
    console.warn('Hidden list load failed:', h.error);
  } else if (Array.isArray(h.data)) {
    _hiddenBaseIds = new Set(h.data.map(function(r) { return r.product_id; }));
  }

  if (!s.error) showToast('Loaded from cloud ☁️');

  try {
    refreshCategorySelects(); renderStats(); renderTable();
  } catch(err) {
    console.error('Admin render error:', err);
    document.getElementById('tblBody').innerHTML = '<tr><td colspan="8" style="color:red;padding:20px;font-weight:700;font-size:13px">&#9888; RENDER ERROR: ' + err.message + '</td></tr>';
  }

  // Photos load separately and re-render once ready (see comment above) —
  // the table above already shows real names/prices/stock immediately.
  sbFetch(SB_URL + '/rest/v1/expert_photos?select=*', { headers: SB_HDRS }).then(function(p) {
    if (Array.isArray(p.data)) {
      const ph = JSON.parse(localStorage.getItem('jain_photos') || '{}');
      p.data.forEach(function(r) { ph[r.product_id] = r.img_url; });
      localStorage.setItem('jain_photos', JSON.stringify(ph));
      renderTable();
    }
  });
}

// Old built-in category slugs -> the Expert Hardware category set
// (keeps the base catalogue filterable after the category change)
var _OLD_CAT_MAP = {
  'power-tools':'tools', 'fasteners':'fastener', 'measuring':'hand-tools',
  'cutting':'hand-tools', 'accessories':'hardware', 'storage':'hardware'
};
function normalizeAdminCat(c) { return _OLD_CAT_MAP[c] || c; }

// Merged list of all products (base + custom)
function getAllAdminProducts() {
  var deletedIds = new Set(getDeletedProducts().map(function(d){return d.id;}));
  var baseIds    = new Set(PRODUCTS.map(function(p){return p.id;}));  // IDs 1-60 are authoritative
  const base = PRODUCTS
    .filter(function(p){ return !deletedIds.has(p.id); })
    .map(function(p) {
      return { id:p.id, name:p.name, cat:normalizeAdminCat(p.cat), price:p.price, img:p.img, isBase:true, hidden:_hiddenBaseIds.has(p.id) };
    });
  const custom = _customProductRows
    .filter(function(p){ return !deletedIds.has(p.id) && !baseIds.has(p.id); }) // skip Supabase dupes of base IDs
    .map(function(p) {
      return { id:p.id, name:p.name, cat:normalizeAdminCat(p.category), price:parseFloat(p.price), img:p.img_url||'', isBase:false, hidden:p.hidden||false };
    });
  return [...base, ...custom].sort(function(a,b){return a.id-b.id;});
}

const PRODUCTS = [];

// Brand for each built-in product (random); overridable per-product in the admin table
const BASE_BRANDS = {};

