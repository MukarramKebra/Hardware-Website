const U   = (id) => `https://images.unsplash.com/photo-${id}?w=420&h=320&fit=crop&auto=format&q=80`;
const UL  = (id) => `Bahar-Products/SKU-${String(id).padStart(4,'0')}.jpg`;  // local product images

// ── SITE DISABLE CHECK ───────────────────────────────────────────────────
// Owner can close the site to visitors via the admin Owner Controls panel.
// This runs on every page load and shows a "closed" overlay if the flag is set.
(async function checkSiteStatus() {
  try {
    const SB_URL_CHK = 'https://sinzmodmefkyjkzzitjy.supabase.co';
    const SB_KEY_CHK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpbnptb2RtZWZreWprenppdGp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMjQ4MzYsImV4cCI6MjA5NTcwMDgzNn0.Ft88pQEKbSVP_yb7UTRVq2fLa_TScR97_jvJmgAMlSc';
    const res = await fetch(SB_URL_CHK + '/rest/v1/jain_settings?key=eq.site_disabled&select=value', {
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
          <div style="font-size:15px;font-weight:800;color:#c8151b;line-height:1.3">TAJ MAHAL JAIN<br>BUILDING MATERIALS CO.</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.3);margin-top:6px;">Kuwait — Bathroom &amp; Plumbing Supplies</div>
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
const SB_URL = 'https://sinzmodmefkyjkzzitjy.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpbnptb2RtZWZreWprenppdGp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMjQ4MzYsImV4cCI6MjA5NTcwMDgzNn0.Ft88pQEKbSVP_yb7UTRVq2fLa_TScR97_jvJmgAMlSc';
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

async function loadSBData() {
  const [s, p, c, h] = await Promise.all([
    sbFetch(SB_URL + '/rest/v1/jain_stock?select=*',                         { headers: SB_H }),
    sbFetch(SB_URL + '/rest/v1/jain_photos?select=*',                        { headers: SB_H }),
    sbFetch(SB_URL + '/rest/v1/jain_products?select=*',                        { headers: SB_H }),
    sbFetch(SB_URL + '/rest/v1/jain_hidden?select=product_id',               { headers: SB_H })
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
  }
  renderProducts();
}

// Normalise category strings so "powertools", "power tools", "Power Tools" etc.
// all map to the hyphenated slug used by the filter pills
function normalizeCategory(raw) {
  const c = (raw || '').toLowerCase().replace(/[\s_]+/g, '-').trim();
  const map = {
    'powertools':   'power-tools',
    'handtools':    'hand-tools',
    'hand':         'hand-tools',
    'power':        'power-tools',
    'safety-gear':  'safety',
    'safetygear':   'safety',
    'tool-storage': 'storage',
    'toolstorage':  'storage',
    'measuring-tools': 'measuring',
    'measuringtools':  'measuring',
    'cutting-tools':   'cutting',
    'cuttingtools':    'cutting'
  };
  return map[c] || c;
}

// Merged base + admin-added products, with hidden ones removed
function getAllProducts() {
  const baseIds = new Set(PRODUCTS.map(p => p.id));  // IDs 1-60 are authoritative
  const base  = PRODUCTS.filter(p => !_hiddenIds.has(p.id));
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
  'power-tools': 'عدد كهربائية',
  'hand-tools':  'عدد يدوية',
  'fasteners':   'مسامير وبراغي',
  'measuring':   'قياس ومسح',
  'safety':      'معدات السلامة',
  'cutting':     'أدوات القطع',
  'accessories': 'ملحقات وتخزين'
};

let cart = [];
let activeFilter = 'all';

// ── MULTI-CATEGORY HELPER (storefront) ────────────────────────────────────
// Returns array of extra category slugs assigned to a product via the admin
// multi-category picker (stored in bahar_multi_cats in localStorage).
function getMultiCats(id) {
  try {
    var map = JSON.parse(localStorage.getItem('bahar_multi_cats') || '{}');
    return Array.isArray(map[String(id)]) ? map[String(id)] : [];
  } catch(e) { return []; }
}

function imgError(el) {
  // Step 1: try the local Bahar-Products fallback path if we haven't yet
  const local = el.dataset.local;
  if (!el.dataset.triedLocal && local && el.src !== local && !el.src.includes('Bahar-Products')) {
    el.dataset.triedLocal = '1';
    el.src = local;
    return;
  }
  // Step 2: retry once after 4 seconds
  if (!el.dataset.retry) {
    el.dataset.retry = '1';
    const src = el.src;
    setTimeout(() => { el.src = ''; el.src = src; }, 4000);
  } else {
    // Step 3: give up, show placeholder icon
    el.style.display = 'none';
    if (el.nextElementSibling) el.nextElementSibling.style.display = 'flex';
  }
}

// ── ANALYTICS TRACKING ────────────────────────────────────────────────────
function trackView(id) {
  const v = JSON.parse(localStorage.getItem('bahar_views') || '{}');
  v[id] = (v[id] || 0) + 1;
  localStorage.setItem('bahar_views', JSON.stringify(v));
  // Sync to Supabase so admin analytics tab can see live data
  sbFetch(SB_URL + '/rest/v1/rpc/increment_analytics', {
    method: 'POST',
    headers: { ...SB_H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_id: id, p_views: 1, p_searches: 0 })
  });
}
function trackSearchText(query) {
  if (!query || query.length < 2) return;
  var terms = JSON.parse(localStorage.getItem('jain_search_terms') || '{}');
  var key = query.toLowerCase().trim();
  terms[key] = (terms[key] || 0) + 1;
  localStorage.setItem('jain_search_terms', JSON.stringify(terms));
}
function trackSearch(ids) {
  if (!ids || !ids.length) return;
  const s = JSON.parse(localStorage.getItem('bahar_searches') || '{}');
  ids.forEach(function(id) { s[id] = (s[id] || 0) + 1; });
  localStorage.setItem('bahar_searches', JSON.stringify(s));
  // Sync to Supabase so admin analytics tab can see live data
  ids.forEach(function(id) {
    sbFetch(SB_URL + '/rest/v1/rpc/increment_analytics', {
      method: 'POST',
      headers: { ...SB_H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_id: id, p_views: 0, p_searches: 1 })
    });
  });
}

// ── CATEGORY NAV STRIP ────────────────────────────────────────────────────
function syncCatNav(cat) {
  document.querySelectorAll('.cn-item').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  document.querySelectorAll('.pill').forEach(p => p.classList.toggle('active', p.dataset.filter === cat));
}
function jumpCat(cat) {
  activeFilter = cat;
  syncCatNav(cat);
  document.getElementById('searchInput').value = '';
  renderProducts();
  document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
}

function filterProducts(category) {
  activeFilter = category;
  syncCatNav(category);
  document.getElementById('searchInput').value = '';
  renderProducts();
  document.getElementById('products').scrollIntoView({ behavior:'smooth' });
}
// ── STOCK HELPERS ─────────────────────────────────────────────────────────
function getLiveStock(productId) {
  const qty = _sbStock[productId];
  if (qty === undefined) return null;
  return qty === 0 ? 'out-of-stock' : qty <= 10 ? 'low-stock' : 'in-stock';
}
function getLiveQty(productId) {
  return _sbStock[productId] !== undefined ? _sbStock[productId] : null;
}
async function deductStock(cartItems) {
  // Update local cache first so UI reflects immediately
  cartItems.forEach(item => {
    const cur = _sbStock[item.id] !== undefined ? _sbStock[item.id] : 50;
    _sbStock[item.id] = Math.max(0, cur - item.qty);
  });
  // Push to Supabase so admin sees real numbers
  const rows = cartItems.map(item => ({ product_id: item.id, qty: _sbStock[item.id] }));
  const { error } = await sbFetch(SB_URL + '/rest/v1/jain_stock', {
    method: 'POST',
    headers: { ...SB_H, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(rows)
  });
  if (error) localStorage.setItem('jain_stock', JSON.stringify(_sbStock));
}

// ── SMART SEARCH ─────────────────────────────────────────────────────────────
// Arabic names for all products so searching in Arabic works
const ARABIC_NAMES = {
  // Shataffa / شطافة
  1:'شطافة ستانلس ستيل', 2:'طقم شطافة جداري', 3:'بيديه سبراي ثنائي',
  4:'مقعد بيديه', 5:'خرطوم شطافة مضفر', 6:'زاوية مع قاطع تي',
  7:'شطافة نيكل مصقول', 8:'حامل شطافة كروم', 9:'طقم خلاط بيديه',
  10:'صمام عدم رجوع',
  // Toilet Seats / مقعد المرحاض
  11:'مقعد مرحاض أبيض', 12:'مقعد مرحاض ناعم', 13:'مقعد مرحاض رفيع',
  14:'مقعد دي شيب ناعم', 15:'مقعد تدريب أطفال', 16:'مقعد سريع الفك',
  17:'مقعد مرحاض ممتد', 18:'مقعد مضاد للبكتيريا',
  // Lighting / إضاءة
  19:'لمبة ليد دافئة', 20:'لمبة ليد نهارية', 21:'لمبة ليد صغيرة',
  22:'سبوت ليد', 23:'داون لايت ليد', 24:'شريط ليد',
  25:'لوح ليد', 26:'أنبوب ليد', 27:'لمبة ليد ذكية', 28:'لمبة خارجية',
  // Taps / صنبور وخلاط
  29:'خلاط حوض كروم', 30:'خلاط مطبخ', 31:'صنبور سحب',
  32:'خلاط حمام وشاور', 33:'صنبور ساخن وبارد', 34:'خلاط حوض جداري',
  35:'شاور ثيرموستاتي', 36:'فلتر صنبور', 37:'صمام إيقاف',
  38:'خلاط أحادي طويل',
  // Plumbing / سباكة
  39:'أنبوب ضغط', 40:'أنبوب ماء ساخن', 41:'خرطوم مرن 40',
  42:'خرطوم مرن 60', 43:'تفلون', 44:'كوع 90',
  45:'صمام كروي نحاس', 46:'سيفون', 47:'سيليكون صحي', 48:'سلك تسليك',
  // Bathroom / حمام
  49:'حلقة مناشف', 50:'حامل ورق تواليت', 51:'بار مناشف مزدوج',
  52:'موزع صابون جداري', 53:'مرآة حمام', 54:'ستارة حمام',
  55:'رف زاوية شاور', 56:'خطاف معطف مزدوج',
  // Sanitaryware / أدوات صحية
  57:'حوض معلق', 58:'حوض بيدستال', 59:'طقم مرحاض', 60:'إطار سيسترن مخفي'
};

// normalizeQ — cleans up a search string so small differences don't block results:
//   • lowercases everything
//   • removes hyphens / punctuation (so "d-cup" = "d cup")
//   • collapses repeated letters (so "shattaffa" = "shatafa")
//   • collapses whitespace
function normalizeQ(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[-_''".،,،؛;:!؟?/\\()\[\]]/g, ' ') // punctuation → space
    .replace(/(.)\1+/gi, '$1')                    // "tt" → "t", "aa" → "a"
    .replace(/\s+/g, ' ')
    .trim();
}

// matchesSearch — returns true if a product matches the search query
// Splits the query into words and checks that EVERY word appears somewhere
// in the product name, description, category, or Arabic name.
function matchesSearch(query, p) {
  if (!query) return true;
  const normQ    = normalizeQ(query);
  const words    = normQ.split(' ').filter(w => w.length > 0);
  const haystack = normalizeQ(p.name) + ' ' +
                   normalizeQ(p.desc || '') + ' ' +
                   normalizeQ(p.category || '') + ' ' +
                   (ARABIC_NAMES[p.id] || '');
  return words.every(w => haystack.includes(w));
}

// ── RENDER PRODUCTS ───────────────────────────────────────────────────────
function renderProducts() {
  const query = document.getElementById('searchInput').value.trim();
  const grid  = document.getElementById('productsGrid');
  const empty = document.getElementById('productsEmpty');
  const filtered = getAllProducts().filter(p => {
    const matchCat    = activeFilter === 'all' || p.category === activeFilter || getMultiCats(p.id).includes(activeFilter);
    const matchSearch = matchesSearch(query, p);
    return matchCat && matchSearch;
  });
  if (!filtered.length) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  // Best Sellers always first, then other badged items, then the rest
  const badgeOrder = { 'Best Seller': 0, 'Popular': 1, 'Pro': 2, 'New': 3, 'Sale': 4 };
  filtered.sort((a, b) => {
    const aRank = a.badge !== null && a.badge !== undefined ? (badgeOrder[a.badge] !== undefined ? badgeOrder[a.badge] : 5) : 99;
    const bRank = b.badge !== null && b.badge !== undefined ? (badgeOrder[b.badge] !== undefined ? badgeOrder[b.badge] : 5) : 99;
    return aRank - bRank;
  });
  // Track search appearances (debounced so only fires when user stops typing)
  if (query && filtered.length) {
    clearTimeout(window._searchTimer);
    window._searchTimer = setTimeout(function() {
      trackSearch(filtered.map(function(p) { return p.id; }));
      trackSearchText(query);
    }, 700);
  }

  // custom photos set by admin (loaded from Supabase)
  const customPhotos = _sbPhotos;

  const isAr = _lang === 'ar';
  grid.innerHTML = filtered.map(p => {
    const liveStatus = getLiveStock(p.id) || p.stock;
    const liveQty    = getLiveQty(p.id);
    const isOut      = liveStatus === 'out-of-stock';
    const isLow      = liveStatus === 'low-stock';
    // Use custom admin photo only if it's a valid http/https URL or data URL — not a broken local path
    const rawCustom  = customPhotos[p.id];
    const photo      = (rawCustom && (rawCustom.startsWith('http') || rawCustom.startsWith('data:'))) ? rawCustom : p.img;
    // Arabic product name/desc
    const arP = isAr && _AR_PRODUCTS[p.id];
    const pName = arP ? arP.name : p.name;
    const pDesc = arP ? arP.desc : p.desc;
    const pCat  = isAr ? (_AR_CATS[p.category] || p.category.replace('-',' ')) : p.category.replace('-',' ');
    let stockLabel, stockClass;
    if (isOut)      { stockLabel = isAr ? '&#10006; غير متوفر'  : '&#10006; Out of Stock';  stockClass = 'out-of-stock'; }
    else if (isLow) { stockLabel = (isAr ? '&#9888; كمية محدودة' : '&#9888; Low Stock') + (liveQty !== null ? ' (' + liveQty + (isAr ? ' متبقي)' : ' left)') : ''); stockClass = 'low-stock'; }
    else            { stockLabel = (isAr ? '&#10003; متوفر'      : '&#10003; In Stock')  + (liveQty !== null ? ' (' + liveQty + ')' : ''); stockClass = 'in-stock'; }
    const addBtn   = isAr ? 'أضف' : 'Add';
    const unavail  = isAr ? 'غير متاح' : 'Unavailable';
    return `
      <div class="product-card ${isOut ? 'card-out' : ''}" onclick="openProduct(${p.id})">
        <div class="product-img-wrap">
          ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}
          ${isOut ? `<span class="out-badge">${isAr ? 'نفد المخزون' : 'OUT OF STOCK'}</span>` : ''}
          <button class="card-wl-btn ${isWishlisted(p.id)?'wishlisted':''}" onclick="toggleWishlist(${p.id}, event)" title="${isWishlisted(p.id)?'Remove from wishlist':'Save to wishlist'}"><i class="fa fa-heart"></i></button>
          <img src="${photo}" data-local="${p.img}" alt="${pName}" loading="lazy" onerror="imgError(this)" />
          <div class="product-img-fallback" style="display:none"><i class="fa fa-tools"></i></div>
        </div>
        <div class="product-info">
          <div class="product-cat">${pCat}</div>
          <div style="font-size:10px;font-weight:700;color:#aaa;letter-spacing:0.5px;margin-bottom:3px">${getProductSku(p.id)}</div>
          <h3>${pName}</h3>
          <p>${pDesc}</p>
          <div class="product-footer">
            <div>
              <div class="product-price">${p.price.toFixed(3)} <small>KWD</small></div>
              <div class="stock-badge ${stockClass}">${stockLabel}</div>
            </div>
            ${isOut
              ? `<button class="btn-add btn-disabled" disabled onclick="event.stopPropagation()">${unavail}</button>`
              : `<button class="btn-add" onclick="event.stopPropagation();addToCart(${p.id})"><i class="fa fa-plus"></i> ${addBtn}</button>`}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── PRODUCT DETAIL MODAL ──────────────────────────────────────────────────
let _pmQty = 1;
let _pmId  = null;

function openProduct(id) {
  trackView(id);
  trackRecentlyViewed(id);
  _pmId  = id;
  _pmQty = 1;
  const p           = getAllProducts().find(x => x.id === id);
  const liveStatus  = getLiveStock(id) || p.stock;
  const liveQty     = getLiveQty(id);
  const isOut       = liveStatus === 'out-of-stock';
  const isLow       = liveStatus === 'low-stock';
  const customPhotos = _sbPhotos;
  // Only use a stored photo if it's a real URL (http/data:) — otherwise use the local Bahar-Products image
  const rawPhoto = customPhotos[id];
  const bigImg = (rawPhoto && (rawPhoto.startsWith('http') || rawPhoto.startsWith('data:')))
    ? rawPhoto
    : p.img;

  let stockIcon, stockTxt, stockCls;
  if (isOut)      { stockIcon = 'fa-times-circle'; stockTxt = 'Out of Stock'; stockCls = 'out-of-stock'; }
  else if (isLow) { stockIcon = 'fa-exclamation-circle'; stockTxt = 'Low Stock — only ' + (liveQty||'few') + ' left!'; stockCls = 'low-stock'; }
  else            { stockIcon = 'fa-check-circle'; stockTxt = 'In Stock' + (liveQty !== null ? ' — ' + liveQty + ' available' : ''); stockCls = 'in-stock'; }

  document.getElementById('prodModalSku').textContent = getProductSku(id);
  document.getElementById('prodModalBody').innerHTML =
    '<div class="pm-img-col">' +
      '<img src="' + bigImg + '" alt="' + p.name + '" onerror="imgError(this)" />' +
      '<div class="pm-img-fallback" id="pmFallback"><i class="fa fa-tools"></i></div>' +
    '</div>' +
    '<div class="pm-info-col">' +
      '<div class="pm-badge-row">' +
        '<span class="pm-badge cat"><i class="fa fa-tag"></i> ' + p.category.replace('-', ' ') + '</span>' +
        (p.badge ? '<span class="pm-badge orange">' + p.badge + '</span>' : '') +
      '</div>' +
      '<h2 class="pm-name">' + p.name + '</h2>' +
      '<p class="pm-desc">' + p.desc + '</p>' +
      '<div class="pm-price">' + p.price.toFixed(3) + ' <small>KWD</small></div>' +
      '<div class="pm-stock-line ' + stockCls + '"><i class="fa ' + stockIcon + '"></i> ' + stockTxt + '</div>' +
      (!isOut ?
        '<div class="pm-qty-row">' +
          '<span class="pm-qty-lbl">Quantity</span>' +
          '<div class="pm-qty-ctrl">' +
            '<button onclick="pmChangeQty(-1)"><i class="fa fa-minus"></i></button>' +
            '<input type="number" id="pmQtyDisplay" value="1" min="1" autocomplete="off" oninput="pmQtyInput(this)" onblur="pmQtyBlur(this)" />' +
            '<button onclick="pmChangeQty(1)"><i class="fa fa-plus"></i></button>' +
          '</div>' +
        '</div>'
      : '') +
      '<button class="pm-add-btn" id="pmAddBtn" ' + (isOut ? 'disabled' : 'onclick="pmAddToCart()"') + '>' +
        '<i class="fa ' + (isOut ? 'fa-ban' : 'fa-shopping-cart') + '"></i> ' +
        (isOut ? 'Out of Stock' : 'Add to Cart') +
      '</button>' +
      '<div class="pm-action-row">' +
        '<button class="pm-wl-btn '+(isWishlisted(id)?'wishlisted':'')+'" onclick="toggleWishlist('+id+', event)">' +
          '<i class="fa fa-heart"></i> '+(isWishlisted(id)?'Saved':'Save') +
        '</button>' +
        '<button class="pm-share-btn" onclick="shareProduct('+id+')">' +
          '<i class="fab fa-whatsapp"></i> Share' +
        '</button>' +
        '<button class="pm-review-btn" onclick="openReviews('+id+')">' +
          '<i class="fa fa-star"></i> Reviews' +
        '</button>' +
      '</div>' +
      '<div class="pm-divider"></div>' +
      '<div class="pm-features">' +
        '<div class="pm-feat"><i class="fa fa-check-circle"></i> 100% genuine, quality-tested product</div>' +
        '<div class="pm-feat"><i class="fa fa-shipping-fast"></i> Same-day delivery in Kuwait City</div>' +
        '<div class="pm-feat"><i class="fa fa-shield-alt"></i> Easy returns &amp; after-sales support</div>' +
        '<div class="pm-feat"><i class="fa fa-tags"></i> Bulk pricing available for contractors</div>' +
      '</div>' +
    '</div>';

  document.getElementById('prodOverlay').classList.add('open');
  document.body.classList.add('product-open');
  document.body.style.overflow = 'hidden';
}

function closeProduct() {
  document.getElementById('prodOverlay').classList.remove('open');
  document.body.style.overflow = '';
  document.body.classList.remove('product-open');
  _pmId = null; _pmQty = 1;
}

function pmChangeQty(delta) {
  const liveQty = getLiveQty(_pmId);
  const max = liveQty !== null ? liveQty : 999;
  _pmQty = Math.max(1, Math.min(max, _pmQty + delta));
  var el = document.getElementById('pmQtyDisplay');
  if (el) el.value = _pmQty;
}

function pmQtyInput(el) {
  const liveQty = getLiveQty(_pmId);
  const max = liveQty !== null ? liveQty : 999;
  var v = parseInt(el.value, 10);
  if (isNaN(v) || v < 1) { _pmQty = 1; return; }
  if (v > max) { v = max; el.value = max; }
  _pmQty = v;
}

function pmQtyBlur(el) {
  // Snap to valid value when user leaves the field
  var v = parseInt(el.value, 10);
  if (isNaN(v) || v < 1) v = 1;
  const liveQty = getLiveQty(_pmId);
  const max = liveQty !== null ? liveQty : 999;
  _pmQty = Math.min(v, max);
  el.value = _pmQty;
}

function pmAddToCart() {
  const product  = getAllProducts().find(p => p.id === _pmId);
  const liveQty  = getLiveQty(_pmId);
  const inCart   = cart.find(c => c.id === _pmId);
  const cartQty  = inCart ? inCart.qty : 0;
  if (liveQty !== null && cartQty + _pmQty > liveQty) {
    alert('Only ' + liveQty + ' units available. You already have ' + cartQty + ' in your cart.');
    return;
  }
  if (inCart) { inCart.qty += _pmQty; } else { cart.push(Object.assign({}, product, { qty: _pmQty })); }
  // Flash button green then close
  const btn = document.getElementById('pmAddBtn');
  btn.classList.add('pm-added-flash');
  btn.innerHTML = '<i class="fa fa-check"></i> Added to Cart!';
  setTimeout(function() { updateCartUI(); closeProduct(); openCart(); }, 700);
}

// ESC key closes any open modal
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeProduct();
    document.getElementById('cartModal').classList.remove('open');
    document.getElementById('checkoutOverlay').classList.remove('open');
  }
});

// ── CART ──────────────────────────────────────────────────────────────────
function addToCart(id) {
  trackView(id);
  const product  = getAllProducts().find(p => p.id === id);
  const liveQty  = getLiveQty(id);
  const inCart   = cart.find(c => c.id === id);
  const cartQty  = inCart ? inCart.qty : 0;
  if (liveQty !== null && cartQty >= liveQty) {
    alert('Sorry, only ' + liveQty + ' units available in stock!'); return;
  }
  if (inCart) { inCart.qty++; } else { cart.push({...product, qty:1}); }
  updateCartUI(); openCart();
}
function removeFromCart(id) { cart = cart.filter(c => c.id !== id); updateCartUI(); }
function updateCartUI() {
  const count = cart.reduce((s,c) => s+c.qty, 0);
  // Update any cart count badges safely (header count may not exist)
  const cc = document.getElementById('cartCount');
  if (cc) cc.textContent = count;
  const fab = document.getElementById('mobCartCount');
  if (fab) fab.textContent = count;
  const body  = document.getElementById('cartItems');
  const total = cart.reduce((s,c) => s+c.price*c.qty, 0);
  document.getElementById('cartTotal').textContent = total.toFixed(3) + ' KWD';
  const customPhotos = _sbPhotos;
  if (!cart.length) { body.innerHTML = '<p class="empty-cart">Your cart is empty.</p>'; return; }
  body.innerHTML = cart.map(c => {
    // Only use stored photo if it's a real URL — otherwise fall back to local image
    const rawPh = customPhotos[c.id];
    const imgSrc = (rawPh && (rawPh.startsWith('http') || rawPh.startsWith('data:'))) ? rawPh : c.img;
    return `
    <div class="cart-item">
      <div class="cart-item-icon"><img src="${imgSrc}" alt="${c.name}" onerror="imgError(this)" /></div>
      <div class="cart-item-info">
        <strong>${c.name}</strong>
        <span>Qty: ${c.qty} &times; ${c.price.toFixed(3)} KWD</span>
      </div>
      <div class="cart-item-actions">
        <span class="cart-item-price">${(c.price*c.qty).toFixed(3)} KWD</span>
        <button class="btn-remove" onclick="removeFromCart(${c.id})"><i class="fa fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}
function openCart() { document.getElementById('cartModal').classList.add('open'); }

// ── CHECKOUT ──────────────────────────────────────────────────────────────
function openCheckout() {
  if (!cart.length) return;
  const customPhotos = _sbPhotos;
  document.getElementById('coItems').innerHTML = cart.map(c => `
    <div class="co-item">
      <div><span class="co-item-name">${c.name}</span><br/><span class="co-item-qty">x${c.qty} unit${c.qty>1?'s':''}</span></div>
      <span class="co-item-price">${(c.price*c.qty).toFixed(3)} KWD</span>
    </div>`).join('');
  const total = cart.reduce((s,c) => s+c.price*c.qty, 0);
  document.getElementById('coTotal').textContent = total.toFixed(3) + ' KWD';
  document.getElementById('cartModal').classList.remove('open');
  document.getElementById('checkoutOverlay').classList.add('open');
  // Pre-fill from saved profile if user is logged in
  if (_userProfile) {
    if (_userProfile.name)  document.getElementById('coName').value  = _userProfile.name;
    if (_userProfile.phone) document.getElementById('coPhone').value = _userProfile.phone;
    // Parse saved address back into the area field if possible
    if (_userProfile.address) {
      const addrParts = _userProfile.address.split(',').map(s => s.trim());
      const areaEl = document.getElementById('coArea');
      if (addrParts.length) {
        for (let i = 0; i < areaEl.options.length; i++) {
          if (areaEl.options[i].text === addrParts[0]) { areaEl.value = addrParts[0]; break; }
        }
      }
    }
  }
}

// ── FULFILMENT TOGGLE ─────────────────────────────────────────────────────
let _fulfilment = 'delivery'; // 'delivery' | 'pickup'
function setFulfilment(mode) {
  _fulfilment = mode;
  document.getElementById('ftDelivery').classList.toggle('active', mode === 'delivery');
  document.getElementById('ftPickup').classList.toggle('active', mode === 'pickup');
  document.getElementById('coDeliverySection').style.display = mode === 'delivery' ? '' : 'none';
  document.getElementById('coPickupInfo').style.display = mode === 'pickup' ? '' : 'none';
}

document.getElementById('coSubmitBtn').addEventListener('click', () => {
  const name  = document.getElementById('coName').value.trim();
  const phone = document.getElementById('coPhone').value.trim();
  const isPickup = _fulfilment === 'pickup';

  // Validate required fields
  let valid = true;
  ['coName','coPhone'].forEach(id => {
    const el = document.getElementById(id);
    if (!el.value.trim()) { el.classList.add('err'); valid = false; }
    else el.classList.remove('err');
  });
  if (!isPickup) {
    const areaEl = document.getElementById('coArea');
    if (!areaEl.value) { areaEl.classList.add('err'); valid = false; }
    else areaEl.classList.remove('err');
  }
  if (!valid) { alert('Please fill in your name and WhatsApp number' + (isPickup ? '.' : ', and select your area.')); return; }

  const notes  = document.getElementById('coNotes').value.trim();
  const total  = cart.reduce((s,c) => s+c.price*c.qty, 0);
  const orderLines = cart.map(c => `  • ${c.name} x${c.qty} — ${(c.price*c.qty).toFixed(3)} KWD`).join('\n');

  let address = '';
  if (!isPickup) {
    const area   = document.getElementById('coArea').value;
    const block  = document.getElementById('coBlock').value.trim();
    const street = document.getElementById('coStreet').value.trim();
    const house  = document.getElementById('coHouse').value.trim();
    const floor  = document.getElementById('coFloor').value.trim();
    address = [area, block&&'Block '+block, street&&'Street '+street, house, floor].filter(Boolean).join(', ');
  }

  const msg = [
    '🌊 *Taj Mahal Jain Building Materials Co. Order* 🌊',
    '',
    '👤 *Name:* ' + name,
    '📞 *WhatsApp:* ' + phone,
    isPickup ? '🏪 *Fulfilment:* Store Pick Up' : '📍 *Delivery Address:* ' + address,
    notes ? '📝 *Notes:* ' + notes : '',
    '',
    '🛒 *Order:*',
    orderLines,
    '',
    '💰 *Total: ' + total.toFixed(3) + ' KWD*',
    '',
    'Please confirm my order. Thank you!'
  ].filter(l => l !== null).join('\n');

  // Deduct stock
  deductStock(cart);

  // Save order to Supabase
  saveOrderToSupabase({ name, phone, address: isPickup ? 'PICK UP' : address, notes, items: cart.map(c=>({name:c.name,sku:getProductSku(c.id),qty:c.qty,price:c.price})), total });

  // Open WhatsApp
  window.open('https://wa.me/96597656372?text=' + encodeURIComponent(msg), '_blank');

  // Show success, clear cart
  cart = [];
  updateCartUI();
  renderProducts();
  const nudgeHtml = !_authUser ? `
    <div class="order-nudge">
      <p><i class="fa fa-info-circle"></i> Create a free account to track this order and view your order history anytime.</p>
      <button onclick="document.getElementById('checkoutOverlay').classList.remove('open');openAuthModal('signup')">Create Account &rarr;</button>
    </div>` : '';
  document.getElementById('coBody').innerHTML = `
    <div class="co-success">
      <i class="fab fa-whatsapp"></i>
      <h3>Order Sent!</h3>
      <p>Your order has been sent to Taj Mahal Jain Building Materials Co. on WhatsApp.<br/>We will confirm and arrange delivery shortly.<br/><br/><strong>Thank you, ${name}!</strong></p>
      ${nudgeHtml}
      <br/>
      <button class="btn btn-primary" onclick="document.getElementById('checkoutOverlay').classList.remove('open');document.getElementById('coBody').innerHTML=origCoBody">Continue Shopping</button>
    </div>`;
});

// Store original checkout body to reset it
let origCoBody = '';
window.addEventListener('load', () => { origCoBody = document.getElementById('coBody').innerHTML; });

// ── EVENTS ────────────────────────────────────────────────────────────────
function $on(id, evt, fn) { var el = document.getElementById(id); if (el) el.addEventListener(evt, fn); }
window.addEventListener('scroll', () => document.getElementById('header').classList.toggle('scrolled', window.scrollY > 40));
$on('hamburger',       'click', () => document.getElementById('nav').classList.toggle('open'));
$on('cartBtn',         'click', openCart);
$on('mobCartFab',      'click', openCart);
$on('closeCart',       'click', () => document.getElementById('cartModal').classList.remove('open'));
$on('cartModal',       'click', e => { if (e.target === document.getElementById('cartModal')) document.getElementById('cartModal').classList.remove('open'); });
$on('checkoutBtn',     'click', openCheckout);
$on('closeCheckout',   'click', () => document.getElementById('checkoutOverlay').classList.remove('open'));
$on('checkoutOverlay', 'click', e => { if (e.target === document.getElementById('checkoutOverlay')) document.getElementById('checkoutOverlay').classList.remove('open'); });
document.querySelectorAll('.pill').forEach(pill => {
  pill.addEventListener('click', () => {
    activeFilter = pill.dataset.filter;
    syncCatNav(activeFilter);
    renderProducts();
  });
});
document.getElementById('searchInput').addEventListener('input', renderProducts);
document.getElementById('contactForm').addEventListener('submit', e => {
  e.preventDefault();
  document.getElementById('formSuccess').classList.add('show');
  e.target.reset();
  setTimeout(() => document.getElementById('formSuccess').classList.remove('show'), 4000);
});
// Render products immediately from hardcoded array (instant display)
// Supabase will update stock/photos/hidden status once it responds
renderProducts();
// Then load live data from Supabase and re-render
loadSBData();

// ── CATEGORY BACKGROUNDS (admin-editable) ────────────────────────────────
function applyCatBgs() {
  try {
    var bgs = JSON.parse(localStorage.getItem('jain_cat_bgs') || '{}');
    document.querySelectorAll('.cat-card[data-cat]').forEach(function(card) {
      var slug = card.dataset.cat;
      if (bgs[slug]) card.style.backgroundImage = "url('" + bgs[slug] + "')";
    });
  } catch(e) {}
}
applyCatBgs();

// ── MARQUEE AUTO-FILL ─────────────────────────────────────────────────────
function fillMarquee() {
  var track = document.querySelector('.marquee-track');
  if (!track) return;
  var origHTML = track.innerHTML;
  var singleW  = track.scrollWidth;
  if (!singleW) return;
  var vw      = window.innerWidth || 1280;
  var copies  = Math.max(3, Math.ceil(vw / singleW) + 2);
  var half = '';
  for (var i = 0; i < copies; i++) half += origHTML;
  track.innerHTML = half + half;
  track.style.animationDuration = Math.round((singleW * copies) / 100) + 's';
}
fillMarquee();

// ── TRANSLATIONS ──────────────────────────────────────────────────────────
var _lang = 'en';
var _T = {
  en: {
    nav_home:'Home', nav_about:'About', nav_products:'Products', nav_categories:'Categories', nav_contact:'Contact',
    cart_label:' Cart',
    hero_tag:'<i class="fa fa-shower"></i> Kuwait\'s #1 Bathroom &amp; Plumbing Store',
    hero_h1:'Quality <span>Bathrooms.</span><br/>Built for <span>Kuwait.</span>',
    hero_p:'Shataffa, toilet seats, LED lighting, taps, mixers, plumbing and bathroom accessories. Everything you need for your home — delivered fast across Kuwait and the GCC.',
    hero_shop:'Shop Now', hero_quote:'Get a Quote',
    stat_products:'Products', stat_genuine:'Genuine', stat_delivery:'Delivery',
    cat_tag:'Browse by Type',
    cat_h2:'Shop by <span class="orange">Category</span>',
    cat_power:'Shataffa', cat_hand:'Toilet Seats', cat_fasteners:'Lighting',
    cat_measuring:'Taps & Mixers', cat_safety:'Plumbing', cat_cutting:'Bathroom', cat_storage:'Sanitaryware', cat_all:'All Products',
    cat_power_sub:'Bidet Sprayers, Hoses, Valves', cat_hand_sub:'Soft-Close, Standard, Slim',
    cat_fasteners_sub:'LED Bulbs, Panels, Strips', cat_measuring_sub:'Basin, Kitchen, Shower Taps',
    cat_safety_sub:'Pipes, Fittings, Sealants', cat_cutting_sub:'Towel Rails, Mirrors, Holders',
    cat_storage_sub:'Basins, Toilets, Cisterns', cat_all_sub:'Browse our full catalog',
    pill_all:'All', pill_safety:'Plumbing', pill_cutting:'Bathroom', pill_storage:'Sanitary',
    prod_tag:'Full Catalog', prod_h2:'Our <span class="orange">Products</span>',
    prod_search:'Search shataffa, toilet seats, bulbs...',
    no_results:'No products found. Try a different search.',
    cart_title:'Your Cart', cart_empty:'Your cart is empty.',
    cart_total_label:'Total:', cart_wa:'Request Quote on WhatsApp',
    feat_delivery_h:'Fast Delivery', feat_delivery_p:'Same-day delivery in Kuwait City. GCC shipping in 3-5 business days.',
    feat_genuine_h:'100% Genuine', feat_genuine_p:'All products are sourced directly from authorised distributors and manufacturers.',
    feat_advice_h:'Expert Advice', feat_advice_p:'Our hardware experts help you choose the right tool for every job.',
    feat_pricing_h:'Trade Pricing', feat_pricing_p:'Bulk and trade discounts available for contractors and businesses.',
    contact_tag:'Get In Touch', contact_h2:'We\'re Here to <span class="orange">Help</span>',
    contact_p:'Need a specific tool? Looking for a bulk quote? Our team is ready to assist you in Arabic and English.',
    contact_loc_label:'Location', contact_loc:'Kuwait City, Kuwait',
    contact_email_label:'Email', contact_phone_label:'Phone / WhatsApp',
    contact_hours_label:'Working Hours', contact_hours:'Sat-Thu: 7 AM - 8 PM',
    form_name:'Full Name', form_name_ph:'Ahmed Al-Mutairi',
    form_phone:'Phone / WhatsApp', form_email:'Email', form_need:'What do you need?',
    form_msg:'Message', form_msg_ph:'Tell us what tools or materials you need...',
    form_send:'Send Message', form_success:'Message sent! We will get back to you shortly.',
    form_opt1:'General Enquiry', form_opt2:'Bulk / Trade Order', form_opt3:'Product Availability',
    form_opt4:'Technical Advice', form_opt5:'Delivery Information', form_opt6:'Other',
    about_tag:'Who We Are', about_h2:'Your Trusted <span class="orange">Hardware</span> Partner',
    about_badge:'Kuwait',
    about_p1:'Taj Mahal Jain Building Materials Co. is Kuwait\'s trusted destination for hardware tools and building materials. Power tools, hand tools, fasteners, safety gear, measuring tools and accessories — all under one roof.',
    about_p2:'We stock only genuine, quality-tested products from trusted brands, with competitive prices and expert advice available in Arabic and English.',
    about_f1:'100% genuine, quality-tested products', about_f2:'Expert advice in Arabic and English',
    about_f3:'Same-day delivery within Kuwait City', about_f4:'Bulk pricing for contractors and businesses',
    about_f5:'Easy returns and after-sales support', about_cta:'Contact Us',
    footer_desc:'Kuwait\'s trusted supplier of bathroom, plumbing and sanitary supplies since 2024.',
    footer_nav:'Navigation', footer_cats:'Categories', footer_support:'Support',
    footer_trade:'Trade Accounts', footer_bulk:'Bulk Orders', footer_delivery_info:'Delivery Info',
    footer_returns:'Returns Policy', footer_tech:'Technical Help',
    footer_copy:'2024 Taj Mahal Jain Building Materials Co. All rights reserved. Kuwait.',
    intro_tag:'Welcome to Taj Mahal Jain Building Materials Co.',
    intro_h2:'Kuwait\'s Go-To <span class="orange">Bathroom & Plumbing</span> Store — Open 7 Days',
    intro_p:'Taj Mahal Jain Building Materials Co. supplies power tools, hand tools, fasteners, safety gear, measuring tools and accessories to contractors and businesses across Kuwait. Whether you need one item or a full site order — we have it in stock and ready to go.',
    intro_c1:'60+ Products In Stock', intro_c2:'Same-Day Kuwait Delivery',
    intro_c3:'Bulk & Trade Pricing', intro_c4:'Arabic & English Support',
    intro_cta_text:'Call Us: 6660 9391',
    co_title:'Complete Your Order', co_order_sum:'Order Summary', co_your_details:'Your Details',
    co_delivery_addr:'Delivery Address', co_total_label:'Total Amount',
    co_full_name:'Full Name *', co_wa_num:'WhatsApp Number *', co_area:'Area *',
    co_block:'Block', co_street:'Street', co_house:'House / Building',
    co_floor:'Floor / Apt', co_notes:'Notes', co_submit:'Send Order on WhatsApp',
    back_btn:'Back to Products',
    lang_switch:'عربي',
    mq_items:['Power Tools','Hand Tools','Fasteners','Safety Gear','Measuring Tools','Cutting Tools','Drill Bits','Tool Storage','Accessories']
  },
  ar: {
    nav_home:'الرئيسية', nav_about:'من نحن', nav_products:'المنتجات', nav_categories:'الفئات', nav_contact:'اتصل بنا',
    cart_label:' سلة',
    hero_tag:'<i class="fa fa-tools"></i> محل الأدوات والمعدات الأول في الكويت',
    hero_h1:'ابنِ بقوة.<br/>صُنع لـ<span>الكويت.</span>',
    hero_p:'شتافة، أغطية مراحيض، إضاءة LED، صنابير وخلاطات، سباكة وإكسسوارات الحمام. كل ما تحتاجه لمنزلك — توصيل سريع في جميع أنحاء الكويت ودول الخليج.',
    hero_shop:'تسوق الآن', hero_quote:'احصل على عرض سعر',
    stat_products:'منتج', stat_genuine:'أصلي', stat_delivery:'توصيل خليجي',
    cat_tag:'تصفح حسب النوع',
    cat_h2:'تسوق حسب <span class="orange">الفئة</span>',
    cat_power:'شتافة', cat_hand:'أغطية مراحيض', cat_fasteners:'إضاءة',
    cat_measuring:'صنابير وخلاطات', cat_safety:'سباكة', cat_cutting:'إكسسوارات الحمام', cat_storage:'أدوات صحية', cat_all:'جميع المنتجات',
    cat_power_sub:'رشاشات، خراطيم، صمامات', cat_hand_sub:'إغلاق بطيء، قياسي، سليم',
    cat_fasteners_sub:'لمبات LED، ألواح، أشرطة', cat_measuring_sub:'صنابير حوض، مطبخ، دش',
    cat_safety_sub:'مواسير، وصلات، مواد إحكام', cat_cutting_sub:'حوامل مناشف، مرايا، حاملات',
    cat_storage_sub:'أحواض، مراحيض، خزانات', cat_all_sub:'تصفح كتالوجنا الكامل',
    pill_all:'الكل', pill_safety:'سباكة', pill_cutting:'حمام', pill_storage:'صحي',
    prod_tag:'الكتالوج الكامل', prod_h2:'<span class="orange">منتجاتنا</span>',
    prod_search:'ابحث عن شتافة، غطاء مرحاض، لمبة...',
    no_results:'لا توجد منتجات. جرب بحثاً مختلفاً.',
    cart_title:'سلة التسوق', cart_empty:'سلة التسوق فارغة.',
    cart_total_label:'المجموع:', cart_wa:'طلب عرض سعر عبر واتساب',
    feat_delivery_h:'توصيل سريع', feat_delivery_p:'توصيل في نفس اليوم داخل مدينة الكويت. الشحن الخليجي خلال 3-5 أيام عمل.',
    feat_genuine_h:'100% أصلي', feat_genuine_p:'جميع المنتجات مصدرها مباشرة من الموزعين والمصنعين المعتمدين.',
    feat_advice_h:'نصيحة متخصصة', feat_advice_p:'خبراؤنا في الأدوات يساعدونك في اختيار الأداة المناسبة لكل مهمة.',
    feat_pricing_h:'أسعار تجارية', feat_pricing_p:'خصومات بالجملة والتجزئة متاحة للمقاولين والشركات.',
    contact_tag:'تواصل معنا', contact_h2:'نحن هنا <span class="orange">لمساعدتك</span>',
    contact_p:'تحتاج أداة معينة؟ تبحث عن عرض سعر بالجملة؟ فريقنا جاهز لمساعدتك بالعربية والإنجليزية.',
    contact_loc_label:'الموقع', contact_loc:'مدينة الكويت، الكويت',
    contact_email_label:'البريد الإلكتروني', contact_phone_label:'الهاتف / واتساب',
    contact_hours_label:'ساعات العمل', contact_hours:'السبت-الخميس: 7 ص - 8 م',
    form_name:'الاسم الكامل', form_name_ph:'أحمد المطيري',
    form_phone:'الهاتف / واتساب', form_email:'البريد الإلكتروني', form_need:'ماذا تحتاج؟',
    form_msg:'الرسالة', form_msg_ph:'أخبرنا بالأدوات أو المواد التي تحتاجها...',
    form_send:'إرسال الرسالة', form_success:'تم إرسال الرسالة! سنتواصل معك قريباً.',
    form_opt1:'استفسار عام', form_opt2:'طلب بالجملة / تجاري', form_opt3:'توفر منتج',
    form_opt4:'نصيحة تقنية', form_opt5:'معلومات التوصيل', form_opt6:'أخرى',
    about_tag:'من نحن', about_h2:'شريكك الموثوق في <span class="orange">الأدوات</span>',
    about_badge:'الكويت',
    about_p1:'رواج هي وجهتك الموثوقة في الكويت لمستلزمات الحمام والسباكة. شتافة، أغطية مراحيض، إضاءة LED، صنابير وخلاطات وإكسسوارات الحمام — كل شيء تحت سقف واحد.',
    about_p2:'نحن نخزن منتجات أصلية مختبرة جودتها من علامات تجارية موثوقة، بأسعار تنافسية ونصائح من خبراء باللغتين العربية والإنجليزية.',
    about_f1:'منتجات 100% أصلية ومختبرة الجودة', about_f2:'نصائح من خبراء بالعربية والإنجليزية',
    about_f3:'توصيل في نفس اليوم داخل مدينة الكويت', about_f4:'أسعار بالجملة للمقاولين والشركات',
    about_f5:'إرجاع سهل ودعم ما بعد البيع', about_cta:'اتصل بنا',
    footer_desc:'مورد موثوق للأدوات الجودة والأدوات الكهربائية ومواد البناء في الكويت منذ 2024.',
    footer_nav:'التنقل', footer_cats:'الفئات', footer_support:'الدعم',
    footer_trade:'الحسابات التجارية', footer_bulk:'الطلبات بالجملة', footer_delivery_info:'معلومات التوصيل',
    footer_returns:'سياسة الإرجاع', footer_tech:'المساعدة التقنية',
    footer_copy:'2024 بحر الهند. جميع الحقوق محفوظة. الكويت.',
    intro_tag:'مرحباً بك في بحر الهند',
    intro_h2:'المتجر الأول للحمامات والسباكة في الكويت — <span class="orange">مفتوح 7 أيام</span>',
    intro_p:'بحر الهند توفر شتافة، أغطية مراحيض، إضاءة LED، صنابير وخلاطات ومستلزمات الحمام للمقاولين والشركات والأفراد في جميع أنحاء الكويت. سواء احتجت قطعة واحدة أو طلباً كاملاً — لدينا المخزون وجاهز.',
    intro_c1:'60+ منتج في المخزون', intro_c2:'توصيل في نفس اليوم بالكويت',
    intro_c3:'أسعار الجملة والتجارة', intro_c4:'دعم بالعربية والإنجليزية',
    intro_cta_text:'اتصل بنا: 6660 9391',
    co_title:'أكمل طلبك', co_order_sum:'ملخص الطلب', co_your_details:'بياناتك',
    co_delivery_addr:'عنوان التوصيل', co_total_label:'المبلغ الإجمالي',
    co_full_name:'الاسم الكامل *', co_wa_num:'رقم واتساب *', co_area:'المنطقة *',
    co_block:'القطعة', co_street:'الشارع', co_house:'المنزل / المبنى',
    co_floor:'الطابق / الشقة', co_notes:'ملاحظات', co_submit:'إرسال الطلب عبر واتساب',
    back_btn:'العودة للمنتجات',
    lang_switch:'EN',
    mq_items:['أدوات كهربائية','أدوات يدوية','مسامير وبراغي','معدات السلامة','أدوات القياس','أدوات القطع','رؤوس الحفر','تخزين الأدوات','إكسسوارات']
  }
};

function setLang(lang) {
  _lang = lang;
  localStorage.setItem('bahar_lang', lang);
  var html = document.documentElement;
  html.lang = lang;
  html.dir  = lang === 'ar' ? 'rtl' : 'ltr';

  var btn = document.getElementById('langBtn');
  if (btn) btn.textContent = _T[lang].lang_switch;

  var t = _T[lang];

  // textContent replacements
  document.querySelectorAll('[data-i18n]').forEach(function(el) {
    var k = el.getAttribute('data-i18n');
    if (t[k] !== undefined) el.textContent = t[k];
  });

  // innerHTML replacements (elements containing nested HTML like spans)
  document.querySelectorAll('[data-i18n-html]').forEach(function(el) {
    var k = el.getAttribute('data-i18n-html');
    if (t[k] !== undefined) el.innerHTML = t[k];
  });

  // placeholder replacements
  document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
    var k = el.getAttribute('data-i18n-placeholder');
    if (t[k] !== undefined) el.placeholder = t[k];
  });

  // Re-render product cards with translated names/descriptions
  if (typeof renderProducts === 'function') renderProducts();

  // Rebuild marquee with translated items
  var track = document.querySelector('.marquee-track');
  if (track && t.mq_items) {
    track.innerHTML = t.mq_items.map(function(item) {
      return '<span>' + item + '</span><span class="sep">&nbsp;&#183;&nbsp;</span>';
    }).join('');
    fillMarquee();
  }
}

function toggleLang() {
  setLang(_lang === 'en' ? 'ar' : 'en');
}

// Apply saved language on load
(function() {
  var saved = localStorage.getItem('bahar_lang');
  if (saved === 'ar') setLang('ar');
})();

// ── SAVE ORDER TO SUPABASE ────────────────────────────────────────────────────
// Saves the order and links it to the logged-in user (or null for guests).
// Guest orders are also stored in localStorage so they can be viewed in "My Orders".
async function saveOrderToSupabase(order) {
  const payload = [{
    customer_name:  order.name,
    customer_phone: order.phone,
    address:        order.address,
    notes:          order.notes || '',
    items:          order.items,
    total:          parseFloat(order.total.toFixed(3)),
    status:         'pending',
    user_id:        (_authUser ? _authUser.id : null)   // link to account if logged in
  }];
  console.log('[JainHardware] Saving order:', payload);
  const result = await sbFetch(SB_URL + '/rest/v1/jain_orders', {
    method: 'POST',
    headers: Object.assign({}, SB_H, {
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }),
    body: JSON.stringify(payload)
  });
  if (result.error) {
    console.error('[JainHardware] Order save FAILED:', result.error);
    // Still save to localStorage as a fallback
  } else {
    console.log('[JainHardware] Order saved OK:', result.data);
  }
  // If guest → also store in localStorage so they can see it in My Orders
  if (!_authUser) {
    const guestOrder = {
      id: (result.data && result.data[0] && result.data[0].id) || ('guest-' + Date.now()),
      customer_name:  order.name,
      customer_phone: order.phone,
      address:        order.address,
      items:          order.items,
      total:          parseFloat(order.total.toFixed(3)),
      status:         'pending',
      created_at:     new Date().toISOString()
    };
    saveGuestOrder(guestOrder);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//   USER ACCOUNTS — Supabase Auth + Profile + My Orders
// ═══════════════════════════════════════════════════════════════════════════════

// Current logged-in user state
let _authUser    = null;   // { id, email } or null
let _authToken   = null;   // JWT access token string
let _userProfile = null;   // { id, name, phone, address } from jain_customers

// ── Session helpers ────────────────────────────────────────────────────────────
function getAuthHeaders() {
  return {
    'apikey':        SB_KEY,
    'Authorization': 'Bearer ' + (_authToken || SB_KEY),
    'Content-Type':  'application/json'
  };
}
function saveAuthSession(data) {
  _authToken = data.access_token;
  _authUser  = { id: data.user.id, email: data.user.email };
  localStorage.setItem('jain_access_token',  data.access_token);
  localStorage.setItem('jain_refresh_token', data.refresh_token);
  localStorage.setItem('jain_user_id',       data.user.id);
  localStorage.setItem('jain_user_email',    data.user.email);
}
function clearAuthSession() {
  _authUser  = null;
  _authToken = null;
  _userProfile = null;
  localStorage.removeItem('jain_access_token');
  localStorage.removeItem('jain_refresh_token');
  localStorage.removeItem('jain_user_id');
  localStorage.removeItem('jain_user_email');
}

// ── Init auth on page load ─────────────────────────────────────────────────────
// Tries to restore session from localStorage, refreshes the token silently.
async function initAuth() {
  const token  = localStorage.getItem('jain_access_token');
  const refresh = localStorage.getItem('jain_refresh_token');
  const uid    = localStorage.getItem('jain_user_id');
  const email  = localStorage.getItem('jain_user_email');
  if (token && uid && email) {
    _authToken = token;
    _authUser  = { id: uid, email: email };
    // Silently refresh token (in background)
    _refreshSession(refresh);
    await loadUserProfile();
    updateHeaderForAuth();
  } else {
    // Show login prompt after 2.5 s, but only if never dismissed
    if (!localStorage.getItem('jain_lp_dismissed')) {
      setTimeout(showLoginPrompt, 2500);
    }
    updateHeaderForAuth();
  }
}

async function _refreshSession(refreshToken) {
  if (!refreshToken) return;
  try {
    const res  = await fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    if (!res.ok) { clearAuthSession(); updateHeaderForAuth(); return; }
    const data = await res.json();
    _authToken = data.access_token;
    localStorage.setItem('jain_access_token',  data.access_token);
    localStorage.setItem('jain_refresh_token', data.refresh_token);
  } catch(e) {}
}

// ── Auth actions ────────────────────────────────────────────────────────────────
async function authSignUp(name, email, password) {
  const res  = await fetch(SB_URL + '/auth/v1/signup', {
    method: 'POST',
    headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error_description || data.msg || 'Sign up failed. Try a different email.' };
  if (data.access_token) {
    // Email confirmations disabled — logged in immediately
    saveAuthSession(data);
    if (name) await saveUserProfile(name, '', '');
    await loadUserProfile();
    updateHeaderForAuth();
    return { error: null, confirmed: true };
  }
  // Email confirmation required
  return { error: null, confirmed: false };
}

async function authSignIn(email, password) {
  const res  = await fetch(SB_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error_description || 'Wrong email or password.' };
  saveAuthSession(data);
  await loadUserProfile();
  updateHeaderForAuth();
  return { error: null };
}

async function authSignOut() {
  if (_authToken) {
    fetch(SB_URL + '/auth/v1/logout', {
      method: 'POST',
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + _authToken }
    }).catch(() => {});
  }
  clearAuthSession();
  updateHeaderForAuth();
}

async function authForgotPassword(email) {
  const res = await fetch(SB_URL + '/auth/v1/recover', {
    method: 'POST',
    headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  return res.ok;
}

// ── Profile ────────────────────────────────────────────────────────────────────
async function loadUserProfile() {
  if (!_authUser) return;
  try {
    const res  = await fetch(SB_URL + '/rest/v1/jain_customers?id=eq.' + _authUser.id + '&select=*', {
      headers: getAuthHeaders()
    });
    if (!res.ok) return;
    const rows = await res.json();
    if (rows && rows.length) _userProfile = rows[0];
  } catch(e) {}
}

async function saveUserProfile(name, phone, address) {
  if (!_authUser) return false;
  const payload = [{ id: _authUser.id, name: name || '', phone: phone || '', address: address || '' }];
  try {
    const res = await fetch(SB_URL + '/rest/v1/jain_customers', {
      method:  'POST',
      headers: Object.assign({}, getAuthHeaders(), { 'Prefer': 'resolution=merge-duplicates' }),
      body:    JSON.stringify(payload)
    });
    if (res.ok) {
      _userProfile = { id: _authUser.id, name, phone, address };
      return true;
    }
  } catch(e) {}
  return false;
}

// ── My Orders ──────────────────────────────────────────────────────────────────
async function loadMyOrders() {
  if (_authUser) {
    // Logged in: fetch from Supabase
    try {
      const res  = await fetch(SB_URL + '/rest/v1/jain_orders?user_id=eq.' + _authUser.id + '&order=created_at.desc&select=*', {
        headers: getAuthHeaders()
      });
      if (res.ok) return await res.json();
    } catch(e) {}
  }
  // Guest: return localStorage orders
  try { return JSON.parse(localStorage.getItem('jain_guest_orders') || '[]'); } catch(e) { return []; }
}

// ── Guest order store ──────────────────────────────────────────────────────────
function saveGuestOrder(order) {
  try {
    const orders = JSON.parse(localStorage.getItem('jain_guest_orders') || '[]');
    orders.unshift(order);
    localStorage.setItem('jain_guest_orders', JSON.stringify(orders.slice(0, 30)));
  } catch(e) {}
}

// ── Header update ──────────────────────────────────────────────────────────────
function updateHeaderForAuth() {
  const btn   = document.getElementById('accountBtn');
  const label = document.getElementById('acctBtnLabel');
  if (btn && label) {
    if (_authUser) {
      const initial = (_userProfile && _userProfile.name)
        ? _userProfile.name.charAt(0).toUpperCase()
        : _authUser.email.charAt(0).toUpperCase();
      btn.classList.add('signed-in');
      label.innerHTML =
        '<span style="background:#fff;color:#c8151b;border-radius:50%;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;flex-shrink:0">' + initial + '</span>' +
        '<span class="acct-txt">&nbsp;My Account</span>';
    } else {
      btn.classList.remove('signed-in');
      label.innerHTML = '<span class="acct-txt">Sign In</span>';
    }
  }
  // Show/hide My Orders & Sign In links in mobile nav
  var navOrders = document.getElementById('navMyOrders');
  var navSignIn = document.getElementById('navSignIn');
  if (navOrders) navOrders.style.display = _authUser ? '' : 'none';
  if (navSignIn) navSignIn.style.display = _authUser ? 'none' : '';
}

// ── Header button click ────────────────────────────────────────────────────────
function onAccountBtnClick() {
  if (_authUser) openAcctModal();
  else openAuthModal('login');
}

// ── Login welcome prompt ───────────────────────────────────────────────────────
function showLoginPrompt() {
  if (_authUser) return; // already logged in
  const el = document.getElementById('loginPrompt');
  if (el) el.style.display = 'block';
}
function dismissLoginPrompt() {
  const el = document.getElementById('loginPrompt');
  if (el) el.style.display = 'none';
  localStorage.setItem('jain_lp_dismissed', '1');
}

// ── Auth Modal ─────────────────────────────────────────────────────────────────
function openAuthModal(tab) {
  document.getElementById('authOverlay').classList.add('open');
  switchAuthTab(tab || 'login');
  _clearAuthMessages();
}
function closeAuthModal() {
  document.getElementById('authOverlay').classList.remove('open');
  _clearAuthMessages();
}
function switchAuthTab(tab) {
  document.getElementById('authLoginForm').style.display  = tab === 'login'  ? '' : 'none';
  document.getElementById('authSignupForm').style.display = tab === 'signup' ? '' : 'none';
  document.getElementById('authForgotForm').style.display = tab === 'forgot' ? '' : 'none';
  document.getElementById('authTabLogin').classList.toggle('active',  tab === 'login');
  document.getElementById('authTabSignup').classList.toggle('active', tab === 'signup');
  // Show/hide tab buttons (hide them on forgot screen)
  document.getElementById('authTabLogin').style.display  = tab === 'forgot' ? 'none' : '';
  document.getElementById('authTabSignup').style.display = tab === 'forgot' ? 'none' : '';
  _clearAuthMessages();
}
function _clearAuthMessages() {
  const err = document.getElementById('authErr');
  const ok  = document.getElementById('authOk');
  if (err) { err.textContent = ''; err.classList.remove('show'); }
  if (ok)  { ok.textContent  = ''; ok.classList.remove('show'); }
}
function _showAuthErr(msg) {
  const el = document.getElementById('authErr');
  if (el) { el.textContent = msg; el.classList.add('show'); }
}
function _showAuthOk(msg) {
  const el = document.getElementById('authOk');
  if (el) { el.textContent = msg; el.classList.add('show'); }
}

async function doAuthLogin() {
  const email = (document.getElementById('authLoginEmail').value || '').trim();
  const pass  = document.getElementById('authLoginPass').value;
  _clearAuthMessages();
  if (!email || !pass) { _showAuthErr('Please enter your email and password.'); return; }
  const btn = document.getElementById('authLoginBtn');
  btn.disabled = true; btn.textContent = 'Signing in…';
  const result = await authSignIn(email, pass);
  btn.disabled = false; btn.innerHTML = '<i class="fa fa-sign-in-alt"></i> Sign In';
  if (result.error) { _showAuthErr(result.error); return; }
  closeAuthModal();
  openAcctModal();
}

async function doAuthSignup() {
  const name  = (document.getElementById('authSignupName').value  || '').trim();
  const email = (document.getElementById('authSignupEmail').value || '').trim();
  const pass  = document.getElementById('authSignupPass').value;
  _clearAuthMessages();
  if (!email || !pass) { _showAuthErr('Please enter your email and password.'); return; }
  if (pass.length < 6)  { _showAuthErr('Password must be at least 6 characters.'); return; }
  const btn = document.getElementById('authSignupBtn');
  btn.disabled = true; btn.textContent = 'Creating account…';
  const result = await authSignUp(name, email, pass);
  btn.disabled = false; btn.innerHTML = '<i class="fa fa-user-plus"></i> Create Account';
  if (result.error) { _showAuthErr(result.error); return; }
  if (result.confirmed) {
    _showAuthOk('✅ Account created! Welcome, ' + (name || email) + '!');
    setTimeout(() => { closeAuthModal(); openAcctModal(); }, 1200);
  } else {
    _showAuthOk('📧 Check your email for a confirmation link, then sign in.');
    setTimeout(() => switchAuthTab('login'), 2500);
  }
}

async function doAuthForgot() {
  const email = (document.getElementById('authForgotEmail').value || '').trim();
  _clearAuthMessages();
  if (!email) { _showAuthErr('Please enter your email address.'); return; }
  const btn = document.getElementById('authForgotBtn');
  btn.disabled = true; btn.textContent = 'Sending…';
  const ok = await authForgotPassword(email);
  btn.disabled = false; btn.innerHTML = '<i class="fa fa-envelope"></i> Send Reset Link';
  if (ok) {
    _showAuthOk('📧 Reset link sent! Check your email inbox (and spam folder).');
  } else {
    _showAuthErr('Could not send reset email. Check the address and try again.');
  }
}

// ── Account Modal (Profile + My Orders) ───────────────────────────────────────
async function openAcctModal() {
  if (!_authUser) { openAuthModal('login'); return; }
  // Fill in header info
  const initial = (_userProfile && _userProfile.name)
    ? _userProfile.name.charAt(0).toUpperCase()
    : _authUser.email.charAt(0).toUpperCase();
  document.getElementById('acctAvatar').textContent = initial;
  document.getElementById('acctUname').textContent  = (_userProfile && _userProfile.name) || 'My Account';
  document.getElementById('acctUemail').textContent = _authUser.email;
  // Fill profile fields
  if (_userProfile) {
    document.getElementById('profName').value    = _userProfile.name    || '';
    document.getElementById('profPhone').value   = _userProfile.phone   || '';
    document.getElementById('profAddress').value = _userProfile.address || '';
  }
  switchAcctTab('profile');
  document.getElementById('acctOverlay').classList.add('open');
}
function closeAcctModal() {
  document.getElementById('acctOverlay').classList.remove('open');
}
function switchAcctTab(tab) {
  document.getElementById('acctProfilePane').style.display = tab === 'profile' ? '' : 'none';
  document.getElementById('acctOrdersPane').style.display  = tab === 'orders'  ? '' : 'none';
  document.getElementById('acctTabProfile').classList.toggle('active', tab === 'profile');
  document.getElementById('acctTabOrders').classList.toggle('active',  tab === 'orders');
  if (tab === 'orders') renderMyOrders();
}

async function doSaveProfile() {
  const name    = document.getElementById('profName').value.trim();
  const phone   = document.getElementById('profPhone').value.trim();
  const address = document.getElementById('profAddress').value.trim();
  const ok = await saveUserProfile(name, phone, address);
  const okEl = document.getElementById('acctOk');
  if (ok) {
    okEl.textContent = '✅ Profile saved!';
    okEl.classList.add('show');
    // Update header initial
    updateHeaderForAuth();
    document.getElementById('acctAvatar').textContent = name ? name.charAt(0).toUpperCase() : _authUser.email.charAt(0).toUpperCase();
    document.getElementById('acctUname').textContent  = name || 'My Account';
    setTimeout(() => okEl.classList.remove('show'), 3000);
  } else {
    okEl.textContent  = '⚠️ Could not save. Please try again.';
    okEl.style.background = 'rgba(239,68,68,.07)';
    okEl.style.borderColor = 'rgba(239,68,68,.25)';
    okEl.style.color = '#dc2626';
    okEl.classList.add('show');
    setTimeout(() => { okEl.classList.remove('show'); okEl.style = ''; }, 3000);
  }
}

async function doSignOut() {
  await authSignOut();
  closeAcctModal();
}

async function renderMyOrders() {
  const container = document.getElementById('myOrdersList');
  container.innerHTML = '<div class="myo-loading"><i class="fa fa-spinner fa-spin"></i> Loading orders…</div>';
  const orders = await loadMyOrders();
  if (!orders || !orders.length) {
    container.innerHTML = `
      <div class="myo-empty">
        <i class="fa fa-receipt"></i>
        <p>No orders yet</p>
        <small>Your order history will appear here after you place an order.</small>
      </div>`;
    return;
  }
  const statusClass = { pending:'myo-pending', confirmed:'myo-confirmed', delivered:'myo-delivered', cancelled:'myo-cancelled' };
  container.innerHTML = orders.map(function(o) {
    const items = Array.isArray(o.items)
      ? o.items.map(i => i.name + ' &times;' + i.qty).join('<br>')
      : (o.items || '');
    const date = o.created_at
      ? new Date(o.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
      : '';
    const status   = (o.status || 'pending').toLowerCase();
    const statusCls = statusClass[status] || 'myo-pending';
    const shortId  = String(o.id || '').slice(-6).toUpperCase();
    return `
      <div class="myo-card">
        <div class="myo-top">
          <div class="myo-meta">
            <span class="myo-id">Order #${shortId}</span>
            <span class="myo-date">${date}</span>
          </div>
          <span class="myo-status ${statusCls}">${status}</span>
        </div>
        <div class="myo-items">${items}</div>
        <div class="myo-footer">
          <span class="myo-total">${parseFloat(o.total || 0).toFixed(3)} KWD</span>
          <span class="myo-addr">${o.address || ''}</span>
        </div>
      </div>`;
  }).join('');
}

// ── Kick off auth on page load ─────────────────────────────────────────────────
initAuth();

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE: RECENTLY VIEWED
// ══════════════════════════════════════════════════════════════════════════════
function trackRecentlyViewed(id) {
  var list = JSON.parse(localStorage.getItem('jain_recently_viewed') || '[]');
  list = list.filter(function(x){ return x !== id; });
  list.unshift(id);
  if (list.length > 6) list = list.slice(0, 6);
  localStorage.setItem('jain_recently_viewed', JSON.stringify(list));
  renderRecentlyViewed();
}
function renderRecentlyViewed() {
  var section = document.getElementById('recentlyViewedSection');
  if (!section) return;
  var list = JSON.parse(localStorage.getItem('jain_recently_viewed') || '[]');
  var all = getAllProducts();
  var products = list.map(function(id){ return all.find(function(p){ return p.id === id; }); }).filter(Boolean);
  if (products.length < 2) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  var customPhotos = _sbPhotos || {};
  document.getElementById('recentlyViewedGrid').innerHTML = products.map(function(p) {
    var raw = customPhotos[p.id];
    var photo = (raw && (raw.startsWith('http') || raw.startsWith('data:'))) ? raw : p.img;
    var wishlisted = isWishlisted(p.id);
    return '<div class="rv-card" onclick="openProduct('+p.id+')">' +
      '<img src="'+photo+'" alt="'+p.name+'" onerror="imgError(this)" />' +
      '<div class="rv-name">'+p.name+'</div>' +
      '<div class="rv-price">'+p.price.toFixed(3)+' KWD</div>' +
    '</div>';
  }).join('');
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE: WISHLIST
// ══════════════════════════════════════════════════════════════════════════════
function getWishlist() {
  try { return JSON.parse(localStorage.getItem('jain_wishlist') || '[]'); } catch(e) { return []; }
}
function isWishlisted(id) { return getWishlist().includes(id); }
function showToast(msg, duration) {
  var el = document.getElementById('toastMsg');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(function(){ el.classList.remove('show'); }, duration || 2500);
}

function toggleWishlist(id, event) {
  if (event) event.stopPropagation();
  var list = getWishlist();
  if (list.includes(id)) {
    list = list.filter(function(x){ return x !== id; });
    showToast('Removed from wishlist');
  } else {
    list.push(id);
    showToast('❤️ Added to wishlist!');
  }
  localStorage.setItem('jain_wishlist', JSON.stringify(list));
  renderWishlistCount();
  renderProducts();
  renderRecentlyViewed();
}
function renderWishlistCount() {
  var count = getWishlist().length;
  var badge = document.getElementById('wishlistBadge');
  var navBadge = document.getElementById('navWishlistBadge');
  if (badge) { badge.textContent = count; badge.style.display = count ? 'flex' : 'none'; }
  if (navBadge) { navBadge.textContent = count; navBadge.style.display = count ? 'inline' : 'none'; }
}
function openWishlist() {
  var list = getWishlist();
  var all = getAllProducts();
  var products = list.map(function(id){ return all.find(function(p){ return p.id===id; }); }).filter(Boolean);
  var overlay = document.getElementById('wishlistOverlay');
  var body = document.getElementById('wishlistBody');
  if (!overlay || !body) return;
  if (!products.length) {
    body.innerHTML = '<div style="text-align:center;padding:40px;color:#999"><i class="fa fa-heart" style="font-size:40px;margin-bottom:12px;display:block;opacity:0.3"></i><p>No saved items yet.<br>Tap the ❤️ on any product to save it.</p></div>';
  } else {
    var customPhotos = _sbPhotos || {};
    body.innerHTML = products.map(function(p) {
      var raw = customPhotos[p.id];
      var photo = (raw && (raw.startsWith('http') || raw.startsWith('data:'))) ? raw : p.img;
      return '<div class="wl-item">' +
        '<img src="'+photo+'" alt="'+p.name+'" onclick="closeWishlist();openProduct('+p.id+')" onerror="imgError(this)" />' +
        '<div class="wl-info" onclick="closeWishlist();openProduct('+p.id+')">' +
          '<div class="wl-name">'+p.name+'</div>' +
          '<div class="wl-price">'+p.price.toFixed(3)+' KWD</div>' +
        '</div>' +
        '<div class="wl-actions">' +
          '<button class="wl-add-btn" onclick="addToCart('+p.id+');showToast(\'Added to cart\')"><i class="fa fa-cart-plus"></i> Add to Cart</button>' +
          '<button class="wl-remove-btn" onclick="toggleWishlist('+p.id+', event)"><i class="fa fa-trash"></i></button>' +
        '</div>' +
      '</div>';
    }).join('');
  }
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeWishlist() {
  var overlay = document.getElementById('wishlistOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE: SHARE PRODUCT ON WHATSAPP
// ══════════════════════════════════════════════════════════════════════════════
function shareProduct(id) {
  var p = getAllProducts().find(function(x){ return x.id === id; });
  if (!p) return;
  var url = 'https://mukarramkebra.github.io/Hardware-Website/';
  var msg = '🔧 *' + p.name + '*\n💰 ' + p.price.toFixed(3) + ' KWD\n\nCheck it out at Taj Mahal Jain Building Materials Co., Kuwait:\n' + url;
  window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE: PRODUCT REVIEWS & RATINGS
// ══════════════════════════════════════════════════════════════════════════════
var _currentReviewProductId = null;
var _selectedStars = 0;

function renderStarsDisplay(rating, size) {
  var full = Math.round(rating || 0);
  var out = '';
  for (var i = 1; i <= 5; i++) {
    out += '<i class="fa fa-star" style="color:'+(i<=full?'#f5c518':'#ddd')+';font-size:'+(size||14)+'px"></i>';
  }
  return out;
}
function openReviews(id) {
  _currentReviewProductId = id;
  _selectedStars = 0;
  var p = getAllProducts().find(function(x){ return x.id === id; });
  var overlay = document.getElementById('reviewOverlay');
  if (!overlay) return;
  document.getElementById('reviewProductName').textContent = p ? p.name : '';
  document.getElementById('reviewStarInput').innerHTML = [1,2,3,4,5].map(function(s){
    return '<i class="fa fa-star rev-star-btn" data-star="'+s+'" onclick="selectStar('+s+')" style="font-size:28px;color:#ddd;cursor:pointer;padding:4px"></i>';
  }).join('');
  document.getElementById('reviewNameInput').value = '';
  document.getElementById('reviewCommentInput').value = '';
  document.getElementById('reviewErr').textContent = '';
  loadReviews(id);
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeReviews() {
  var overlay = document.getElementById('reviewOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}
function selectStar(n) {
  _selectedStars = n;
  var stars = document.querySelectorAll('.rev-star-btn');
  stars.forEach(function(s, i) {
    s.style.color = i < n ? '#f5c518' : '#ddd';
  });
}
async function loadReviews(id) {
  var list = document.getElementById('reviewList');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:20px;color:#aaa"><i class="fa fa-spinner fa-spin"></i></div>';
  try {
    var res = await sbFetch(SB_URL + '/rest/v1/jain_reviews?product_id=eq.'+id+'&order=created_at.desc', { headers: SB_H });
    if (res.error || !res.data || !res.data.length) {
      list.innerHTML = '<p style="text-align:center;color:#aaa;font-size:13px;padding:20px 0">No reviews yet. Be the first!</p>';
      return;
    }
    list.innerHTML = res.data.map(function(r) {
      var date = new Date(r.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
      return '<div class="rev-item">' +
        '<div class="rev-item-top">' +
          '<span class="rev-item-name"><i class="fa fa-user-circle"></i> '+encodeHtml(r.reviewer_name||'Anonymous')+'</span>' +
          '<span class="rev-item-date">'+date+'</span>' +
        '</div>' +
        '<div class="rev-item-stars">'+renderStarsDisplay(r.rating, 13)+'</div>' +
        (r.comment ? '<div class="rev-item-comment">'+encodeHtml(r.comment)+'</div>' : '') +
      '</div>';
    }).join('');
  } catch(e) {
    list.innerHTML = '<p style="text-align:center;color:#aaa;font-size:13px">Could not load reviews.</p>';
  }
}
async function submitReview() {
  if (!_selectedStars) { document.getElementById('reviewErr').textContent = 'Please select a star rating.'; return; }
  var name = document.getElementById('reviewNameInput').value.trim() || 'Anonymous';
  var comment = document.getElementById('reviewCommentInput').value.trim();
  var btn = document.getElementById('reviewSubmitBtn');
  btn.disabled = true; btn.textContent = 'Submitting...';
  try {
    var res = await sbFetch(SB_URL + '/rest/v1/jain_reviews', {
      method: 'POST',
      headers: Object.assign({}, SB_H, { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
      body: JSON.stringify({ product_id: _currentReviewProductId, rating: _selectedStars, reviewer_name: name, comment: comment })
    });
    if (res.error) throw new Error('Failed');
    showToast('Review submitted — thank you! ⭐');
    selectStar(0);
    document.getElementById('reviewNameInput').value = '';
    document.getElementById('reviewCommentInput').value = '';
    _selectedStars = 0;
    loadReviews(_currentReviewProductId);
  } catch(e) {
    document.getElementById('reviewErr').textContent = 'Could not submit review. Try again.';
  }
  btn.disabled = false; btn.textContent = 'Submit Review';
}
async function getAvgRating(id) {
  try {
    var res = await sbFetch(SB_URL + '/rest/v1/jain_reviews?product_id=eq.'+id+'&select=rating', { headers: SB_H });
    if (res.error || !res.data || !res.data.length) return null;
    var avg = res.data.reduce(function(s,r){ return s+r.rating; }, 0) / res.data.length;
    return { avg: avg, count: res.data.length };
  } catch(e) { return null; }
}
function encodeHtml(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE: BULK / TRADE QUOTE
// ══════════════════════════════════════════════════════════════════════════════
var _bulkRows = [];
function openBulkQuote() {
  _bulkRows = [{ product: '', qty: 1 }];
  renderBulkRows();
  var overlay = document.getElementById('bulkOverlay');
  if (overlay) { overlay.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeBulkQuote() {
  var overlay = document.getElementById('bulkOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}
function addBulkRow() {
  _bulkRows.push({ product: '', qty: 1 });
  renderBulkRows();
}
function removeBulkRow(i) {
  if (_bulkRows.length <= 1) return;
  _bulkRows.splice(i, 1);
  renderBulkRows();
}
function renderBulkRows() {
  var all = getAllProducts();
  var opts = '<option value="">-- Select Product --</option>' + all.map(function(p){
    return '<option value="'+p.id+'">'+p.name+' ('+p.price.toFixed(3)+' KWD)</option>';
  }).join('');
  document.getElementById('bulkRows').innerHTML = _bulkRows.map(function(r, i) {
    return '<div class="bulk-row">'+
      '<select class="bulk-sel" onchange="_bulkRows['+i+'].product=parseInt(this.value)||this.value">'+opts+'</select>'+
      '<input type="number" class="bulk-qty" value="'+r.qty+'" min="1" placeholder="Qty" autocomplete="off" onchange="_bulkRows['+i+'].qty=parseInt(this.value)||1" />'+
      '<button class="bulk-del-btn" onclick="removeBulkRow('+i+')" '+(i===0&&_bulkRows.length===1?'disabled':'')+'>'+
        '<i class="fa fa-trash"></i>'+
      '</button>'+
    '</div>';
  }).join('');
}
function sendBulkQuote() {
  var name = (document.getElementById('bulkName')||{}).value || '';
  var phone = (document.getElementById('bulkPhone')||{}).value || '';
  var all = getAllProducts();
  var lines = _bulkRows.filter(function(r){ return r.product; }).map(function(r) {
    var p = all.find(function(x){ return x.id == r.product; });
    return p ? '• ' + p.name + ' × ' + r.qty : null;
  }).filter(Boolean);
  if (!lines.length) { showToast('Please select at least one product'); return; }
  var msg = '📋 *Bulk / Trade Quote Request*\n';
  if (name) msg += '👤 Name: ' + name + '\n';
  if (phone) msg += '📞 Phone: ' + phone + '\n';
  msg += '\n*Items Requested:*\n' + lines.join('\n') + '\n\n_From Taj Mahal Jain Building Materials Co. Website_';
  window.open('https://wa.me/96597656372?text=' + encodeURIComponent(msg), '_blank');
  closeBulkQuote();
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE: ORDER TRACKING
// ══════════════════════════════════════════════════════════════════════════════
function openOrderTracker() {
  var overlay = document.getElementById('trackOverlay');
  if (!overlay) return;
  document.getElementById('trackPhone').value = '';
  document.getElementById('trackResults').innerHTML = '';
  document.getElementById('trackErr').textContent = '';
  switchOrderTab('track');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeOrderTracker() {
  var overlay = document.getElementById('trackOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}
function switchOrderTab(tab) {
  document.getElementById('panelTrack').style.display  = tab === 'track'  ? '' : 'none';
  document.getElementById('panelCancel').style.display = tab === 'cancel' ? '' : 'none';
  document.getElementById('tabTrack').classList.toggle('active',  tab === 'track');
  document.getElementById('tabCancel').classList.toggle('active', tab === 'cancel');
}
async function findCancelOrders() {
  var phone = (document.getElementById('cancelPhone').value || '').trim().replace(/\s+/g,'');
  var errEl = document.getElementById('cancelErr');
  var resultsEl = document.getElementById('cancelResults');
  if (!phone) { errEl.textContent = 'Please enter your WhatsApp number.'; return; }
  errEl.textContent = '';
  resultsEl.innerHTML = '<div style="text-align:center;padding:20px;color:#aaa"><i class="fa fa-spinner fa-spin"></i> Searching...</div>';
  try {
    var res = await sbFetch(SB_URL + '/rest/v1/jain_orders?customer_phone=eq.'+encodeURIComponent(phone)+'&order=created_at.desc', { headers: SB_H });
    if (res.error || !res.data || !res.data.length) {
      resultsEl.innerHTML = '<div style="text-align:center;padding:24px;color:#aaa"><i class="fa fa-search" style="font-size:32px;opacity:0.3;display:block;margin-bottom:10px"></i><p>No orders found for this number.</p></div>';
      return;
    }
    var now = Date.now();
    var html = res.data.map(function(o) {
      var created = new Date(o.created_at).getTime();
      var ageMs = now - created;
      var canCancel = ageMs < 3600000 && o.status !== 'cancelled' && o.status !== 'delivered';
      var minsAgo = Math.floor(ageMs / 60000);
      var dt = new Date(o.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
      var items = '';
      try { var arr = typeof o.items==='string' ? JSON.parse(o.items) : (o.items||[]); items = arr.map(function(it){ return it.name+' ×'+it.qty; }).join(', '); } catch(e){}
      var statusColor = {pending:'#f59e0b',confirmed:'#3b82f6',delivered:'#16a34a',cancelled:'#dc2626'}[o.status]||'#aaa';
      var st = o.status||'pending';
      return '<div class="track-order-card">'+
        '<div class="track-status-row">'+
          '<div><div class="track-status-label" style="color:'+statusColor+'">'+st.charAt(0).toUpperCase()+st.slice(1)+'</div>'+
          '<div class="track-date">'+dt+' &nbsp;·&nbsp; '+minsAgo+' min ago</div></div>'+
          '<div class="track-total">'+parseFloat(o.total||0).toFixed(3)+' KWD</div>'+
        '</div>'+
        '<div class="track-items">'+items+'</div>'+
        (canCancel
          ? '<button class="cancel-order-btn" onclick="cancelOrder(\''+o.id+'\',this)"><i class="fa fa-times-circle"></i> Cancel This Order</button>'
          : (o.status==='cancelled'
            ? '<div class="cancel-status-msg cancelled">Order already cancelled</div>'
            : ageMs >= 3600000
            ? '<div class="cancel-status-msg expired"><i class="fa fa-lock"></i> Cannot cancel — over 1 hour old</div>'
            : '<div class="cancel-status-msg delivered">Order '+st+' — cannot cancel</div>')
        )+
      '</div>';
    }).join('');
    resultsEl.innerHTML = '<p style="font-size:12px;color:#888;margin-bottom:12px">Found '+res.data.length+' order(s)</p>' + html;
  } catch(e) {
    resultsEl.innerHTML = '<p style="color:#dc2626;text-align:center">Could not load orders. Try again.</p>';
  }
}
async function cancelOrder(orderId, btn) {
  if (!confirm('Are you sure you want to cancel this order?')) return;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Cancelling...';
  var res = await sbFetch(SB_URL + '/rest/v1/jain_orders?id=eq.'+orderId, {
    method: 'PATCH',
    headers: Object.assign({}, SB_H, { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
    body: JSON.stringify({ status: 'cancelled' })
  });
  if (res.error) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa fa-times-circle"></i> Cancel This Order';
    showToast('Could not cancel. Please try again.');
  } else {
    btn.closest('.track-order-card').querySelector('.cancel-order-btn').outerHTML = '<div class="cancel-status-msg cancelled"><i class="fa fa-check-circle"></i> Order cancelled successfully</div>';
    showToast('✅ Order cancelled.');
  }
}
async function trackOrder() {
  var phone = (document.getElementById('trackPhone').value || '').trim().replace(/\s+/g,'');
  var errEl = document.getElementById('trackErr');
  var resultsEl = document.getElementById('trackResults');
  if (!phone) { errEl.textContent = 'Please enter your WhatsApp number.'; return; }
  errEl.textContent = '';
  resultsEl.innerHTML = '<div style="text-align:center;padding:20px;color:#aaa"><i class="fa fa-spinner fa-spin"></i> Searching...</div>';
  try {
    var res = await sbFetch(SB_URL + '/rest/v1/jain_orders?customer_phone=eq.'+encodeURIComponent(phone)+'&order=created_at.desc', { headers: SB_H });
    if (res.error || !res.data || !res.data.length) {
      resultsEl.innerHTML = '<div style="text-align:center;padding:24px;color:#aaa"><i class="fa fa-search" style="font-size:32px;opacity:0.3;display:block;margin-bottom:10px"></i><p>No orders found for this number.<br><small>Make sure you enter the number used during checkout.</small></p></div>';
      return;
    }
    var statusIcon = { pending:'fa-clock', confirmed:'fa-check-circle', delivered:'fa-truck', cancelled:'fa-times-circle' };
    var statusColor = { pending:'#f59e0b', confirmed:'#3b82f6', delivered:'#16a34a', cancelled:'#dc2626' };
    resultsEl.innerHTML = '<p style="font-size:12px;color:#888;margin-bottom:12px">Found '+res.data.length+' order(s)</p>' +
      res.data.map(function(o) {
        var dt = o.created_at ? new Date(o.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
        var items = '';
        try { var arr = typeof o.items==='string' ? JSON.parse(o.items) : (o.items||[]); items = arr.map(function(it){ return it.name+' ×'+it.qty; }).join(', '); } catch(e){}
        var st = o.status || 'pending';
        var icon = statusIcon[st] || 'fa-circle';
        var color = statusColor[st] || '#aaa';
        return '<div class="track-order-card">'+
          '<div class="track-status-row">'+
            '<i class="fa '+icon+'" style="color:'+color+';font-size:20px"></i>'+
            '<div>'+
              '<div class="track-status-label" style="color:'+color+'">'+st.charAt(0).toUpperCase()+st.slice(1)+'</div>'+
              '<div class="track-date">'+dt+'</div>'+
            '</div>'+
            '<div class="track-total">'+parseFloat(o.total||0).toFixed(3)+' KWD</div>'+
          '</div>'+
          '<div class="track-items">'+items+'</div>'+
          (o.address ? '<div class="track-addr"><i class="fa fa-map-marker-alt"></i> '+o.address+'</div>' : '')+
        '</div>';
      }).join('');
  } catch(e) {
    resultsEl.innerHTML = '<p style="color:#dc2626;text-align:center">Could not load orders. Try again.</p>';
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE: WHATSAPP CHAT FAB
// ══════════════════════════════════════════════════════════════════════════════
function openWAChat() {
  window.open('https://wa.me/96597656372?text=' + encodeURIComponent('Hi! I\'d like to ask about your products at Taj Mahal Jain Building Materials Co. 🔧'), '_blank');
}

// Call on page load to restore recently viewed and wishlist state
(function initExtras() {
  setTimeout(function() {
    renderRecentlyViewed();
    renderWishlistCount();
  }, 500);
})();
