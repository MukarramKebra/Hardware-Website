const U   = (id) => `https://images.unsplash.com/photo-${id}?w=420&h=320&fit=crop&auto=format&q=80`;
const UL  = (id) => `product-images/${id}.jpg`;   // local images

// ── SKU HELPER ────────────────────────────────────────────────────────────
// SKU is a separate display label from the internal product ID.
// Admin can set a custom SKU; it's stored in dhowtech_sku_map in localStorage.
function getProductSku(id) {
  try {
    var map = JSON.parse(localStorage.getItem('dhowtech_sku_map') || '{}');
    var val = map[String(id)];
    return 'SKU-' + String(val !== undefined ? val : id).padStart(4, '0');
  } catch(e) { return 'SKU-' + String(id).padStart(4, '0'); }
}

// ── SUPABASE CONFIG ───────────────────────────────────────────────────────
const SB_URL = 'https://jjyhybulxixblpiixzkp.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeWh5YnVseGl4YmxwaWl4emtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjgxNTIsImV4cCI6MjA5NDYwNDE1Mn0.CdI1UcV4pIvdUU9xISJgbIqjfZunAgsiiIj0PntJm4I';
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
let _customProds = [];      // admin-added products from dhowtech_products table
let _hiddenIds   = new Set(); // base product IDs hidden by admin

async function loadSBData() {
  const [s, p, c, h] = await Promise.all([
    sbFetch(SB_URL + '/rest/v1/dhowtech_stock?select=*',                         { headers: SB_H }),
    sbFetch(SB_URL + '/rest/v1/dhowtech_photos?select=*',                        { headers: SB_H }),
    sbFetch(SB_URL + '/rest/v1/dhowtech_products?select=*',                        { headers: SB_H }),
    sbFetch(SB_URL + '/rest/v1/dhowtech_hidden?select=product_id',               { headers: SB_H })
  ]);
  if (s.error) {
    console.warn('Supabase offline — using localStorage fallback');
    try { _sbStock  = JSON.parse(localStorage.getItem('dhowtech_stock')  || '{}'); } catch(_) {}
    try { _sbPhotos = JSON.parse(localStorage.getItem('dhowtech_photos') || '{}'); } catch(_) {}
  } else {
    if (Array.isArray(s.data)) s.data.forEach(r => { _sbStock[r.product_id]  = r.qty; });
    if (Array.isArray(p.data)) p.data.forEach(r => { _sbPhotos[r.product_id] = r.url; });
    if (Array.isArray(c.data) && c.data.length > 0) _customProds = c.data.filter(r => !r.hidden);
    if (Array.isArray(h.data)) _hiddenIds   = new Set(h.data.map(r => r.product_id));
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
  { id:1,  name:'Cordless Drill 18V',           category:'power-tools', price:12.500, img:UL(1),  desc:'18V lithium-ion cordless drill with 2-speed gearbox, 13mm keyless chuck and reverse function.', badge:'Best Seller', stock:'in-stock' },
  { id:2,  name:'Angle Grinder 115mm',           category:'power-tools', price:8.900,  img:UL(2),  desc:'900W angle grinder for cutting, grinding and polishing metal and masonry. 11,000 RPM.', badge:null, stock:'in-stock' },
  { id:3,  name:'Circular Saw 185mm',            category:'power-tools', price:14.500, img:UL(3),  desc:'1200W circular saw with laser guide. Cuts wood up to 65mm depth. Bevel 0-45 degrees.', badge:null, stock:'in-stock' },
  { id:4,  name:'Jigsaw 650W',                   category:'power-tools', price:9.800,  img:UL(4),  desc:'650W jigsaw with pendulum action and variable speed. Cuts curves in wood, metal and plastic.', badge:null, stock:'in-stock' },
  { id:5,  name:'Random Orbital Sander',         category:'power-tools', price:6.500,  img:UL(5),  desc:'300W random orbital sander with dust bag. 125mm pad, 12,000 OPM for smooth finishing.', badge:null, stock:'in-stock' },
  { id:6,  name:'Impact Driver 18V',             category:'power-tools', price:11.000, img:UL(6),  desc:'18V brushless impact driver with 180Nm torque. 3-speed settings. LED work light included.', badge:'Pro', stock:'in-stock' },
  { id:7,  name:'Rotary Hammer Drill SDS',       category:'power-tools', price:18.500, img:UL(7),  desc:'800W SDS-plus rotary hammer for drilling concrete, brick and stone. 3-function switch.', badge:null, stock:'low-stock' },
  { id:8,  name:'Heat Gun 2000W',                category:'power-tools', price:5.200,  img:UL(8),  desc:'2000W dual temperature heat gun. 300C and 500C. Ideal for paint stripping and shrink wrap.', badge:null, stock:'in-stock' },
  { id:9,  name:'Reciprocating Saw',             category:'power-tools', price:10.200, img:UL(9),  desc:'900W reciprocating saw with tool-free blade change. Variable speed for wood and metal.', badge:null, stock:'in-stock' },
  { id:10, name:'Cordless Screwdriver 3.6V',     category:'power-tools', price:3.800,  img:UL(10), desc:'Compact 3.6V cordless screwdriver with 15 torque settings and LED light.', badge:null, stock:'in-stock' },
  { id:11, name:'Claw Hammer 16oz',              category:'hand-tools',  price:2.200,  img:UL(11), desc:'Forged steel 16oz claw hammer with fibreglass handle and rubber grip. Reduces vibration.', badge:'Best Seller', stock:'in-stock' },
  { id:12, name:'Phillips Screwdriver Set 6pc',  category:'hand-tools',  price:3.500,  img:UL(12), desc:'6-piece chrome vanadium Phillips screwdrivers PH0 to PH3. Magnetic tips, ergonomic handles.', badge:null, stock:'in-stock' },
  { id:13, name:'Flathead Screwdriver Set 6pc',  category:'hand-tools',  price:3.200,  img:UL(13), desc:'6-piece flathead screwdriver set with hardened steel blades and comfort grip handles.', badge:null, stock:'in-stock' },
  { id:14, name:'Adjustable Wrench 12"',         category:'hand-tools',  price:2.800,  img:UL(14), desc:'12-inch adjustable wrench with wide jaw up to 34mm. Chrome finish steel construction.', badge:null, stock:'in-stock' },
  { id:15, name:'Combination Spanner Set 12pc',  category:'hand-tools',  price:5.500,  img:UL(15), desc:'12-piece combination spanner set 8-19mm. Chrome vanadium with mirror polish finish.', badge:null, stock:'in-stock' },
  { id:16, name:'Pliers Set 3pc',                category:'hand-tools',  price:4.200,  img:UL(16), desc:'3-piece set: combination, long nose and diagonal cutters. Chrome vanadium steel.', badge:null, stock:'in-stock' },
  { id:17, name:'Allen Key Hex Set 9pc',         category:'hand-tools',  price:1.500,  img:UL(17), desc:'9-piece metric allen key set 1.5-10mm. CRV steel with long arm for extra reach.', badge:null, stock:'in-stock' },
  { id:18, name:'Socket Set 40pc 1/2"',          category:'hand-tools',  price:9.800,  img:UL(18), desc:'40-piece 1/2" drive socket set with quick-release ratchet. Metric and imperial included.', badge:'Popular', stock:'in-stock' },
  { id:19, name:'Rubber Mallet 32oz',            category:'hand-tools',  price:1.800,  img:UL(19), desc:'32oz rubber mallet with wooden handle. For assembling furniture and tapping tiles.', badge:null, stock:'in-stock' },
  { id:20, name:'Chisel Set 4pc',                category:'hand-tools',  price:3.900,  img:UL(20), desc:'4-piece wood chisel set 6, 12, 19, 25mm. High carbon steel with honed edges.', badge:null, stock:'in-stock' },
  { id:21, name:'Wire Nails 50mm 1kg',           category:'fasteners',   price:0.650,  img:UL(21), desc:'1kg box of bright wire nails 50mm x 2.65mm. For general carpentry and framing.', badge:null, stock:'in-stock' },
  { id:22, name:'Wire Nails 75mm 1kg',           category:'fasteners',   price:0.750,  img:UL(22), desc:'1kg box of bright wire nails 75mm x 3.35mm. Heavy-duty construction nails.', badge:null, stock:'in-stock' },
  { id:23, name:'Wire Nails 100mm 1kg',          category:'fasteners',   price:0.850,  img:UL(23), desc:'1kg box of bright wire nails 100mm x 4mm. Structural timber framing nails.', badge:null, stock:'in-stock' },
  { id:24, name:'Wood Screws 4x50mm 200pc',      category:'fasteners',   price:1.200,  img:UL(24), desc:'200-pack zinc-plated wood screws 4x50mm. Countersunk head, Pozidrive.', badge:'Best Seller', stock:'in-stock' },
  { id:25, name:'Drywall Screws 3.5x35mm',       category:'fasteners',   price:0.900,  img:UL(25), desc:'200 drywall screws 3.5x35mm. Bugle head, coarse thread, self-drilling tip.', badge:null, stock:'in-stock' },
  { id:26, name:'Self-Drilling Screws 200pc',    category:'fasteners',   price:1.400,  img:UL(26), desc:'200 TEK self-drilling screws for metal-to-metal and metal-to-timber. 4.2x13mm.', badge:null, stock:'in-stock' },
  { id:27, name:'Hex Bolts M10x60mm 25pc',       category:'fasteners',   price:1.100,  img:UL(27), desc:'25-piece M10x60mm zinc-plated hex bolts with matching nuts and washers.', badge:null, stock:'in-stock' },
  { id:28, name:'Masonry Anchors 8mm 50pc',      category:'fasteners',   price:1.600,  img:UL(28), desc:'50-pack nylon masonry anchors 8mm with screws. For brick, concrete and block.', badge:null, stock:'in-stock' },
  { id:29, name:'Nuts Bolts Washers 500pc',      category:'fasteners',   price:2.500,  img:UL(29), desc:'500-piece assorted metric nuts, bolts and washers. M4 to M8. Organiser box.', badge:'Popular', stock:'in-stock' },
  { id:30, name:'Cable Ties 200pc Mixed',        category:'fasteners',   price:0.600,  img:UL(30), desc:'200-piece mixed cable ties 100, 200, 300mm lengths. Black UV-resistant nylon.', badge:null, stock:'in-stock' },
  { id:31, name:'Tape Measure 8m',               category:'measuring',   price:1.800,  img:UL(31), desc:'8-metre steel tape measure with metric and imperial markings. Auto-lock and belt clip.', badge:null, stock:'in-stock' },
  { id:32, name:'Spirit Level 1200mm',           category:'measuring',   price:3.200,  img:UL(32), desc:'1200mm aluminium spirit level with 3 bubble vials. Horizontal, vertical and 45-degree.', badge:null, stock:'in-stock' },
  { id:33, name:'Laser Level Cross Line',        category:'measuring',   price:8.500,  img:UL(33), desc:'Self-levelling cross-line laser with horizontal and vertical beams. 15m working range.', badge:'Pro', stock:'low-stock' },
  { id:34, name:'Digital Stud Finder',           category:'measuring',   price:4.200,  img:UL(34), desc:'Electronic stud finder detects wood and metal stusts behind walls up to 38mm deep.', badge:null, stock:'in-stock' },
  { id:35, name:'Steel Square 300mm',            category:'measuring',   price:1.400,  img:UL(35), desc:'300mm stainless steel try square for marking and checking right angles.', badge:null, stock:'in-stock' },
  { id:36, name:'Chalk Line 30m',                category:'measuring',   price:1.100,  img:UL(36), desc:'30-metre chalk line reel with blue chalk powder. For marking long straight lines.', badge:null, stock:'in-stock' },
  { id:37, name:'Safety Goggles Clear',          category:'safety',      price:0.800,  img:UL(37), desc:'Clear anti-scratch safety goggles with indirect ventilation. EN166 certified.', badge:null, stock:'in-stock' },
  { id:38, name:'Leather Work Gloves',           category:'safety',      price:1.200,  img:UL(38), desc:'Leather palm work gloves with breathable spandex back. Cut and abrasion resistant.', badge:'Best Seller', stock:'in-stock' },
  { id:39, name:'Dust Mask N95 10pc',            category:'safety',      price:1.500,  img:UL(39), desc:'Pack of 10 N95 dust masks with valve. Filters 95% of airborne particles.', badge:null, stock:'in-stock' },
  { id:40, name:'Hard Hat Yellow',               category:'safety',      price:2.200,  img:UL(40), desc:'Yellow construction hard hat with adjustable ratchet harness. EN397 certified.', badge:null, stock:'in-stock' },
  { id:41, name:'Hi-Vis Safety Vest',            category:'safety',      price:0.900,  img:UL(41), desc:'High-visibility orange safety vest with reflective strips. EN471 Class 2.', badge:null, stock:'in-stock' },
  { id:42, name:'Steel Toe Safety Boots',        category:'safety',      price:8.500,  img:UL(42), desc:'S3 steel toe cap safety boots with midsole protection and slip-resistant sole. Sizes 40-46.', badge:null, stock:'low-stock' },
  { id:43, name:'Hand Saw 550mm',                category:'cutting',     price:2.800,  img:UL(43), desc:'550mm hardpoint hand saw, 8TPI for fast cross-cutting of timber. Comfortable grip.', badge:null, stock:'in-stock' },
  { id:44, name:'Hacksaw + 5 Blades',            category:'cutting',     price:2.200,  img:UL(44), desc:'Heavy-duty hacksaw frame with 5 bi-metal blades. Adjustable tension. Cuts metal and plastic.', badge:null, stock:'in-stock' },
  { id:45, name:'Utility Knife + 10 Blades',    category:'cutting',     price:1.100,  img:UL(45), desc:'Heavy-duty retractable utility knife with rubber grip and 10 extra snap-off blades.', badge:'Popular', stock:'in-stock' },
  { id:46, name:'Tin Snips Aviation 250mm',      category:'cutting',     price:3.200,  img:UL(46), desc:'250mm aviation tin snips for straight and curved cuts in sheet metal up to 1.2mm.', badge:null, stock:'in-stock' },
  { id:47, name:'PVC Pipe Cutter 42mm',          category:'cutting',     price:2.600,  img:UL(47), desc:'Ratchet pipe cutter for clean cuts on PVC, CPVC and PEX pipes up to 42mm diameter.', badge:null, stock:'in-stock' },
  { id:48, name:'Tool Bag 16" Heavy Duty',       category:'storage',     price:5.500,  img:UL(48), desc:'16-inch heavy-duty canvas tool bag with 20 pockets and reinforced base. Padded strap.', badge:null, stock:'in-stock' },
  { id:49, name:'Extension Cord 10m 4-Way',      category:'storage',     price:4.200,  img:UL(49), desc:'10-metre extension cord with 4 sockets and surge protection. 1.5mm cable, 13A rating.', badge:'Popular', stock:'in-stock' },
  { id:50, name:'Tool Box 16" Metal',            category:'storage',     price:6.800,  img:UL(50), desc:'16-inch metal tool box with removable tray and strong locking clasp. Powder coat finish.', badge:null, stock:'in-stock' },
  { id:51, name:'Drill Bit Set HSS 20pc',       category:'power-tools', price:4.500,  img:UL(51), desc:'20-piece HSS drill bit set 1-10mm. For wood, metal and plastic. Titanium coated.', badge:'Popular', stock:'in-stock' },
  { id:52, name:'Sanding Sheet Set 40pc',       category:'power-tools', price:1.800,  img:UL(52), desc:'40 assorted sanding sheets 60/80/120/240 grit. For orbital and hand sanding.', badge:null, stock:'in-stock' },
  { id:53, name:'Pipe Wrench 14 inch',          category:'hand-tools',  price:3.500,  img:UL(53), desc:'14-inch heavy duty pipe wrench with aluminium body and hardened steel jaw. 0-50mm.', badge:null, stock:'in-stock' },
  { id:54, name:'Staple Gun + 1000 Staples',    category:'hand-tools',  price:4.200,  img:UL(54), desc:'Heavy-duty staple gun with 1000 staples included. For fabric, wood and insulation.', badge:null, stock:'in-stock' },
  { id:55, name:'Duct Tape 50mm x 50m',         category:'fasteners',   price:0.900,  img:UL(55), desc:'Heavy-duty silver duct tape 50mm wide x 50m long. Waterproof and UV resistant.', badge:null, stock:'in-stock' },
  { id:56, name:'Digital Laser Measurer 40m',   category:'measuring',   price:8.500,  img:UL(56), desc:'Laser distance measurer up to 40m. Area and volume calculations. LCD display.', badge:'Pro', stock:'in-stock' },
  { id:57, name:'Knee Pads Professional',       category:'safety',      price:3.200,  img:UL(57), desc:'Professional knee pads with gel cushion and EVA foam. Adjustable straps. EN14404.', badge:null, stock:'in-stock' },
  { id:58, name:'Cutting Discs 115mm 10pc',     category:'cutting',     price:2.800,  img:UL(58), desc:'10-pack 115mm angle grinder cutting discs for metal and inox. 1mm thin kerf.', badge:null, stock:'in-stock' },
  { id:59, name:'5-Pocket Tool Belt',           category:'storage',     price:4.500,  img:UL(59), desc:'Heavy-duty 5-pocket tool belt with hammer holder. Adjustable waist up to 122cm.', badge:null, stock:'in-stock' },
  { id:60, name:'Wall Plugs 100pc Assorted',    category:'fasteners',   price:0.750,  img:UL(60), desc:'100-piece assorted nylon wall plugs 6mm, 8mm and 10mm. For brick and concrete.', badge:null, stock:'in-stock' }
];

// ── ARABIC PRODUCT TRANSLATIONS ───────────────────────────────────────────
var _AR_PRODUCTS = {
  1:  { name:'مثقاب لاسلكي 18 فولت',           desc:'مثقاب ليثيوم أيون 18 فولت لاسلكي بصندوق تروس ذو سرعتين، كلاتش كيلس 13 ملم، ووظيفة الرجوع.' },
  2:  { name:'طاحونة زاوية 115 ملم',             desc:'طاحونة زاوية 900 واط للقطع والطحن والتلميع. 11,000 دورة/دقيقة.' },
  3:  { name:'منشار دائري 185 ملم',              desc:'منشار دائري 1200 واط مع دليل ليزر. يقطع الخشب حتى 65 ملم. ميل 0-45 درجة.' },
  4:  { name:'منشار التقطيع 650 واط',             desc:'منشار تقطيع 650 واط بحركة بندولية وسرعة متغيرة. يقطع الخشب والمعدن والبلاستيك.' },
  5:  { name:'ماكينة صنفرة مدارية',               desc:'ماكينة صنفرة 300 واط مع كيس غبار. قاعدة 125 ملم، 12,000 دورة/دقيقة.' },
  6:  { name:'مفك صدم لاسلكي 18 فولت',           desc:'مفك صدم بدون فرش 18 فولت بعزم 180 نيوتن. 3 إعدادات سرعة، يشمل ضوء LED.' },
  7:  { name:'مطرقة حفر SDS',                    desc:'مطرقة حفر SDS-plus 800 واط لحفر الخرسانة والطوب والحجر. مفتاح 3 وظائف.' },
  8:  { name:'مسدس حرارة 2000 واط',              desc:'مسدس حرارة 2000 واط بدرجتي 300 و500 درجة. مثالي لتقشير الطلاء والتشكيل الحراري.' },
  9:  { name:'منشار ترددي',                       desc:'منشار ترددي 900 واط بتغيير شفرة بدون أدوات. سرعة متغيرة للخشب والمعدن.' },
  10: { name:'مفك لاسلكي 3.6 فولت',              desc:'مفك لاسلكي صغير 3.6 فولت مع 15 إعداد عزم وضوء LED.' },
  11: { name:'مطرقة مخلب 16 أوقية',              desc:'مطرقة مخلب 16 أوقية من الفولاذ المطروح مع مقبض ألياف زجاجية. تقلل الاهتزاز.' },
  12: { name:'طقم مفكات فيليبس 6 قطع',           desc:'6 مفكات فيليبس كروم فاناديوم PH0 إلى PH3. رؤوس مغناطيسية ومقابض مريحة.' },
  13: { name:'طقم مفكات مسطحة 6 قطع',            desc:'6 مفكات مسطحة بشفرات فولاذ مقساة ومقابض مريحة.' },
  14: { name:'مفتاح إنجليزي 12 بوصة',            desc:'مفتاح إنجليزي قابل للضبط 12 بوصة، فك حتى 34 ملم. بناء فولاذي مطلي بالكروم.' },
  15: { name:'طقم مفاتيح مزدوجة 12 قطعة',        desc:'12 مفتاح مزدوج 8-19 ملم. كروم فاناديوم بتشطيب مرآة.' },
  16: { name:'طقم كماشات 3 قطع',                 desc:'3 قطع: كماشة مزدوجة، كماشة أنف طويل وقاطع قطري. فولاذ كروم فاناديوم.' },
  17: { name:'طقم مفاتيح آلن 9 قطع',             desc:'9 مفاتيح آلن متري 1.5-10 ملم. فولاذ CRV بذراع طويل للوصول الإضافي.' },
  18: { name:'طقم سوكيت 40 قطعة 1/2"',           desc:'40 قطعة محرك 1/2" مع راشيت سريع الإطلاق. متري وإمبريالي.' },
  19: { name:'مطرقة مطاط 32 أوقية',              desc:'مطرقة مطاط 32 أوقية مع مقبض خشبي. لتجميع الأثاث وتركيب البلاط.' },
  20: { name:'طقم أزاميل 4 قطع',                 desc:'4 أزاميل خشب 6 و12 و19 و25 ملم. فولاذ عالي الكربون بحواف محسونة.' },
  21: { name:'مسامير 50 ملم 1 كيلو',             desc:'علبة 1 كيلو مسامير 50×2.65 ملم. للنجارة العامة والتأطير.' },
  22: { name:'مسامير 75 ملم 1 كيلو',             desc:'علبة 1 كيلو مسامير 75×3.35 ملم. مسامير بناء ثقيلة.' },
  23: { name:'مسامير 100 ملم 1 كيلو',            desc:'علبة 1 كيلو مسامير 100×4 ملم. لتأطير الخشب الإنشائي.' },
  24: { name:'براغي خشب 4×50 ملم 200 قطعة',     desc:'200 برغي خشب مغلفن 4×50 ملم. رأس غاطس، بوزيدرايف.' },
  25: { name:'براغي جبسم 3.5×35 ملم',            desc:'200 برغي جبسم 3.5×35 ملم. رأس مخروطي، حلزون خشن، طرف حفر ذاتي.' },
  26: { name:'براغي حفر ذاتي 200 قطعة',          desc:'200 برغي TEK حفر ذاتي للمعدن. 4.2×13 ملم.' },
  27: { name:'صواميل سداسية M10×60 ملم 25 قطعة', desc:'25 صامولة سداسية M10×60 ملم مغلفنة مع صواميل وحلقات مطابقة.' },
  28: { name:'مراسي خرسانة 8 ملم 50 قطعة',      desc:'50 مرساة نايلون للبناء 8 ملم مع براغي. للطوب والخرسانة والبلوك.' },
  29: { name:'صواميل وبراغي وحلقات 500 قطعة',   desc:'500 قطعة متنوعة من الصواميل والبراغي والحلقات M4 إلى M8 في علبة منظمة.' },
  30: { name:'ربطات كيبل 200 قطعة متنوعة',       desc:'200 ربطة كيبل بمقاسات 100 و200 و300 ملم. نايلون أسود مقاوم للأشعة.' },
  31: { name:'شريط قياس 8 متر',                  desc:'شريط قياس فولاذي 8 أمتار بعلامات متري وإمبريالي. قفل تلقائي وقلادة حزام.' },
  32: { name:'ميزان ماء 1200 ملم',               desc:'ميزان ماء ألومنيوم 1200 ملم مع 3 فقاعات. أفقي وعمودي و45 درجة.' },
  33: { name:'ميزان ليزر متقاطع',                desc:'ميزان ليزر متقاطع ضبط ذاتي بخطوط أفقية وعمودية. مدى عمل 15 متر.' },
  34: { name:'كاشف الحوامل الرقمي',              desc:'كاشف إلكتروني يكشف الخشب والمعدن خلف الجدران حتى عمق 38 ملم.' },
  35: { name:'زاوية فولاذية 300 ملم',             desc:'زاوية فولاذية مقاومة للصدأ 300 ملم للتحديد والتحقق من الزوايا القائمة.' },
  36: { name:'خيط طباشير 30 متر',                desc:'بكرة خيط طباشير 30 متر مع مسحوق أزرق. للتحديد على خطوط مستقيمة.' },
  37: { name:'نظارات سلامة شفافة',               desc:'نظارات سلامة شفافة مضادة للخدش مع تهوية غير مباشرة. معتمدة EN166.' },
  38: { name:'قفازات جلد للعمل',                 desc:'قفازات جلد مع ظهر سبانديكس قابل للتنفس. مقاومة للقطع والتآكل.' },
  39: { name:'كمامات N95 10 قطع',                desc:'علبة 10 كمامات N95 مع صمام. تفلتر 95% من الجزيئات المحمولة جواً.' },
  40: { name:'خوذة حماية صفراء',                 desc:'خوذة بناء صفراء مع ضبط راشيت قابل للتعديل. معتمدة EN397.' },
  41: { name:'سترة سلامة عاكسة',                 desc:'سترة سلامة برتقالية عاكسة مع أشرطة عاكسة. EN471 فئة 2.' },
  42: { name:'حذاء أمان بمقدمة فولاذية',         desc:'حذاء أمان بمقدمة فولاذية وحماية النعل ونعل مقاوم للانزلاق. مقاسات 40-46.' },
  43: { name:'منشار يدوي 550 ملم',               desc:'منشار يدوي 550 ملم، 8 أسنان/بوصة للقطع السريع. مقبض مريح.' },
  44: { name:'منشار حديد + 5 شفرات',             desc:'إطار منشار حديد ثقيل مع 5 شفرات ثنائية المعدن. يقطع المعدن والبلاستيك.' },
  45: { name:'سكين فائدة + 10 شفرات',            desc:'سكين فائدة قابلة للسحب مع قبضة مطاطية و10 شفرات إضافية.' },
  46: { name:'مقص تيفيشن 250 ملم',               desc:'مقص تيفيشن 250 ملم للقطع في الصفائح المعدنية حتى 1.2 ملم.' },
  47: { name:'قاطع أنابيب PVC 42 ملم',           desc:'قاطع راشيت لأنابيب PVC وCPVC وPEX حتى قطر 42 ملم. قطع نظيف.' },
  48: { name:'حقيبة أدوات 16 بوصة',              desc:'حقيبة أدوات قماش ثقيل 16 بوصة مع 20 جيب وقاعدة مقواة. حزام مبطن.' },
  49: { name:'سلك تمديد 10 م 4 مخارج',           desc:'سلك تمديد 10 متر مع 4 مخارج وحماية ضد التدفق الزائد. 1.5 ملم، 13 أمبير.' },
  50: { name:'صندوق أدوات معدني 16 بوصة',        desc:'صندوق أدوات معدني 16 بوصة مع صينية قابلة للإزالة ومشبك قفل قوي.' },
  51: { name:'طقم رؤوس مثقاب HSS 20 قطعة',       desc:'20 رأس مثقاب HSS 1-10 ملم. للخشب والمعدن والبلاستيك. مطلي بالتيتانيوم.' },
  52: { name:'طقم أوراق صنفرة 40 قطعة',          desc:'40 ورقة صنفرة متنوعة 60/80/120/240. للصنفرة المدارية واليدوية.' },
  53: { name:'مفتاح أنابيب 14 بوصة',             desc:'مفتاح أنابيب ثقيل 14 بوصة مع جسم ألومنيوم وفك فولاذ مقسى. 0-50 ملم.' },
  54: { name:'مسدس دباسة + 1000 دبوس',           desc:'مسدس دباسة ثقيل مع 1000 دبوس. للقماش والخشب والعزل.' },
  55: { name:'شريط لاصق 50 ملم × 50 متر',        desc:'شريط لاصق فضي ثقيل 50 ملم × 50 متر. مقاوم للماء والأشعة فوق البنفسجية.' },
  56: { name:'قياس ليزر رقمي 40 متر',            desc:'قياس مسافة ليزر حتى 40 متر. حسابات المساحة والحجم. شاشة LCD.' },
  57: { name:'واقيات ركبة مهنية',                desc:'واقيات ركبة مهنية مع وسادة جل وإسفنج EVA. أشرطة قابلة للتعديل. EN14404.' },
  58: { name:'أقراص قطع 115 ملم 10 قطع',         desc:'10 قرص قطع 115 ملم لطاحونة الزاوية للمعدن والإنوكس. سماكة 1 ملم.' },
  59: { name:'حزام أدوات 5 جيوب',                desc:'حزام أدوات 5 جيوب ثقيل مع حامل مطرقة. خصر قابل للتعديل حتى 122 سم.' },
  60: { name:'بلاستيك جدار متنوع 100 قطعة',      desc:'100 قطعة بلاستيك جدار نايلون متنوعة 6 و8 و10 ملم. للطوب والخرسانة.' }
};

// Arabic category display names
var _AR_CATS = {
  'power-tools':'أدوات كهربائية', 'hand-tools':'أدوات يدوية',
  'fasteners':'مثبتات', 'measuring':'قياس',
  'safety':'سلامة', 'cutting':'قطع', 'storage':'تخزين'
};

let cart = [];
let activeFilter = 'all';

// ── MULTI-CATEGORY HELPER (storefront) ────────────────────────────────────
// Returns array of extra category slugs assigned to a product via the admin
// multi-category picker (stored in dhowtech_multi_cats in localStorage).
function getMultiCats(id) {
  try {
    var map = JSON.parse(localStorage.getItem('dhowtech_multi_cats') || '{}');
    return Array.isArray(map[String(id)]) ? map[String(id)] : [];
  } catch(e) { return []; }
}

function imgError(el) {
  if (!el.dataset.retry) {
    el.dataset.retry = '1';
    const src = el.src;
    setTimeout(() => { el.src = ''; el.src = src; }, 4000);
  } else {
    el.style.display = 'none';
    if (el.nextElementSibling) el.nextElementSibling.style.display = 'flex';
  }
}

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
  const { error } = await sbFetch(SB_URL + '/rest/v1/dhowtech_stock', {
    method: 'POST',
    headers: { ...SB_H, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(rows)
  });
  if (error) localStorage.setItem('dhowtech_stock', JSON.stringify(_sbStock));
}

// ── RENDER PRODUCTS ───────────────────────────────────────────────────────
function renderProducts() {
  const query = document.getElementById('searchInput').value.toLowerCase();
  const grid  = document.getElementById('productsGrid');
  const empty = document.getElementById('productsEmpty');
  const filtered = getAllProducts().filter(p => {
    const matchCat    = activeFilter === 'all' || p.category === activeFilter || getMultiCats(p.id).includes(activeFilter);
    const matchSearch = !query || p.name.toLowerCase().includes(query) || p.desc.toLowerCase().includes(query);
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
    window._searchTimer = setTimeout(function() { trackSearch(filtered.map(function(p) { return p.id; })); }, 700);
  }

  // custom photos set by admin (loaded from Supabase)
  const customPhotos = _sbPhotos;

  const isAr = _lang === 'ar';
  grid.innerHTML = filtered.map(p => {
    const liveStatus = getLiveStock(p.id) || p.stock;
    const liveQty    = getLiveQty(p.id);
    const isOut      = liveStatus === 'out-of-stock';
    const isLow      = liveStatus === 'low-stock';
    const photo      = customPhotos[p.id] || p.img;
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
          <img src="${photo}" alt="${pName}" loading="lazy" onerror="imgError(this)" />
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
  _pmId  = id;
  _pmQty = 1;
  const p           = getAllProducts().find(x => x.id === id);
  const liveStatus  = getLiveStock(id) || p.stock;
  const liveQty     = getLiveQty(id);
  const isOut       = liveStatus === 'out-of-stock';
  const isLow       = liveStatus === 'low-stock';
  const customPhotos = _sbPhotos;
  // Get bigger version of the image for the modal
  const bigImg = customPhotos[id] || p.img.replace('width=400&height=400', 'width=900&height=900');

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
            '<input type="number" id="pmQtyDisplay" value="1" min="1" oninput="pmQtyInput(this)" onblur="pmQtyBlur(this)" />' +
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
  document.getElementById('cartCount').textContent = cart.reduce((s,c) => s+c.qty, 0);
  const body  = document.getElementById('cartItems');
  const total = cart.reduce((s,c) => s+c.price*c.qty, 0);
  document.getElementById('cartTotal').textContent = total.toFixed(3) + ' KWD';
  const customPhotos = _sbPhotos;
  if (!cart.length) { body.innerHTML = '<p class="empty-cart">Your cart is empty.</p>'; return; }
  body.innerHTML = cart.map(c => `
    <div class="cart-item">
      <div class="cart-item-icon"><img src="${customPhotos[c.id]||c.img}" alt="${c.name}" onerror="imgError(this)" /></div>
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

  // Save order to Supabase
  saveOrderToSupabase({ name, phone, address, notes, items: cart.map(c=>({name:c.name,sku:getProductSku(c.id),qty:c.qty,price:c.price})), total });

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
    hero_tag:'<i class="fa fa-tools"></i> Kuwait\'s #1 Hardware Store',
    hero_h1:'Built <span>Tough.</span><br/>Built for <span>Kuwait.</span>',
    hero_p:'Power tools, hand tools, fasteners, safety gear and more. Everything you need to build, fix and create — delivered fast across Kuwait and the GCC.',
    hero_shop:'Shop Now', hero_quote:'Get a Quote',
    stat_products:'Products', stat_genuine:'Genuine', stat_delivery:'Delivery',
    cat_tag:'Browse by Type',
    cat_h2:'Shop by <span class="orange">Category</span>',
    cat_power:'Power Tools', cat_hand:'Hand Tools', cat_fasteners:'Fasteners',
    cat_measuring:'Measuring', cat_safety:'Safety Gear', cat_cutting:'Cutting Tools', cat_storage:'Storage', cat_all:'All Products',
    cat_power_sub:'Drills, Grinders, Saws, Sanders', cat_hand_sub:'Hammers, Spanners, Pliers, Chisels',
    cat_fasteners_sub:'Nails, Screws, Bolts, Anchors', cat_measuring_sub:'Tape Measures, Levels, Laser',
    cat_safety_sub:'Gloves, Goggles, Hard Hats, Vests', cat_cutting_sub:'Hand Saws, Hacksaws, Utility Knives',
    cat_storage_sub:'Tool Bags, Tool Boxes, Extension Cords', cat_all_sub:'Browse our full catalog',
    pill_all:'All', pill_safety:'Safety', pill_cutting:'Cutting', pill_storage:'Storage',
    prod_tag:'Full Catalog', prod_h2:'Our <span class="orange">Products</span>',
    prod_search:'Search tools, nails, screws...',
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
    about_badge:'EST. 2024 - KUWAIT',
    about_p1:'DhowTech is Kuwait\'s go-to destination for professional-grade tools and hardware. Whether you are a tradesperson, contractor, or weekend DIY enthusiast — we have everything you need to get the job done right.',
    about_p2:'We stock only genuine, quality-tested products from trusted brands, with competitive prices and expert advice available in Arabic and English.',
    about_f1:'100% genuine, quality-tested products', about_f2:'Expert advice in Arabic and English',
    about_f3:'Same-day delivery within Kuwait City', about_f4:'Bulk pricing for contractors and businesses',
    about_f5:'Easy returns and after-sales support', about_cta:'Contact Us',
    footer_desc:'Kuwait\'s trusted supplier of quality hardware, power tools and construction materials since 2024.',
    footer_nav:'Navigation', footer_cats:'Categories', footer_support:'Support',
    footer_trade:'Trade Accounts', footer_bulk:'Bulk Orders', footer_delivery_info:'Delivery Info',
    footer_returns:'Returns Policy', footer_tech:'Technical Help',
    footer_copy:'2024 DhowTech Hardware and Innovation. All rights reserved. Kuwait.',
    intro_tag:'Welcome to DhowTech',
    intro_h2:'Kuwait\'s Go-To <span class="orange">Hardware</span> Store — Open 7 Days',
    intro_p:'DhowTech supplies professional-grade power tools, hand tools, fasteners, safety gear and construction materials to contractors, businesses and individuals across Kuwait. Whether you need one item or a full site order — we have it in stock and ready to go.',
    intro_c1:'60+ Products In Stock', intro_c2:'Same-Day Kuwait Delivery',
    intro_c3:'Bulk & Trade Pricing', intro_c4:'Arabic & English Support',
    intro_cta_text:'Call Us: 9765 6372',
    co_title:'Complete Your Order', co_order_sum:'Order Summary', co_your_details:'Your Details',
    co_delivery_addr:'Delivery Address', co_total_label:'Total Amount',
    co_full_name:'Full Name *', co_wa_num:'WhatsApp Number *', co_area:'Area *',
    co_block:'Block', co_street:'Street', co_house:'House / Building',
    co_floor:'Floor / Apt', co_notes:'Notes', co_submit:'Send Order on WhatsApp',
    back_btn:'Back to Products',
    lang_switch:'عربي',
    mq_items:['Power Tools','Hand Tools','Nails & Screws','Safety Gear','Measuring Tools','Drills & Grinders','Cutting Tools','Fasteners','Tool Storage']
  },
  ar: {
    nav_home:'الرئيسية', nav_about:'من نحن', nav_products:'المنتجات', nav_categories:'الفئات', nav_contact:'اتصل بنا',
    cart_label:' سلة',
    hero_tag:'<i class="fa fa-tools"></i> المتجر الأول للأدوات في الكويت',
    hero_h1:'مصنوع <span>بمتانة.</span><br/>صُنع لـ<span>الكويت.</span>',
    hero_p:'أدوات كهربائية، أدوات يدوية، مثبتات، معدات سلامة والمزيد. كل ما تحتاجه للبناء والإصلاح والإنشاء — توصيل سريع في جميع أنحاء الكويت ودول الخليج.',
    hero_shop:'تسوق الآن', hero_quote:'احصل على عرض سعر',
    stat_products:'منتج', stat_genuine:'أصلي', stat_delivery:'توصيل خليجي',
    cat_tag:'تصفح حسب النوع',
    cat_h2:'تسوق حسب <span class="orange">الفئة</span>',
    cat_power:'أدوات كهربائية', cat_hand:'أدوات يدوية', cat_fasteners:'مثبتات',
    cat_measuring:'أدوات القياس', cat_safety:'معدات السلامة', cat_cutting:'أدوات القطع', cat_storage:'التخزين', cat_all:'جميع المنتجات',
    cat_power_sub:'مثاقب، طاحونات، مناشير، صنفرة', cat_hand_sub:'مطارق، مفاتيح، كماشات، إزميل',
    cat_fasteners_sub:'مسامير، براغي، صواميل، مراسي', cat_measuring_sub:'أشرطة قياس، ميزان ماء، ليزر',
    cat_safety_sub:'قفازات، نظارات، خوذات، سترات', cat_cutting_sub:'مناشير يدوية، مناشير حديد، سكاكين',
    cat_storage_sub:'حقائب أدوات، صناديق أدوات، أسلاك تمديد', cat_all_sub:'تصفح كتالوجنا الكامل',
    pill_all:'الكل', pill_safety:'سلامة', pill_cutting:'قطع', pill_storage:'تخزين',
    prod_tag:'الكتالوج الكامل', prod_h2:'<span class="orange">منتجاتنا</span>',
    prod_search:'ابحث عن أدوات، مسامير...',
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
    about_badge:'تأسس 2024 - الكويت',
    about_p1:'دهو تك هي الوجهة الأولى في الكويت للأدوات الاحترافية ومستلزمات الأعمال. سواء كنت حرفياً أو مقاولاً أو هاوياً — لدينا كل ما تحتاجه لإنجاز المهمة على أكمل وجه.',
    about_p2:'نحن نخزن منتجات أصلية مختبرة جودتها من علامات تجارية موثوقة، بأسعار تنافسية ونصائح من خبراء باللغتين العربية والإنجليزية.',
    about_f1:'منتجات 100% أصلية ومختبرة الجودة', about_f2:'نصائح من خبراء بالعربية والإنجليزية',
    about_f3:'توصيل في نفس اليوم داخل مدينة الكويت', about_f4:'أسعار بالجملة للمقاولين والشركات',
    about_f5:'إرجاع سهل ودعم ما بعد البيع', about_cta:'اتصل بنا',
    footer_desc:'مورد موثوق للأدوات الجودة والأدوات الكهربائية ومواد البناء في الكويت منذ 2024.',
    footer_nav:'التنقل', footer_cats:'الفئات', footer_support:'الدعم',
    footer_trade:'الحسابات التجارية', footer_bulk:'الطلبات بالجملة', footer_delivery_info:'معلومات التوصيل',
    footer_returns:'سياسة الإرجاع', footer_tech:'المساعدة التقنية',
    footer_copy:'2024 دهو تك للأدوات والابتكار. جميع الحقوق محفوظة. الكويت.',
    intro_tag:'مرحباً بك في دهو تك',
    intro_h2:'المتجر الأول للأدوات في الكويت — <span class="orange">مفتوح 7 أيام</span>',
    intro_p:'دهو تك توفر أدوات كهربائية وأدوات يدوية ومثبتات ومعدات سلامة ومواد بناء للمقاولين والشركات والأفراد في جميع أنحاء الكويت. سواء احتجت قطعة واحدة أو طلباً كاملاً — لدينا المخزون وجاهز.',
    intro_c1:'60+ منتج في المخزون', intro_c2:'توصيل في نفس اليوم بالكويت',
    intro_c3:'أسعار الجملة والتجارة', intro_c4:'دعم بالعربية والإنجليزية',
    intro_cta_text:'اتصل بنا: 9765 6372',
    co_title:'أكمل طلبك', co_order_sum:'ملخص الطلب', co_your_details:'بياناتك',
    co_delivery_addr:'عنوان التوصيل', co_total_label:'المبلغ الإجمالي',
    co_full_name:'الاسم الكامل *', co_wa_num:'رقم واتساب *', co_area:'المنطقة *',
    co_block:'القطعة', co_street:'الشارع', co_house:'المنزل / المبنى',
    co_floor:'الطابق / الشقة', co_notes:'ملاحظات', co_submit:'إرسال الطلب عبر واتساب',
    back_btn:'العودة للمنتجات',
    lang_switch:'EN',
    mq_items:['أدوات كهربائية','أدوات يدوية','مسامير وبراغي','معدات السلامة','أدوات القياس','مثاقب وطاحونات','أدوات القطع','مثبتات','تخزين الأدوات']
  }
};

function setLang(lang) {
  _lang = lang;
  localStorage.setItem('dhowtech_lang', lang);
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
  var saved = localStorage.getItem('dhowtech_lang');
  if (saved === 'ar') setLang('ar');
})();

// ── SAVE ORDER TO SUPABASE ────────────────────────────────────────────────────
async function saveOrderToSupabase(order) {
  const payload = [{
    customer_name:  order.name,
    customer_phone: order.phone,
    address:        order.address,
    notes:          order.notes || '',
    items:          order.items,
    total:          parseFloat(order.total.toFixed(3)),
    status:         'pending'
  }];
  console.log('[DhowTech] Saving order:', payload);
  const result = await sbFetch(SB_URL + '/rest/v1/dhowtech_orders', {
    method: 'POST',
    headers: Object.assign({}, SB_H, {
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }),
    body: JSON.stringify(payload)
  });
  if (result.error) {
    console.error('[DhowTech] Order save FAILED:', result.error);
    alert('⚠️ Order save failed: ' + result.error + '\n\nYour WhatsApp message was still sent.');
  } else {
    console.log('[DhowTech] Order saved OK:', result.data);
  }
}
