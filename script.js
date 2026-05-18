const U = (id) => `https://picsum.photos/seed/${id}/400/400`;

// ── SUPABASE CONFIG ───────────────────────────────────────────────────────
const SB_URL = 'https://jjyhybulxixblpiixzkp.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeWh5YnVseGl4YmxwaWl4emtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjgxNTIsImV4cCI6MjA5NDYwNDE1Mn0.CdI1UcV4pIvdUU9xISJgbIqjfZunAgsiiIj0PntJm4I';
const SB_H   = { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY };

// Live data loaded from Supabase (falls back to localStorage if offline)
let _sbStock    = {};
let _sbPhotos   = {};
let _customProds = [];      // admin-added products from dhowtech_products table
let _hiddenIds   = new Set(); // base product IDs hidden by admin

async function loadSBData() {
  try {
    const [sr, pr, cr, hr] = await Promise.all([
      fetch(SB_URL + '/rest/v1/dhowtech_stock?select=*',                         { headers: SB_H }),
      fetch(SB_URL + '/rest/v1/dhowtech_photos?select=*',                        { headers: SB_H }),
      fetch(SB_URL + '/rest/v1/dhowtech_products?select=*&order=created_at.asc', { headers: SB_H }),
      fetch(SB_URL + '/rest/v1/dhowtech_hidden?select=product_id',               { headers: SB_H })
    ]);
    const stockRows  = await sr.json();
    const photoRows  = await pr.json();
    const customRows = await cr.json();
    const hiddenRows = await hr.json();
    if (Array.isArray(stockRows))  stockRows.forEach(r  => { _sbStock[r.product_id]  = r.qty; });
    if (Array.isArray(photoRows))  photoRows.forEach(r  => { _sbPhotos[r.product_id] = r.url; });
    if (Array.isArray(customRows)) _customProds = customRows.filter(r => !r.hidden);
    if (Array.isArray(hiddenRows)) _hiddenIds   = new Set(hiddenRows.map(r => r.product_id));
  } catch (e) {
    console.warn('Supabase offline — using localStorage fallback');
    try { _sbStock  = JSON.parse(localStorage.getItem('dhowtech_stock')  || '{}'); } catch(_) {}
    try { _sbPhotos = JSON.parse(localStorage.getItem('dhowtech_photos') || '{}'); } catch(_) {}
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
  const base  = PRODUCTS.filter(p => !_hiddenIds.has(p.id));
  const extra = _customProds.map(p => ({
    id:       p.id,
    name:     p.name,
    category: normalizeCategory(p.category),
    price:    parseFloat(p.price),
    img:      p.img_url || U('1581783898377-1c85bf937427'),
    desc:     p.description || '',
    badge:    p.badge || null,
    stock:    'in-stock'
  }));
  return [...base, ...extra];
}

const PRODUCTS = [
  { id:1,  name:'Cordless Drill 18V',           category:'power-tools', price:12.500, img:U('1777575764654-ffc22754c5d8'),     desc:'18V lithium-ion cordless drill with 2-speed gearbox, 13mm keyless chuck and reverse function.', badge:'Best Seller', stock:'in-stock' },
  { id:2,  name:'Angle Grinder 115mm',           category:'power-tools', price:8.900,  img:U('1776711763505-4105861e0d41'),     desc:'900W angle grinder for cutting, grinding and polishing metal and masonry. 11,000 RPM.', badge:null, stock:'in-stock' },
  { id:3,  name:'Circular Saw 185mm',            category:'power-tools', price:14.500, img:U('1775988821739-74c26a8a5585'),     desc:'1200W circular saw with laser guide. Cuts wood up to 65mm depth. Bevel 0-45 degrees.', badge:null, stock:'in-stock' },
  { id:4,  name:'Jigsaw 650W',                   category:'power-tools', price:9.800,  img:U('1773430273016-630960da6aa7'),     desc:'650W jigsaw with pendulum action and variable speed. Cuts curves in wood, metal and plastic.', badge:null, stock:'in-stock' },
  { id:5,  name:'Random Orbital Sander',         category:'power-tools', price:6.500,  img:U('1771491237067-5d108e956e73'),     desc:'300W random orbital sander with dust bag. 125mm pad, 12,000 OPM for smooth finishing.', badge:null, stock:'in-stock' },
  { id:6,  name:'Impact Driver 18V',             category:'power-tools', price:11.000, img:U('1770763233593-74dfd0da7bf0'),     desc:'18V brushless impact driver with 180Nm torque. 3-speed settings. LED work light included.', badge:'Pro', stock:'in-stock' },
  { id:7,  name:'Rotary Hammer Drill SDS',       category:'power-tools', price:18.500, img:U('1770386582823-3a7094e35b22'),     desc:'800W SDS-plus rotary hammer for drilling concrete, brick and stone. 3-function switch.', badge:null, stock:'low-stock' },
  { id:8,  name:'Heat Gun 2000W',                category:'power-tools', price:5.200,  img:U('1766096847418-9a2ae64c9621'),     desc:'2000W dual temperature heat gun. 300C and 500C. Ideal for paint stripping and shrink wrap.', badge:null, stock:'in-stock' },
  { id:9,  name:'Reciprocating Saw',             category:'power-tools', price:10.200, img:U('1764678714365-800554d1969c'),     desc:'900W reciprocating saw with tool-free blade change. Variable speed for wood and metal.', badge:null, stock:'in-stock' },
  { id:10, name:'Cordless Screwdriver 3.6V',     category:'power-tools', price:3.800,  img:U('1764699186048-e85b5f0e59fc'),     desc:'Compact 3.6V cordless screwdriver with 15 torque settings and LED light.', badge:null, stock:'in-stock' },
  { id:11, name:'Claw Hammer 16oz',              category:'hand-tools',  price:2.200,  img:U('1581783898377-1c85bf937427'),     desc:'Forged steel 16oz claw hammer with fibreglass handle and rubber grip. Reduces vibration.', badge:'Best Seller', stock:'in-stock' },
  { id:12, name:'Phillips Screwdriver Set 6pc',  category:'hand-tools',  price:3.500,  img:U('1777107508755-2ba7502b2b95'),     desc:'6-piece chrome vanadium Phillips screwdrivers PH0 to PH3. Magnetic tips, ergonomic handles.', badge:null, stock:'in-stock' },
  { id:13, name:'Flathead Screwdriver Set 6pc',  category:'hand-tools',  price:3.200,  img:U('1777107508801-1aa0a4513780'),     desc:'6-piece flathead screwdriver set with hardened steel blades and comfort grip handles.', badge:null, stock:'in-stock' },
  { id:14, name:'Adjustable Wrench 12"',         category:'hand-tools',  price:2.800,  img:U('1775396042188-64ec280ca175'),     desc:'12-inch adjustable wrench with wide jaw up to 34mm. Chrome finish steel construction.', badge:null, stock:'in-stock' },
  { id:15, name:'Combination Spanner Set 12pc',  category:'hand-tools',  price:5.500,  img:U('1774963711952-713bb7a52c4e'),     desc:'12-piece combination spanner set 8-19mm. Chrome vanadium with mirror polish finish.', badge:null, stock:'in-stock' },
  { id:16, name:'Pliers Set 3pc',                category:'hand-tools',  price:4.200,  img:U('1774645215883-14d1553f3fa0'),     desc:'3-piece set: combination, long nose and diagonal cutters. Chrome vanadium steel.', badge:null, stock:'in-stock' },
  { id:17, name:'Allen Key Hex Set 9pc',         category:'hand-tools',  price:1.500,  img:U('1774654343530-7e04733e478d'),     desc:'9-piece metric allen key set 1.5-10mm. CRV steel with long arm for extra reach.', badge:null, stock:'in-stock' },
  { id:18, name:'Socket Set 40pc 1/2"',          category:'hand-tools',  price:9.800,  img:U('1772207896656-4210003d65ee'),     desc:'40-piece 1/2" drive socket set with quick-release ratchet. Metric and imperial included.', badge:'Popular', stock:'in-stock' },
  { id:19, name:'Rubber Mallet 32oz',            category:'hand-tools',  price:1.800,  img:U('1607870411590-d5e9e06da09a'),     desc:'32oz rubber mallet with wooden handle. For assembling furniture and tapping tiles.', badge:null, stock:'in-stock' },
  { id:20, name:'Chisel Set 4pc',                category:'hand-tools',  price:3.900,  img:U('1770657986086-c1f20eef30ff'),     desc:'4-piece wood chisel set 6, 12, 19, 25mm. High carbon steel with honed edges.', badge:null, stock:'in-stock' },
  { id:21, name:'Wire Nails 50mm 1kg',           category:'fasteners',   price:0.650,  img:U('1778616364855-993b778bfce9'),     desc:'1kg box of bright wire nails 50mm x 2.65mm. For general carpentry and framing.', badge:null, stock:'in-stock' },
  { id:22, name:'Wire Nails 75mm 1kg',           category:'fasteners',   price:0.750,  img:U('1777882660356-38788724160b'),     desc:'1kg box of bright wire nails 75mm x 3.35mm. Heavy-duty construction nails.', badge:null, stock:'in-stock' },
  { id:23, name:'Wire Nails 100mm 1kg',          category:'fasteners',   price:0.850,  img:U('1778362561378-f54b1d601af0'),     desc:'1kg box of bright wire nails 100mm x 4mm. Structural timber framing nails.', badge:null, stock:'in-stock' },
  { id:24, name:'Wood Screws 4x50mm 200pc',      category:'fasteners',   price:1.200,  img:U('1777460079856-9c448a770644'),     desc:'200-pack zinc-plated wood screws 4x50mm. Countersunk head, Pozidrive.', badge:'Best Seller', stock:'in-stock' },
  { id:25, name:'Drywall Screws 3.5x35mm',       category:'fasteners',   price:0.900,  img:U('1777647293690-075448f3ff4d'),     desc:'200 drywall screws 3.5x35mm. Bugle head, coarse thread, self-drilling tip.', badge:null, stock:'in-stock' },
  { id:26, name:'Self-Drilling Screws 200pc',    category:'fasteners',   price:1.400,  img:U('1777732786166-d922fe29d62f'),     desc:'200 TEK self-drilling screws for metal-to-metal and metal-to-timber. 4.2x13mm.', badge:null, stock:'in-stock' },
  { id:27, name:'Hex Bolts M10x60mm 25pc',       category:'fasteners',   price:1.100,  img:U('1777050967684-510b836d7b7d'),     desc:'25-piece M10x60mm zinc-plated hex bolts with matching nuts and washers.', badge:null, stock:'in-stock' },
  { id:28, name:'Masonry Anchors 8mm 50pc',      category:'fasteners',   price:1.600,  img:U('1776773299716-1ebcd15ac61b'),     desc:'50-pack nylon masonry anchors 8mm with screws. For brick, concrete and block.', badge:null, stock:'in-stock' },
  { id:29, name:'Nuts Bolts Washers 500pc',      category:'fasteners',   price:2.500,  img:U('1776774706515-c4dfcaa64891'),     desc:'500-piece assorted metric nuts, bolts and washers. M4 to M8. Organiser box.', badge:'Popular', stock:'in-stock' },
  { id:30, name:'Cable Ties 200pc Mixed',        category:'fasteners',   price:0.600,  img:U('1776774706533-3af36fca44f7'),     desc:'200-piece mixed cable ties 100, 200, 300mm lengths. Black UV-resistant nylon.', badge:null, stock:'in-stock' },
  { id:31, name:'Tape Measure 8m',               category:'measuring',   price:1.800,  img:U('1776361460587-e5f9396ebf88'),     desc:'8-metre steel tape measure with metric and imperial markings. Auto-lock and belt clip.', badge:null, stock:'in-stock' },
  { id:32, name:'Spirit Level 1200mm',           category:'measuring',   price:3.200,  img:U('1776254387430-21601edab5b3'),     desc:'1200mm aluminium spirit level with 3 bubble vials. Horizontal, vertical and 45-degree.', badge:null, stock:'in-stock' },
  { id:33, name:'Laser Level Cross Line',        category:'measuring',   price:8.500,  img:U('1775493215727-8a81311b39d8'),     desc:'Self-levelling cross-line laser with horizontal and vertical beams. 15m working range.', badge:'Pro', stock:'low-stock' },
  { id:34, name:'Digital Stud Finder',           category:'measuring',   price:4.200,  img:U('1775345507804-2b44a1046873'),     desc:'Electronic stud finder detects wood and metal studs behind walls up to 38mm deep.', badge:null, stock:'in-stock' },
  { id:35, name:'Steel Square 300mm',            category:'measuring',   price:1.400,  img:U('1763202282638-371d7060ee51'),     desc:'300mm stainless steel try square for marking and checking right angles.', badge:null, stock:'in-stock' },
  { id:36, name:'Chalk Line 30m',                category:'measuring',   price:1.100,  img:U('1761682752575-c31ad0a16a50'),     desc:'30-metre chalk line reel with blue chalk powder. For marking long straight lines.', badge:null, stock:'in-stock' },
  { id:37, name:'Safety Goggles Clear',          category:'safety',      price:0.800,  img:U('1778577177321-3bff951a9ac5'),     desc:'Clear anti-scratch safety goggles with indirect ventilation. EN166 certified.', badge:null, stock:'in-stock' },
  { id:38, name:'Leather Work Gloves',           category:'safety',      price:1.200,  img:U('1778576835371-596da992a395'),     desc:'Leather palm work gloves with breathable spandex back. Cut and abrasion resistant.', badge:'Best Seller', stock:'in-stock' },
  { id:39, name:'Dust Mask N95 10pc',            category:'safety',      price:1.500,  img:U('1778868001879-50a970759f98'),     desc:'Pack of 10 N95 dust masks with valve. Filters 95% of airborne particles.', badge:null, stock:'in-stock' },
  { id:40, name:'Hard Hat Yellow',               category:'safety',      price:2.200,  img:U('1778317764727-8cb931bbf1e8'),     desc:'Yellow construction hard hat with adjustable ratchet harness. EN397 certified.', badge:null, stock:'in-stock' },
  { id:41, name:'Hi-Vis Safety Vest',            category:'safety',      price:0.900,  img:U('1778291114453-b215fa0957a3'),     desc:'High-visibility orange safety vest with reflective strips. EN471 Class 2.', badge:null, stock:'in-stock' },
  { id:42, name:'Steel Toe Safety Boots',        category:'safety',      price:8.500,  img:U('1777867445652-5a01f71c9d70'),     desc:'S3 steel toe cap safety boots with midsole protection and slip-resistant sole. Sizes 40-46.', badge:null, stock:'low-stock' },
  { id:43, name:'Hand Saw 550mm',                category:'cutting',     price:2.800,  img:U('1778226818301-e4cd2cf295a2'),     desc:'550mm hardpoint hand saw, 8TPI for fast cross-cutting of timber. Comfortable grip.', badge:null, stock:'in-stock' },
  { id:44, name:'Hacksaw + 5 Blades',            category:'cutting',     price:2.200,  img:U('1778388804110-5beae7d35662'),     desc:'Heavy-duty hacksaw frame with 5 bi-metal blades. Adjustable tension. Cuts metal and plastic.', badge:null, stock:'in-stock' },
  { id:45, name:'Utility Knife + 10 Blades',    category:'cutting',     price:1.100,  img:U('1777892029843-8b66da1d09e7'),     desc:'Heavy-duty retractable utility knife with rubber grip and 10 extra snap-off blades.', badge:'Popular', stock:'in-stock' },
  { id:46, name:'Tin Snips Aviation 250mm',      category:'cutting',     price:3.200,  img:U('1777891733988-540ac2abbd40'),     desc:'250mm aviation tin snips for straight and curved cuts in sheet metal up to 1.2mm.', badge:null, stock:'in-stock' },
  { id:47, name:'PVC Pipe Cutter 42mm',          category:'cutting',     price:2.600,  img:U('1778388804089-c78419e188f2'),     desc:'Ratchet pipe cutter for clean cuts on PVC, CPVC and PEX pipes up to 42mm diameter.', badge:null, stock:'in-stock' },
  { id:48, name:'Tool Bag 16" Heavy Duty',       category:'storage',     price:5.500,  img:U('1778066994998-97f74a5bf901'),     desc:'16-inch heavy-duty canvas tool bag with 20 pockets and reinforced base. Padded strap.', badge:null, stock:'in-stock' },
  { id:49, name:'Extension Cord 10m 4-Way',      category:'storage',     price:4.200,  img:U('1777919394037-9a2968966310'),     desc:'10-metre extension cord with 4 sockets and surge protection. 1.5mm cable, 13A rating.', badge:'Popular', stock:'in-stock' },
  { id:50, name:'Tool Box 16" Metal',            category:'storage',     price:6.800,  img:U('1777919393727-cb35adbdc5e0'),     desc:'16-inch metal tool box with removable tray and strong locking clasp. Powder coat finish.', badge:null, stock:'in-stock' }
];

let cart = [];
let activeFilter = 'all';

// ── ANALYTICS TRACKING ────────────────────────────────────────────────────
function trackView(id) {
  const v = JSON.parse(localStorage.getItem('dhowtech_views') || '{}');
  v[id] = (v[id] || 0) + 1;
  localStorage.setItem('dhowtech_views', JSON.stringify(v));
}
function trackSearch(ids) {
  if (!ids || !ids.length) return;
  const s = JSON.parse(localStorage.getItem('dhowtech_searches') || '{}');
  ids.forEach(function(id) { s[id] = (s[id] || 0) + 1; });
  localStorage.setItem('dhowtech_searches', JSON.stringify(s));
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
  try {
    await fetch(SB_URL + '/rest/v1/dhowtech_stock', {
      method: 'POST',
      headers: { ...SB_H, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(rows)
    });
  } catch (e) {
    // Save to localStorage as offline backup
    localStorage.setItem('dhowtech_stock', JSON.stringify(_sbStock));
  }
}

// ── RENDER PRODUCTS ───────────────────────────────────────────────────────
function renderProducts() {
  const query = document.getElementById('searchInput').value.toLowerCase();
  const grid  = document.getElementById('productsGrid');
  const empty = document.getElementById('productsEmpty');
  const filtered = getAllProducts().filter(p => {
    const matchCat    = activeFilter === 'all' || p.category === activeFilter;
    const matchSearch = !query || p.name.toLowerCase().includes(query) || p.desc.toLowerCase().includes(query);
    return matchCat && matchSearch;
  });
  if (!filtered.length) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  // Track search appearances (debounced so only fires when user stops typing)
  if (query && filtered.length) {
    clearTimeout(window._searchTimer);
    window._searchTimer = setTimeout(function() { trackSearch(filtered.map(function(p) { return p.id; })); }, 700);
  }

  // custom photos set by admin (loaded from Supabase)
  const customPhotos = _sbPhotos;

  grid.innerHTML = filtered.map(p => {
    const liveStatus = getLiveStock(p.id) || p.stock;
    const liveQty    = getLiveQty(p.id);
    const isOut      = liveStatus === 'out-of-stock';
    const isLow      = liveStatus === 'low-stock';
    const photo      = customPhotos[p.id] || p.img;
    let stockLabel, stockClass;
    if (isOut)      { stockLabel = '&#10006; Out of Stock';  stockClass = 'out-of-stock'; }
    else if (isLow) { stockLabel = '&#9888; Low Stock' + (liveQty !== null ? ' (' + liveQty + ' left)' : ''); stockClass = 'low-stock'; }
    else            { stockLabel = '&#10003; In Stock'  + (liveQty !== null ? ' (' + liveQty + ')'      : ''); stockClass = 'in-stock'; }
    return `
      <div class="product-card ${isOut ? 'card-out' : ''}" onclick="openProduct(${p.id})">
        <div class="product-img-wrap">
          ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}
          ${isOut ? '<span class="out-badge">OUT OF STOCK</span>' : ''}
          <img src="${photo}" alt="${p.name}" loading="lazy"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
          <div class="product-img-fallback" style="display:none"><i class="fa fa-tools"></i></div>
        </div>
        <div class="product-info">
          <div class="product-cat">${p.category.replace('-',' ')}</div>
          <h3>${p.name}</h3>
          <p>${p.desc}</p>
          <div class="product-footer">
            <div>
              <div class="product-price">${p.price.toFixed(3)} <small>KWD</small></div>
              <div class="stock-badge ${stockClass}">${stockLabel}</div>
            </div>
            ${isOut
              ? `<button class="btn-add btn-disabled" disabled onclick="event.stopPropagation()">Unavailable</button>`
              : `<button class="btn-add" onclick="event.stopPropagation();addToCart(${p.id})"><i class="fa fa-plus"></i> Add</button>`}
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
  _pmId  = id;
  _pmQty = 1;
  const p           = getAllProducts().find(x => x.id === id);
  const liveStatus  = getLiveStock(id) || p.stock;
  const liveQty     = getLiveQty(id);
  const isOut       = liveStatus === 'out-of-stock';
  const isLow       = liveStatus === 'low-stock';
  const customPhotos = _sbPhotos;
  // Get bigger version of the Unsplash image for the modal
  const bigImg = customPhotos[id] || p.img.replace('w=400&h=400', 'w=900&h=900').replace('q=80', 'q=85');

  let stockIcon, stockTxt, stockCls;
  if (isOut)      { stockIcon = 'fa-times-circle'; stockTxt = 'Out of Stock'; stockCls = 'out-of-stock'; }
  else if (isLow) { stockIcon = 'fa-exclamation-circle'; stockTxt = 'Low Stock — only ' + (liveQty||'few') + ' left!'; stockCls = 'low-stock'; }
  else            { stockIcon = 'fa-check-circle'; stockTxt = 'In Stock' + (liveQty !== null ? ' — ' + liveQty + ' available' : ''); stockCls = 'in-stock'; }

  document.getElementById('prodModalSku').textContent = 'SKU-' + String(id).padStart(3, '0');
  document.getElementById('prodModalBody').innerHTML =
    '<div class="pm-img-col">' +
      '<img src="' + bigImg + '" alt="' + p.name + '" onerror="this.style.display=\'none\';document.getElementById(\'pmFallback\').style.display=\'flex\'" />' +
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
            '<span id="pmQtyDisplay">1</span>' +
            '<button onclick="pmChangeQty(1)"><i class="fa fa-plus"></i></button>' +
          '</div>' +
        '</div>'
      : '') +
      '<button class="pm-add-btn" id="pmAddBtn" ' + (isOut ? 'disabled' : 'onclick="pmAddToCart()"') + '>' +
        '<i class="fa ' + (isOut ? 'fa-ban' : 'fa-shopping-cart') + '"></i> ' +
        (isOut ? 'Out of Stock' : 'Add to Cart') +
      '</button>' +
      '<div class="pm-divider"></div>' +
      '<div class="pm-features">' +
        '<div class="pm-feat"><i class="fa fa-check-circle"></i> 100% genuine, quality-tested product</div>' +
        '<div class="pm-feat"><i class="fa fa-shipping-fast"></i> Same-day delivery in Kuwait City</div>' +
        '<div class="pm-feat"><i class="fa fa-shield-alt"></i> Easy returns &amp; after-sales support</div>' +
        '<div class="pm-feat"><i class="fa fa-tags"></i> Bulk pricing available for contractors</div>' +
      '</div>' +
    '</div>';

  document.getElementById('prodOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeProduct() {
  document.getElementById('prodOverlay').classList.remove('open');
  document.body.style.overflow = '';
  _pmId = null; _pmQty = 1;
}

function pmChangeQty(delta) {
  const liveQty = getLiveQty(_pmId);
  const max = liveQty !== null ? liveQty : 999;
  _pmQty = Math.max(1, Math.min(max, _pmQty + delta));
  document.getElementById('pmQtyDisplay').textContent = _pmQty;
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
  document.getElementById('cartCount').textContent = cart.reduce((s,c) => s+c.qty, 0);
  const body  = document.getElementById('cartItems');
  const total = cart.reduce((s,c) => s+c.price*c.qty, 0);
  document.getElementById('cartTotal').textContent = total.toFixed(3) + ' KWD';
  const customPhotos = _sbPhotos;
  if (!cart.length) { body.innerHTML = '<p class="empty-cart">Your cart is empty.</p>'; return; }
  body.innerHTML = cart.map(c => `
    <div class="cart-item">
      <div class="cart-item-icon"><img src="${customPhotos[c.id]||c.img}" alt="${c.name}" onerror="this.style.display='none'" /></div>
      <div class="cart-item-info">
        <strong>${c.name}</strong>
        <span>Qty: ${c.qty} &times; ${c.price.toFixed(3)} KWD</span>
      </div>
      <div class="cart-item-actions">
        <span class="cart-item-price">${(c.price*c.qty).toFixed(3)} KWD</span>
        <button class="btn-remove" onclick="removeFromCart(${c.id})"><i class="fa fa-trash"></i></button>
      </div>
    </div>`).join('');
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
}

document.getElementById('coSubmitBtn').addEventListener('click', () => {
  const name  = document.getElementById('coName').value.trim();
  const phone = document.getElementById('coPhone').value.trim();
  const area  = document.getElementById('coArea').value;
  let valid = true;
  ['coName','coPhone','coArea'].forEach(id => {
    const el = document.getElementById(id);
    if (!el.value.trim()) { el.classList.add('err'); valid = false; }
    else el.classList.remove('err');
  });
  if (!valid) { alert('Please fill in your name, WhatsApp number and area.'); return; }

  const block  = document.getElementById('coBlock').value.trim();
  const street = document.getElementById('coStreet').value.trim();
  const house  = document.getElementById('coHouse').value.trim();
  const floor  = document.getElementById('coFloor').value.trim();
  const notes  = document.getElementById('coNotes').value.trim();
  const total  = cart.reduce((s,c) => s+c.price*c.qty, 0);

  const orderLines = cart.map(c => `  • ${c.name} x${c.qty} — ${(c.price*c.qty).toFixed(3)} KWD`).join('\n');
  const address = [area, block&&'Block '+block, street&&'Street '+street, house, floor].filter(Boolean).join(', ');

  const msg = [
    '🔨 *DhowTech Order* 🔨',
    '',
    '👤 *Name:* ' + name,
    '📞 *WhatsApp:* ' + phone,
    '📍 *Address:* ' + address,
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

  // Open WhatsApp
  window.open('https://wa.me/96597656372?text=' + encodeURIComponent(msg), '_blank');

  // Show success, clear cart
  cart = [];
  updateCartUI();
  renderProducts();
  document.getElementById('coBody').innerHTML = `
    <div class="co-success">
      <i class="fab fa-whatsapp"></i>
      <h3>Order Sent!</h3>
      <p>Your order has been sent to DhowTech on WhatsApp.<br/>We will confirm and arrange delivery shortly.<br/><br/><strong>Thank you, ${name}!</strong></p>
      <br/>
      <button class="btn btn-primary" onclick="document.getElementById('checkoutOverlay').classList.remove('open');document.getElementById('coBody').innerHTML=origCoBody">Continue Shopping</button>
    </div>`;
});

// Store original checkout body to reset it
let origCoBody = '';
window.addEventListener('load', () => { origCoBody = document.getElementById('coBody').innerHTML; });

// ── EVENTS ────────────────────────────────────────────────────────────────
window.addEventListener('scroll', () => document.getElementById('header').classList.toggle('scrolled', window.scrollY > 40));
document.getElementById('hamburger').addEventListener('click', () => document.getElementById('nav').classList.toggle('open'));
document.getElementById('cartBtn').addEventListener('click', openCart);
document.getElementById('closeCart').addEventListener('click', () => document.getElementById('cartModal').classList.remove('open'));
document.getElementById('cartModal').addEventListener('click', e => {
  if (e.target === document.getElementById('cartModal')) document.getElementById('cartModal').classList.remove('open');
});
document.getElementById('checkoutBtn').addEventListener('click', openCheckout);
document.getElementById('closeCheckout').addEventListener('click', () => document.getElementById('checkoutOverlay').classList.remove('open'));
document.getElementById('checkoutOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('checkoutOverlay')) document.getElementById('checkoutOverlay').classList.remove('open');
});
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
// Load stock + photos from Supabase then render
loadSBData();
