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
  { slug:'filter',           label:'Filters' }
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
          body:JSON.stringify([{product_id:result.data[0].id, url:oldPhoto}])
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
  const [s, p, c, h, cb] = await Promise.all([
    sbFetch(SB_URL + '/rest/v1/expert_stock?select=*',          { headers: SB_HDRS }),
    sbFetch(SB_URL + '/rest/v1/expert_photos?select=*',         { headers: SB_HDRS }),
    sbFetch(SB_URL + '/rest/v1/expert_products?select=*',       { headers: SB_HDRS }),
    sbFetch(SB_URL + '/rest/v1/expert_hidden?select=product_id',{ headers: SB_HDRS }),
    sbFetch(SB_URL + '/rest/v1/expert_cat_bgs?select=*',        { headers: SB_HDRS })
  ]);
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

  // Photos
  if (p.error) {
    console.warn('Photos load failed:', p.error);
  } else if (Array.isArray(p.data)) {
    const ph = JSON.parse(localStorage.getItem('jain_photos') || '{}');
    p.data.forEach(function(r) { ph[r.product_id] = r.url; });
    localStorage.setItem('jain_photos', JSON.stringify(ph));
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

const PRODUCTS = [
  // POWER TOOLS
  {id:1,  name:'Cordless Drill Driver 18V',          cat:'power-tools', price:18.500, img:UL(1)},
  {id:2,  name:'Angle Grinder 115mm 900W',           cat:'power-tools', price:12.000, img:UL(2)},
  {id:3,  name:'Circular Saw 1200W 185mm',           cat:'power-tools', price:22.000, img:UL(3)},
  {id:4,  name:'Jigsaw 650W Variable Speed',         cat:'power-tools', price:16.000, img:UL(4)},
  {id:5,  name:'Random Orbital Sander 125mm 280W',   cat:'power-tools', price:11.000, img:UL(5)},
  {id:6,  name:'Cordless Combi Drill 20V',           cat:'power-tools', price:21.000, img:UL(6)},
  {id:7,  name:'SDS-Plus Rotary Hammer 800W',        cat:'power-tools', price:28.000, img:UL(7)},
  {id:8,  name:'Heat Gun 2000W Variable',            cat:'power-tools', price:8.500,  img:UL(8)},
  {id:9,  name:'Reciprocating Saw 900W',             cat:'power-tools', price:19.000, img:UL(9)},
  {id:10, name:'Electric Screwdriver 3.6V',          cat:'power-tools', price:6.500,  img:UL(10)},
  // HAND TOOLS
  {id:11, name:'Claw Hammer 16oz Fibreglass',        cat:'hand-tools',  price:3.500,  img:UL(11)},
  {id:12, name:'Screwdriver Set 6-Piece',            cat:'hand-tools',  price:2.800,  img:UL(12)},
  {id:13, name:'Screwdriver Set 12-Piece',           cat:'hand-tools',  price:4.500,  img:UL(13)},
  {id:14, name:'Adjustable Wrench 250mm',            cat:'hand-tools',  price:2.200,  img:UL(14)},
  {id:15, name:'Socket Ratchet Set 40-Piece',        cat:'hand-tools',  price:9.800,  img:UL(15)},
  {id:16, name:'Combination Pliers Set 3-Piece',     cat:'hand-tools',  price:4.200,  img:UL(16)},
  {id:17, name:'Hex Allen Key Set 9-Piece',          cat:'hand-tools',  price:1.500,  img:UL(17)},
  {id:18, name:'Mixed Hand Tool Kit 85-Piece',       cat:'hand-tools',  price:15.000, img:UL(18)},
  {id:19, name:'Rubber Mallet 16oz',                 cat:'hand-tools',  price:2.000,  img:UL(19)},
  {id:20, name:'Screwdriver Bit Set 32-Piece',       cat:'hand-tools',  price:2.500,  img:UL(20)},
  // FASTENERS
  {id:21, name:'Common Wire Nails 2.5" — 1kg',      cat:'fasteners',   price:0.600,  img:UL(21)},
  {id:22, name:'Common Wire Nails 3" — 1kg',        cat:'fasteners',   price:0.700,  img:UL(22)},
  {id:23, name:'Panel Pins 30mm — 200g',            cat:'fasteners',   price:0.400,  img:UL(23)},
  {id:24, name:'Wood Screws 4×40mm — 100 Pack',     cat:'fasteners',   price:0.500,  img:UL(24)},
  {id:25, name:'Drywall Screws 3.5×35mm — 100 Pack',cat:'fasteners',   price:0.450,  img:UL(25)},
  {id:26, name:'Hex Bolts & Nuts M8 — 20 Pack',    cat:'fasteners',   price:1.200,  img:UL(26)},
  {id:27, name:'Assorted Screw Pack — 500 Piece',   cat:'fasteners',   price:1.800,  img:UL(27)},
  {id:28, name:'HSS Drill Bit Set 19-Piece',        cat:'fasteners',   price:2.800,  img:UL(28)},
  {id:29, name:'Wall Plug & Screw Assortment',      cat:'fasteners',   price:1.500,  img:UL(29)},
  {id:30, name:'Cable Ties Assorted Pack 200pc',    cat:'fasteners',   price:0.600,  img:UL(30)},
  // MEASURING
  {id:31, name:'Tape Measure 5m Auto-Lock',         cat:'measuring',   price:1.800,  img:UL(31)},
  {id:32, name:'Spirit Level 60cm Aluminium',       cat:'measuring',   price:3.200,  img:UL(32)},
  {id:33, name:'Laser Cross-Line Level + Tripod',   cat:'measuring',   price:12.000, img:UL(33)},
  {id:34, name:'Digital Vernier Caliper 150mm',     cat:'measuring',   price:3.500,  img:UL(34)},
  {id:35, name:'Steel Try Square 300mm',            cat:'measuring',   price:2.200,  img:UL(35)},
  {id:36, name:'Laser Distance Meter 40m',          cat:'measuring',   price:8.500,  img:UL(36)},
  // SAFETY
  {id:37, name:'Cut-Resistant Gloves Level 5',      cat:'safety',      price:1.800,  img:UL(37)},
  {id:38, name:'Heavy Duty Leather Work Gloves',    cat:'safety',      price:1.200,  img:UL(38)},
  {id:39, name:'Safety Glasses & Goggles Pack',     cat:'safety',      price:2.500,  img:UL(39)},
  {id:40, name:'Hard Hat Yellow ABS',               cat:'safety',      price:2.800,  img:UL(40)},
  {id:41, name:'Hi-Vis Safety Vest Yellow',         cat:'safety',      price:1.500,  img:UL(41)},
  {id:42, name:'Safety Work Boots S1P',             cat:'safety',      price:8.500,  img:UL(42)},
  // CUTTING TOOLS
  {id:43, name:'Hand Panel Saw 22" 8TPI',           cat:'cutting',     price:3.500,  img:UL(43)},
  {id:44, name:'Hacksaw Frame Adjustable 300mm',    cat:'cutting',     price:2.200,  img:UL(44)},
  {id:45, name:'Heavy Duty Utility Knife',          cat:'cutting',     price:1.200,  img:UL(45)},
  {id:46, name:'Wire Cutters & Long Nose Pliers',   cat:'cutting',     price:3.800,  img:UL(46)},
  {id:47, name:'Plastic Pipe Cutter 3-35mm',        cat:'cutting',     price:2.500,  img:UL(47)},
  // ACCESSORIES
  {id:48, name:'Heavy Duty Tool Bag 18"',           cat:'accessories', price:6.500,  img:UL(48)},
  {id:49, name:'Extension Lead 10m 4-Socket',       cat:'accessories', price:4.500,  img:UL(49)},
  {id:50, name:'Hard Carry Toolbox 18"',            cat:'accessories', price:5.800,  img:UL(50)},
  {id:51, name:'Cobalt Drill Bit Set 19-Piece',     cat:'fasteners',   price:4.500,  img:UL(51)},
  {id:52, name:'Sandpaper Assorted Pack 40-Piece',  cat:'accessories', price:1.200,  img:UL(52)},
  {id:53, name:'Heavy Duty Pipe Wrench 350mm',      cat:'hand-tools',  price:4.800,  img:UL(53)},
  {id:54, name:'Electric Staple Gun 20-Gauge',      cat:'accessories', price:7.500,  img:UL(54)},
  {id:55, name:'Duct Tape Silver 48mm × 25m',       cat:'accessories', price:1.200,  img:UL(55)},
  {id:56, name:'Laser Distance Meter 60m',          cat:'measuring',   price:14.500, img:UL(56)},
  {id:57, name:'Knee Protection Pads',              cat:'safety',      price:3.200,  img:UL(57)},
  {id:58, name:'Circular Saw Blade Set 4-Piece',    cat:'cutting',     price:5.500,  img:UL(58)},
  {id:59, name:'Insulated Wire Connectors 100pc',   cat:'accessories', price:1.800,  img:UL(59)},
  {id:60, name:'Electrical Connector Assortment',   cat:'accessories', price:2.200,  img:UL(60)}
];

// Brand for each built-in product (random); overridable per-product in the admin table
const BASE_BRANDS = {1:'covax', 2:'dck', 3:'dck', 4:'bosch', 5:'itrust', 6:'covax', 7:'bosch', 8:'bosch', 9:'covax', 10:'itrust', 11:'itrust', 12:'bosch', 13:'covax', 14:'itrust', 15:'itrust', 16:'covax', 17:'bosch', 18:'covax', 19:'covax', 20:'dck', 21:'bosch', 22:'covax', 23:'itrust', 24:'itrust', 25:'itrust', 26:'dck', 27:'itrust', 28:'bosch', 29:'itrust', 30:'dck', 31:'itrust', 32:'dck', 33:'bosch', 34:'bosch', 35:'covax', 36:'itrust', 37:'dck', 38:'dck', 39:'itrust', 40:'dck', 41:'bosch', 42:'covax', 43:'bosch', 44:'dck', 45:'bosch', 46:'dck', 47:'covax', 48:'bosch', 49:'covax', 50:'bosch', 51:'covax', 52:'bosch', 53:'dck', 54:'dck', 55:'dck', 56:'covax', 57:'itrust', 58:'covax', 59:'dck', 60:'itrust'};

