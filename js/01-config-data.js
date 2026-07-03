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
// Admin can set a custom SKU; it's stored in jain_sku_map in localStorage.
function getProductSku(id) {
  try {
    var map = JSON.parse(localStorage.getItem('jain_sku_map') || '{}');
    var val = map[String(id)];
    return 'SKU-' + String(val !== undefined ? val : id).padStart(4, '0');
  } catch(e) { return 'SKU-' + String(id).padStart(4, '0'); }
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

async function loadSBData() {
  const [s, p, c, h, b] = await Promise.all([
    sbFetch(SB_URL + '/rest/v1/expert_stock?select=*',                         { headers: SB_H }),
    sbFetch(SB_URL + '/rest/v1/expert_photos?select=*',                        { headers: SB_H }),
    sbFetch(SB_URL + '/rest/v1/expert_products?select=*',                        { headers: SB_H }),
    sbFetch(SB_URL + '/rest/v1/expert_hidden?select=product_id',               { headers: SB_H }),
    sbFetch(SB_URL + '/rest/v1/expert_banners?select=*&order=id.asc',          { headers: SB_H })
  ]);
  if (s.error) {
    console.warn('Supabase offline — using localStorage fallback');
    try { _sbStock  = JSON.parse(localStorage.getItem('jain_stock')  || '{}'); } catch(_) {}
    try { _sbPhotos = JSON.parse(localStorage.getItem('jain_photos') || '{}'); } catch(_) {}
  } else {
    if (Array.isArray(s.data)) s.data.forEach(r => { _sbStock[r.product_id]  = r.qty; });
    if (Array.isArray(p.data)) p.data.forEach(r => { _sbPhotos[r.product_id] = r.url; });
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
    .map(p => Object.assign({}, p, { category: normalizeCategory(p.category) }));
  // Only show custom products with safe IDs > 60 (ID fix in admin handles conflicts)
  const extra = _customProds.filter(p => !baseIds.has(p.id) && p.id > 60).map(p => ({
    id:       p.id,
    name:     p.name,
    category: normalizeCategory(p.category),
    price:    parseFloat(p.price),
    img:      p.img_url || p.img || `https://picsum.photos/seed/dt${p.id}/420/320`,
    desc:     p.description || p.desc || '',
    badge:    p.badge || null,
    stock:    'in-stock'
  }));
  return [...base, ...extra];
}

const PRODUCTS = [
  // ── POWER TOOLS (1-10) ───────────────────────────────────────────────────
  { id:1,  name:'Cordless Drill Driver 18V',          category:'power-tools', price:18.500, img:'Bahar-Products/SKU-0001.jpg', desc:'18V cordless drill driver with keyless chuck, 2-speed gearbox and 15+1 torque settings. Includes 2 batteries and charger.', badge:'Best Seller', stock:'in-stock' },
  { id:2,  name:'Angle Grinder 115mm 900W',           category:'power-tools', price:12.000, img:'Bahar-Products/SKU-0002.jpg', desc:'900W angle grinder with 115mm disc, adjustable guard, spindle lock and anti-vibration side handle.', badge:null, stock:'in-stock' },
  { id:3,  name:'Circular Saw 1200W 185mm',           category:'power-tools', price:22.000, img:'Bahar-Products/SKU-0003.jpg', desc:'1200W circular saw, 185mm blade, 0-45° bevel cut, depth adjustment and laser guide. Dust port included.', badge:null, stock:'in-stock' },
  { id:4,  name:'Jigsaw 650W Variable Speed',         category:'power-tools', price:16.000, img:'Bahar-Products/SKU-0004.jpg', desc:'650W jigsaw with variable speed, orbital action and tool-free blade change. For wood, metal and plastic.', badge:null, stock:'in-stock' },
  { id:5,  name:'Random Orbital Sander 125mm 280W',   category:'power-tools', price:11.000, img:'Bahar-Products/SKU-0005.jpg', desc:'280W random orbital sander with 125mm pad, variable speed and dust collection bag.', badge:null, stock:'in-stock' },
  { id:6,  name:'Cordless Combi Drill 20V',           category:'power-tools', price:21.000, img:'Bahar-Products/SKU-0006.jpg', desc:'20V combi drill with hammer function, 21+1 torque settings, LED light. 2x2.0Ah batteries included.', badge:'Popular', stock:'in-stock' },
  { id:7,  name:'SDS-Plus Rotary Hammer 800W',        category:'power-tools', price:28.000, img:'Bahar-Products/SKU-0007.jpg', desc:'800W SDS-plus rotary hammer with 3 modes: drill, hammer drill and chisel. 3J impact energy for concrete.', badge:null, stock:'in-stock' },
  { id:8,  name:'Heat Gun 2000W Variable',            category:'power-tools', price:8.500,  img:'Bahar-Products/SKU-0008.jpg', desc:'2000W heat gun with 2 temperature settings up to 600°C. For shrink wrap, paint stripping and pipe bending.', badge:null, stock:'in-stock' },
  { id:9,  name:'Reciprocating Saw 900W',             category:'power-tools', price:19.000, img:'Bahar-Products/SKU-0009.jpg', desc:'900W reciprocating saw with variable speed, 28mm stroke and quick-release blade clamp. Ideal for demolition.', badge:null, stock:'in-stock' },
  { id:10, name:'Electric Screwdriver 3.6V',          category:'power-tools', price:6.500,  img:'Bahar-Products/SKU-0010.jpg', desc:'3.6V cordless electric screwdriver with 6Nm torque, LED light and 6 torque settings. Compact and lightweight.', badge:null, stock:'in-stock' },
  // ── HAND TOOLS (11-20) ───────────────────────────────────────────────────
  { id:11, name:'Claw Hammer 16oz Fibreglass',        category:'hand-tools',  price:3.500,  img:'Bahar-Products/SKU-0011.jpg', desc:'16oz claw hammer with fibreglass handle and anti-slip grip. Forged steel head, magnetic nail starter.', badge:'Best Seller', stock:'in-stock' },
  { id:12, name:'Screwdriver Set 6-Piece',            category:'hand-tools',  price:2.800,  img:'Bahar-Products/SKU-0012.jpg', desc:'6-piece screwdriver set with Phillips and flathead tips. Ergonomic soft-grip handles, chrome vanadium steel.', badge:null, stock:'in-stock' },
  { id:13, name:'Screwdriver Set 12-Piece',           category:'hand-tools',  price:4.500,  img:'Bahar-Products/SKU-0013.jpg', desc:'12-piece screwdriver set. All common Phillips, flathead, Torx and Pozidriv sizes.', badge:null, stock:'in-stock' },
  { id:14, name:'Adjustable Wrench 250mm',            category:'hand-tools',  price:2.200,  img:'Bahar-Products/SKU-0014.jpg', desc:'250mm adjustable wrench with hardened steel jaw, graduated scale and smooth adjustment wheel.', badge:null, stock:'in-stock' },
  { id:15, name:'Socket Ratchet Set 40-Piece',        category:'hand-tools',  price:9.800,  img:'Bahar-Products/SKU-0015.jpg', desc:'40-piece 1/2" drive socket ratchet set with metric and imperial sockets in carry case. CrV steel.', badge:'Popular', stock:'in-stock' },
  { id:16, name:'Combination Pliers Set 3-Piece',     category:'hand-tools',  price:4.200,  img:'Bahar-Products/SKU-0016.jpg', desc:'3-piece pliers set: combination, long-nose and slip-joint. Drop forged with insulated handles.', badge:null, stock:'in-stock' },
  { id:17, name:'Hex Allen Key Set 9-Piece',          category:'hand-tools',  price:1.500,  img:'Bahar-Products/SKU-0017.jpg', desc:'9-piece metric hex allen key set 1.5mm–10mm. Ball-end for angled access, chrome vanadium steel.', badge:null, stock:'in-stock' },
  { id:18, name:'Mixed Hand Tool Kit 85-Piece',       category:'hand-tools',  price:15.000, img:'Bahar-Products/SKU-0018.jpg', desc:'85-piece mixed hand tool kit in hard carry case. Includes hammer, pliers, screwdrivers, sockets and more.', badge:null, stock:'in-stock' },
  { id:19, name:'Rubber Mallet 16oz',                 category:'hand-tools',  price:2.000,  img:'Bahar-Products/SKU-0019.jpg', desc:'16oz rubber mallet with wooden handle. For striking chisels, assembling furniture and tile laying.', badge:null, stock:'in-stock' },
  { id:20, name:'Screwdriver Bit Set 32-Piece',       category:'hand-tools',  price:2.500,  img:'Bahar-Products/SKU-0020.jpg', desc:'32-piece screwdriver bit set with magnetic holder. Phillips, Torx, flathead, hex and Pozidriv included.', badge:null, stock:'in-stock' },
  // ── FASTENERS (21-30) ────────────────────────────────────────────────────
  { id:21, name:'Common Wire Nails 2.5" — 1kg',      category:'fasteners',   price:0.600,  img:'Bahar-Products/SKU-0021.jpg', desc:'1kg box of 2.5-inch galvanised common wire nails. For general framing, fencing and woodwork.', badge:null, stock:'in-stock' },
  { id:22, name:'Common Wire Nails 3" — 1kg',        category:'fasteners',   price:0.700,  img:'Bahar-Products/SKU-0022.jpg', desc:'1kg box of 3-inch galvanised wire nails. Heavy-duty general purpose nails for timber construction.', badge:null, stock:'in-stock' },
  { id:23, name:'Panel Pins 30mm — 200g',            category:'fasteners',   price:0.400,  img:'Bahar-Products/SKU-0023.jpg', desc:'200g pack of 30mm panel pins. For fixing architrave, skirting boards and light timber work.', badge:null, stock:'in-stock' },
  { id:24, name:'Wood Screws 4×40mm — 100 Pack',     category:'fasteners',   price:0.500,  img:'Bahar-Products/SKU-0024.jpg', desc:'100-pack bright zinc 4×40mm countersunk wood screws. Pozi head, coarse thread for softwood.', badge:'Best Seller', stock:'in-stock' },
  { id:25, name:'Drywall Screws 3.5×35mm — 100 Pack',category:'fasteners',   price:0.450,  img:'Bahar-Products/SKU-0025.jpg', desc:'100-pack black phosphate drywall screws 3.5×35mm. Fine thread for steel stud, coarse for timber.', badge:null, stock:'in-stock' },
  { id:26, name:'Hex Bolts & Nuts M8 — 20 Pack',    category:'fasteners',   price:1.200,  img:'Bahar-Products/SKU-0026.jpg', desc:'20-pack M8×50mm zinc hex bolts with nuts and washers. Grade 4.8 steel for structural connections.', badge:null, stock:'in-stock' },
  { id:27, name:'Assorted Screw Pack — 500 Piece',   category:'fasteners',   price:1.800,  img:'Bahar-Products/SKU-0027.jpg', desc:'500-piece assorted screw pack. Mixed sizes of countersunk wood screws, self-tappers and machine screws.', badge:'Popular', stock:'in-stock' },
  { id:28, name:'HSS Drill Bit Set 19-Piece',        category:'fasteners',   price:2.800,  img:'Bahar-Products/SKU-0028.jpg', desc:'19-piece HSS drill bit set 1mm–10mm in index roll. For drilling wood, metal and plastics.', badge:null, stock:'in-stock' },
  { id:29, name:'Wall Plug & Screw Assortment',      category:'fasteners',   price:1.500,  img:'Bahar-Products/SKU-0029.jpg', desc:'Assorted wall plugs and screws in segmented storage tray. Red, brown and yellow plugs with matching screws.', badge:null, stock:'in-stock' },
  { id:30, name:'Cable Ties Assorted Pack 200pc',    category:'fasteners',   price:0.600,  img:'Bahar-Products/SKU-0030.jpg', desc:'200-piece nylon cable tie pack. Sizes 100mm, 150mm, 200mm and 300mm. Black and natural colours.', badge:null, stock:'in-stock' },
  // ── MEASURING (31-36) ────────────────────────────────────────────────────
  { id:31, name:'Tape Measure 5m Auto-Lock',         category:'measuring',   price:1.800,  img:'Bahar-Products/SKU-0031.jpg', desc:'5-metre auto-lock tape measure with 19mm blade. Dual metric/imperial markings, magnetic hook tip.', badge:'Best Seller', stock:'in-stock' },
  { id:32, name:'Spirit Level 60cm Aluminium',       category:'measuring',   price:3.200,  img:'Bahar-Products/SKU-0032.jpg', desc:'60cm aluminium spirit level with 3 acrylic vials: plumb, level and 45°. Rubber end caps.', badge:null, stock:'in-stock' },
  { id:33, name:'Laser Cross-Line Level + Tripod',   category:'measuring',   price:12.000, img:'Bahar-Products/SKU-0033.jpg', desc:'Self-levelling laser cross-line level with adjustable tripod. ±3mm/5m accuracy, 15m working range.', badge:'Popular', stock:'in-stock' },
  { id:34, name:'Digital Vernier Caliper 150mm',     category:'measuring',   price:3.500,  img:'Bahar-Products/SKU-0034.jpg', desc:'150mm digital vernier caliper with LCD display. Resolution 0.01mm. Measures inside, outside and depth.', badge:null, stock:'in-stock' },
  { id:35, name:'Steel Try Square 300mm',            category:'measuring',   price:2.200,  img:'Bahar-Products/SKU-0035.jpg', desc:'300mm steel try square with hardwood handle. For marking accurate right angles on timber and metalwork.', badge:null, stock:'in-stock' },
  { id:36, name:'Laser Distance Meter 40m',          category:'measuring',   price:8.500,  img:'Bahar-Products/SKU-0036.jpg', desc:'Laser distance meter up to 40m. Single distance, area and volume calculation. ±2mm accuracy.', badge:null, stock:'in-stock' },
  // ── SAFETY (37-42) ───────────────────────────────────────────────────────
  { id:37, name:'Cut-Resistant Gloves Level 5',      category:'safety',      price:1.800,  img:'Bahar-Products/SKU-0037.jpg', desc:'Level 5 cut-resistant gloves with HPPE liner and latex coating. EN388 certified. Sizes S–XL.', badge:null, stock:'in-stock' },
  { id:38, name:'Heavy Duty Leather Work Gloves',    category:'safety',      price:1.200,  img:'Bahar-Products/SKU-0038.jpg', desc:'Leather palm work gloves with stretch back. Protection from abrasion, cuts and punctures.', badge:'Best Seller', stock:'in-stock' },
  { id:39, name:'Safety Glasses & Goggles Pack',     category:'safety',      price:2.500,  img:'Bahar-Products/SKU-0039.jpg', desc:'Safety glasses and goggles pack. Clear polycarbonate lens, anti-scratch coating, EN166 certified.', badge:null, stock:'in-stock' },
  { id:40, name:'Hard Hat Yellow ABS',               category:'safety',      price:2.800,  img:'Bahar-Products/SKU-0040.jpg', desc:'Yellow ABS safety hard hat with 4-point ratchet suspension. EN397 certified for construction sites.', badge:null, stock:'in-stock' },
  { id:41, name:'Hi-Vis Safety Vest Yellow',         category:'safety',      price:1.500,  img:'Bahar-Products/SKU-0041.jpg', desc:'Yellow high-visibility safety vest with 2 reflective strips. EN ISO 20471 Class 2. Sizes S–3XL.', badge:null, stock:'in-stock' },
  { id:42, name:'Safety Work Boots S1P',             category:'safety',      price:8.500,  img:'Bahar-Products/SKU-0042.jpg', desc:'S1P safety boots with steel toe cap and anti-penetration midsole. Oil-resistant sole. Sizes 39–46.', badge:null, stock:'in-stock' },
  // ── CUTTING TOOLS (43-47) ────────────────────────────────────────────────
  { id:43, name:'Hand Panel Saw 22" 8TPI',           category:'cutting',     price:3.500,  img:'Bahar-Products/SKU-0043.jpg', desc:'22-inch panel saw with 8 teeth per inch hardened blade. Ergonomic soft-grip handle for cross and rip cuts.', badge:null, stock:'in-stock' },
  { id:44, name:'Hacksaw Frame Adjustable 300mm',    category:'cutting',     price:2.200,  img:'Bahar-Products/SKU-0044.jpg', desc:'Adjustable hacksaw frame for 250mm and 300mm blades. Ergonomic grip, 3 blade angle positions.', badge:null, stock:'in-stock' },
  { id:45, name:'Heavy Duty Utility Knife',          category:'cutting',     price:1.200,  img:'Bahar-Products/SKU-0045.jpg', desc:'Heavy duty retractable utility knife with quick-change mechanism and spare blade storage in handle.', badge:'Best Seller', stock:'in-stock' },
  { id:46, name:'Wire Cutters & Long Nose Pliers',   category:'cutting',     price:3.800,  img:'Bahar-Products/SKU-0046.jpg', desc:'Wire cutters and long-nose pliers with insulated handles. Precision ground blades for clean cuts.', badge:null, stock:'in-stock' },
  { id:47, name:'Plastic Pipe Cutter 3-35mm',        category:'cutting',     price:2.500,  img:'Bahar-Products/SKU-0047.jpg', desc:'Ratchet pipe cutter for plastic pipes 3–35mm. Clean burr-free cut, suitable for PVC and CPVC pipes.', badge:null, stock:'in-stock' },
  // ── STORAGE & ACCESSORIES (48-60) ────────────────────────────────────────
  { id:48, name:'Heavy Duty Tool Bag 18"',           category:'accessories', price:6.500,  img:'Bahar-Products/SKU-0048.jpg', desc:'18-inch open-top tool bag with 32 pockets, rubber base and reinforced handles. Fits most hand tools.', badge:null, stock:'in-stock' },
  { id:49, name:'Extension Lead 10m 4-Socket',       category:'accessories', price:4.500,  img:'Bahar-Products/SKU-0049.jpg', desc:'10-metre extension lead with 4 sockets and neon indicator. Heavy-duty 13A cable, surge protected.', badge:null, stock:'in-stock' },
  { id:50, name:'Hard Carry Toolbox 18"',            category:'accessories', price:5.800,  img:'Bahar-Products/SKU-0050.jpg', desc:'18-inch hard carry toolbox with removable tray and cantilever lid. Metal clasp, reinforced handle.', badge:'Popular', stock:'in-stock' },
  { id:51, name:'Cobalt Drill Bit Set 19-Piece',     category:'fasteners',   price:4.500,  img:'Bahar-Products/SKU-0051.jpg', desc:'19-piece cobalt HSS drill bit set for stainless steel and hard metals. 1–10mm in index case.', badge:null, stock:'in-stock' },
  { id:52, name:'Sandpaper Assorted Pack 40-Piece',  category:'accessories', price:1.200,  img:'Bahar-Products/SKU-0052.jpg', desc:'40-sheet assorted sandpaper pack with grits 60, 80, 120, 180 and 240. For hand and machine sanding.', badge:null, stock:'in-stock' },
  { id:53, name:'Heavy Duty Pipe Wrench 350mm',      category:'hand-tools',  price:4.800,  img:'Bahar-Products/SKU-0053.jpg', desc:'350mm cast iron pipe wrench with self-tightening action. For gripping pipes up to 50mm diameter.', badge:null, stock:'in-stock' },
  { id:54, name:'Electric Staple Gun 20-Gauge',      category:'accessories', price:7.500,  img:'Bahar-Products/SKU-0054.jpg', desc:'20-gauge electric staple and nail gun. Fires 8, 10 and 14mm staples. For upholstery and cable fixing.', badge:null, stock:'in-stock' },
  { id:55, name:'Duct Tape Silver 48mm × 25m',       category:'accessories', price:1.200,  img:'Bahar-Products/SKU-0055.jpg', desc:'48mm × 25m silver duct tape with strong adhesive. For duct sealing, bundling and emergency repairs.', badge:null, stock:'in-stock' },
  { id:56, name:'Laser Distance Meter 60m',          category:'measuring',   price:14.500, img:'Bahar-Products/SKU-0056.jpg', desc:'Professional laser distance meter 60m range with backlit display. Area, volume and Pythagoras modes.', badge:null, stock:'in-stock' },
  { id:57, name:'Knee Protection Pads',              category:'safety',      price:3.200,  img:'Bahar-Products/SKU-0057.jpg', desc:'Heavy-duty knee pads with gel insert and ABS cap. Adjustable straps. For flooring, tiling and roofing work.', badge:null, stock:'in-stock' },
  { id:58, name:'Circular Saw Blade Set 4-Piece',    category:'cutting',     price:5.500,  img:'Bahar-Products/SKU-0058.jpg', desc:'4-piece circular saw blade set: rip, crosscut, fine and multi-material. 185mm diameter, 24–60 teeth.', badge:null, stock:'in-stock' },
  { id:59, name:'Insulated Wire Connectors 100pc',   category:'accessories', price:1.800,  img:'Bahar-Products/SKU-0059.jpg', desc:'100-piece insulated wire connector assortment. Red, blue and yellow for 0.5–6mm² wire connections.', badge:null, stock:'in-stock' },
  { id:60, name:'Electrical Connector Assortment',   category:'accessories', price:2.200,  img:'Bahar-Products/SKU-0060.jpg', desc:'Assorted electrical connector pack including terminal blocks, butt connectors and ring terminals.', badge:null, stock:'in-stock' }
];

// ── ARABIC PRODUCT TRANSLATIONS ───────────────────────────────────────────
var _AR_PRODUCTS = {
  1:  { name:'مثقاب لاسلكي 18 فولت',              desc:'مثقاب لاسلكي 18 فولت بعيار متحرك، تروس بسرعتين و15+1 ضبط عزم. يشمل بطاريتين وشاحن.' },
  2:  { name:'جلاخة زاوية 115مم 900 واط',         desc:'جلاخة زاوية 900 واط قرص 115مم مع واقٍ قابل للتعديل وقفل محور ومقبض جانبي.' },
  3:  { name:'منشار دائري 1200 واط 185مم',        desc:'منشار دائري 1200 واط شفرة 185مم، قطع زاوية 0-45°، دليل ليزر وفتحة شفط غبار.' },
  4:  { name:'منشار ترددي 650 واط',               desc:'منشار ترددي 650 واط بسرعة متغيرة وتغيير شفرة بدون أدوات. للخشب والمعدن والبلاستيك.' },
  5:  { name:'مجلخة مدارية 125مم 280 واط',        desc:'مجلخة مدارية 280 واط لوح 125مم، سرعة متغيرة وكيس تجميع الغبار.' },
  6:  { name:'مثقاب مطرقة لاسلكي 20 فولت',       desc:'مثقاب مطرقة لاسلكي 20 فولت، 21+1 ضبط عزم، إضاءة LED، بطاريتان 2.0Ah مع شاحن.' },
  7:  { name:'مطرقة دوارة SDS بلس 800 واط',       desc:'مطرقة دوارة SDS بلس 800 واط، 3 أوضاع: حفر وطرق وإزميل. طاقة صدم 3 جول للخرسانة.' },
  8:  { name:'مسدس حراري 2000 واط',               desc:'مسدس حراري 2000 واط بإعدادين للحرارة حتى 600°م. لتقليص الأنابيب وتجريد الطلاء.' },
  9:  { name:'منشار ترددي للهدم 900 واط',         desc:'منشار هدم 900 واط بسرعة متغيرة وشوط 28مم وتثبيت شفرة سريع. مثالي للهدم والبناء.' },
  10: { name:'مفك كهربائي 3.6 فولت',              desc:'مفك كهربائي لاسلكي 3.6 فولت بعزم 6 نيوتن متر وإضاءة LED. خفيف ومدمج.' },
  11: { name:'مطرقة مخلب 16 أوقية ألياف زجاجية', desc:'مطرقة مخلب 16 أوقية بمقبض ألياف زجاجية ومسكة مانعة للانزلاق. رأس فولاذي مطروق.' },
  12: { name:'طقم مفكات 6 قطع',                  desc:'طقم 6 مفكات بمقابض مريحة. شعاعي وفيليبس، فولاذ كروم فاناديوم.' },
  13: { name:'طقم مفكات 12 قطع',                  desc:'طقم 12 مفكة بجميع المقاسات الشائعة: فيليبس وشعاعي وتوركس وبوزيدريف.' },
  14: { name:'مفتاح إنجليزي قابل للضبط 250مم',    desc:'مفتاح إنجليزي 250مم بفك فولاذي مقواة، تدريج مدرج وعجلة ضبط سلسة.' },
  15: { name:'طقم مقابس شد 40 قطعة',              desc:'طقم شد 40 قطعة محرك 1/2 بوصة بمقابس متري وإمبريالي في حقيبة. فولاذ CrV.' },
  16: { name:'طقم كماشات 3 قطع',                 desc:'طقم 3 كماشات: مشط وخرطوم وكماشة انزلاقية. فولاذ مطروق بمقابض عازلة.' },
  17: { name:'طقم مفاتيح سداسية 9 قطع',           desc:'طقم 9 مفاتيح سداسية متري 1.5-10مم. رأس كروي للوصول المائل، فولاذ CrV.' },
  18: { name:'طقم أدوات يدوية 85 قطعة',           desc:'طقم شامل 85 قطعة في حقيبة صلبة: مطرقة وكماشات ومفكات ومقابس وغيرها.' },
  19: { name:'مطرقة مطاطية 16 أوقية',             desc:'مطرقة مطاطية 16 أوقية بمقبض خشبي. لضرب الإزميل وتركيب الأثاث والبلاط.' },
  20: { name:'طقم روؤس مفكات 32 قطعة',            desc:'طقم 32 رأس مفكة بحامل مغناطيسي سريع. فيليبس وتوركس وشعاعي وسداسي وبوزيدريف.' },
  21: { name:'مسامير سلك 2.5 بوصة - كيلو',        desc:'كيلو من المسامير الخشبية الجلفنية 2.5 بوصة. للتأطير والسياج والأعمال الخشبية العامة.' },
  22: { name:'مسامير سلك 3 بوصة - كيلو',          desc:'كيلو من المسامير الجلفنية 3 بوصة. مسامير ثقيلة للأعمال الخشبية الإنشائية.' },
  23: { name:'مسامير لوحات 30مم - 200 جرام',      desc:'علبة 200 جرام مسامير لوحات 30مم. لتثبيت القواطع والألواح الخفيفة.' },
  24: { name:'براغي خشب 4×40مم - 100 حبة',        desc:'100 برغي خشب زنك 4×40مم رأس مغطس بوزيدريف. خيط خشن للخشب الناعم.' },
  25: { name:'براغي جبسوم 3.5×35مم - 100 حبة',    desc:'100 برغي جبسوم أسود فوسفاتي 3.5×35مم. خيط ناعم لدعامة فولاذية وخشنة للخشب.' },
  26: { name:'براغي سداسية M8 - 20 حبة',          desc:'20 برغي سداسي M8×50مم بصواميل وحلقات زنك. فولاذ درجة 4.8 للوصلات الإنشائية.' },
  27: { name:'تشكيلة براغي - 500 قطعة',           desc:'500 برغي متنوع مقاسات مختلفة. براغي خشب وبراغي ذاتية الحفر وبراغي آلة.' },
  28: { name:'طقم رؤوس حفر HSS 19 قطعة',         desc:'19 رأس حفر HSS من 1-10مم في لفافة مرتبة. لحفر الخشب والمعدن والبلاستيك.' },
  29: { name:'تشكيلة بلاغ وبراغي جدار',           desc:'تشكيلة بلاغ جدار وبراغي في صينية تخزين مقسمة. بلاغ أحمر وبني وأصفر مع براغي مطابقة.' },
  30: { name:'تشكيلة ربطات كابل 200 حبة',         desc:'200 ربطة كابل نايلون متنوعة. أحجام 100و150و200و300مم. أسود وطبيعي.' },
  31: { name:'شريط قياس 5 متر أوتوماتيكي',       desc:'شريط قياس 5 متر قفل تلقائي، لسان 19مم. مزدوج متري وإمبريالي، طرف مغناطيسي.' },
  32: { name:'ميزان فقاعة ألمنيوم 60سم',          desc:'ميزان فقاعة ألمنيوم 60سم مع 3 فقاعات أكريليك: أفقي ورأسي و45°. أطراف مطاطية.' },
  33: { name:'ليزر خطين متقاطعين + حامل',         desc:'مستوى ليزر خطين ذاتي التسوية مع حامل قابل للتعديل. دقة ±3مم/5م، مدى 15 متر.' },
  34: { name:'ورنية رقمية 150مم',                 desc:'ورنية رقمية 150مم بشاشة LCD. دقة 0.01مم، تقيس داخلي وخارجي وعمق.' },
  35: { name:'زاوية قياس فولاذ 300مم',            desc:'زاوية قياس فولاذية 300مم بمقبض خشبي. لرسم الزوايا القائمة على الخشب والمعدن.' },
  36: { name:'مقياس مسافة ليزر 40 متر',           desc:'جهاز قياس مسافة بالليزر حتى 40 متر. قياس مسافة ومساحة وحجم. دقة ±2مم.' },
  37: { name:'قفازات مقاومة للقطع درجة 5',        desc:'قفازات مقاومة للقطع درجة 5 بطانة HPPE وطلاء لاتكس. شهادة EN388، مقاسات S-XL.' },
  38: { name:'قفازات عمل جلدية ثقيلة',            desc:'قفازات جلدية بظهر مرن. حماية من الكشط والقطع والثقب. مقاس موحد.' },
  39: { name:'طقم نظارات ووقاية عيون',            desc:'طقم نظارات سلامة. عدسة بولي كربونات شفافة، طلاء مقاوم للخدش، شهادة EN166.' },
  40: { name:'خوذة صلبة صفراء ABS',               desc:'خوذة سلامة ABS صفراء بتعليق بربراشة 4 نقاط. شهادة EN397 لمواقع البناء.' },
  41: { name:'سترة عاكسة صفراء',                  desc:'سترة عاكسة عالية الرؤية صفراء بشريطين عاكسين. معيار EN ISO 20471 الفئة 2. مقاسات S-3XL.' },
  42: { name:'حذاء سلامة S1P',                    desc:'حذاء سلامة S1P بمقدمة فولاذية ونعل مضاد للاختراق. نعل مقاوم للزيوت. مقاسات 39-46.' },
  43: { name:'منشار يدوي 22 بوصة 8TPI',           desc:'منشار لوحات 22 بوصة 8 أسنان/بوصة. مقبض مريح للقطع العرضي والطولي.' },
  44: { name:'إطار منشار معادن قابل للضبط 300مم', desc:'إطار منشار معادن للشفرات 250و300مم. مقبض مريح، 3 أوضاع زاوية للشفرة.' },
  45: { name:'سكين مهنية ثقيلة',                  desc:'سكين ذات شفرة قابلة للسحب مع آلية تغيير سريعة ومخزن للشفرات الاحتياطية.' },
  46: { name:'كماشة قطع ومخرز',                   desc:'كماشة قطع ومخرز طويل بمقابض عازلة. شفرات مطحونة بدقة للقطع النظيف.' },
  47: { name:'قاطع أنابيب بلاستيكية 3-35مم',      desc:'قاطع أنابيب بلاستيكية 3-35مم. قطع نظيف بدون خشونة، مناسب لأنابيب PVC وCPVC.' },
  48: { name:'حقيبة أدوات ثقيلة 18 بوصة',         desc:'حقيبة أدوات مفتوحة 18 بوصة مع 32 جيب وقاعدة مطاطية ومقابض معززة.' },
  49: { name:'سلك تمديد 10 متر 4 مقابس',          desc:'سلك تمديد 10 متر بـ4 مقابس ومؤشر نيون. كابل 13 أمبير، حماية من ارتفاع الجهد.' },
  50: { name:'صندوق أدوات صلب 18 بوصة',           desc:'صندوق أدوات صلب 18 بوصة بصينية قابلة للإزالة وغطاء قنطور. مشبك معدني.' },
  51: { name:'طقم رؤوس حفر كوبالت 19 قطعة',       desc:'19 رأس حفر كوبالت HSS للفولاذ المقاوم والمعادن الصلبة. 1-10مم في علبة مرتبة.' },
  52: { name:'ورق صنفرة متنوع 40 قطعة',           desc:'40 ورقة صنفرة متنوعة: 60و80و120و180و240 حبة. للصنفرة اليدوية والآلية.' },
  53: { name:'مفتاح أنابيب ثقيل 350مم',           desc:'مفتاح أنابيب 350مم بحديد زهر ذاتي الشد. لإمساك الأنابيب حتى 50مم قطر.' },
  54: { name:'مسدس دباسة كهربائي',                desc:'مسدس دباسة وبرشام كهربائي 20 قياس. يطلق دباسات 8و10و14مم. لتنجيد الأثاث.' },
  55: { name:'لاصق داكت 48مم × 25م',              desc:'لاصق داكت فضي 48مم × 25م بلاصق قوي. لإحكام القنوات والربط والإصلاح الطارئ.' },
  56: { name:'مقياس مسافة ليزر 60 متر',           desc:'جهاز قياس ليزر احترافي 60 متر بشاشة مضاءة. أوضاع مسافة ومساحة وحجم وفيثاغورس.' },
  57: { name:'واقيات ركب مهنية',                  desc:'واقيات ركب بحشوة جيل وقبعة ABS. أحزمة قابلة للضبط. لأعمال الأرضيات والبلاط.' },
  58: { name:'طقم شفرات منشار دائري 4 قطع',       desc:'طقم 4 شفرات للمنشار الدائري: طولي وعرضي وناعم ومتعدد الاستخدام. 185مم.' },
  59: { name:'موصلات أسلاك معزولة 100 حبة',       desc:'100 موصل أسلاك معزول متنوع. أحمر وأزرق وأصفر لأسلاك 0.5-6مم².' },
  60: { name:'تشكيلة موصلات كهربائية',            desc:'تشكيلة موصلات كهربائية: قضبان طرفية وموصلات ونهايات حلقية.' },
  79: { name:'مربع القياس 300مم',                  desc:'مربع قياس 300مم برأس حديدي، ميزان تسوية، محقن وحاكم فولاذي. للتحقق الدقيق من 90° و45°.' },
  80: { name:'براغي تثبيت M10 — 10 قطع',          desc:'عبوة 10 براغي تثبيت M10×75مم مجلفنة للخرسانة والبناء. مع صواميل وحلقات مسطحة.' },
  81: { name:'مسدس تثبيت 18 فولت بدون فرش',       desc:'مسدس تثبيت لاسلكي 18 فولت بدون فرش بعزم 210 نيوتن متر، 3 سرعات وضوء LED. يشمل بطارية 2Ah وشاحن.' },
  82: { name:'منشار حديد 300مم قابل للضبط',       desc:'منشار حديد 300مم قابل للضبط بشفرة ثنائية المعدن ومقبض مريح. للمعادن والبلاستيك والأنابيب.' },
  83: { name:'منشار دائري لاسلكي 18 فولت',        desc:'منشار دائري لاسلكي 18 فولت، شفرة 165مم، زاوية ميل 0-45°، عمق قطع 55مم. مع بطارية 4Ah.' },
  84: { name:'أربطة تثبيت 200مم — 100 قطعة',      desc:'عبوة 100 رابطة نايلون 200مم × 3.6مم. نوع قابل لإعادة الاستخدام بسطح ناعم لتنظيم الأسلاك.' },
  85: { name:'حذاء سلامة بمقدمة فولاذية مقاس 42', desc:'حذاء سلامة بمقدمة فولاذية، نعل مانع للانزلاق ودعم للكاحل. مقاس 42.' },
  86: { name:'حزام أدوات 5 جيوب',                 desc:'حزام أدوات 5 جيوب مع حلقة المطرقة وكليب الشريط ومشبك سريع الفك. خامة نايلون ثقيل.' },
  87: { name:'سترة عاكسة للسلامة فئة 2',          desc:'سترة عاكسة فئة 2 بشريطين عاكسين وسحاب أمامي وجيبين جانبيين. مقاس موحد.' },
  88: { name:'فرجار ورني رقمي 150مم',             desc:'فرجار ورني رقمي 150مم بشاشة LCD، متري وإمبريالي، دقة 0.01مم، هيكل فولاذي.' }
};

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

