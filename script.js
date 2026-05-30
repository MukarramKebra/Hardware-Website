const U   = (id) => `https://images.unsplash.com/photo-${id}?w=420&h=320&fit=crop&auto=format&q=80`;
const UL  = (id) => `product-images/${id}.jpg`;   // local images

// ── SKU HELPER ────────────────────────────────────────────────────────────
// SKU is a separate display label from the internal product ID.
// Admin can set a custom SKU; it's stored in rawaj_sku_map in localStorage.
function getProductSku(id) {
  try {
    var map = JSON.parse(localStorage.getItem('rawaj_sku_map') || '{}');
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
let _customProds = [];      // admin-added products from rawaj_products table
let _hiddenIds   = new Set(); // base product IDs hidden by admin

async function loadSBData() {
  const [s, p, c, h] = await Promise.all([
    sbFetch(SB_URL + '/rest/v1/rawaj_stock?select=*',                         { headers: SB_H }),
    sbFetch(SB_URL + '/rest/v1/rawaj_photos?select=*',                        { headers: SB_H }),
    sbFetch(SB_URL + '/rest/v1/rawaj_products?select=*',                        { headers: SB_H }),
    sbFetch(SB_URL + '/rest/v1/rawaj_hidden?select=product_id',               { headers: SB_H })
  ]);
  if (s.error) {
    console.warn('Supabase offline — using localStorage fallback');
    try { _sbStock  = JSON.parse(localStorage.getItem('rawaj_stock')  || '{}'); } catch(_) {}
    try { _sbPhotos = JSON.parse(localStorage.getItem('rawaj_photos') || '{}'); } catch(_) {}
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
  // ── SHATAFFA / WATER JETS (1-10) ─────────────────────────────────────────
  { id:1,  name:'Stainless Steel Shataffa Sprayer',   category:'shataffa',     price:3.500,  img:'Rawaj Products/SKU-0001.jpg',  desc:'Heavy-duty stainless steel bidet hand sprayer with metal valve. Corrosion-resistant, easy to install next to any toilet.', badge:'Best Seller', stock:'in-stock' },
  { id:2,  name:'Wall-Mount Shataffa Set',            category:'shataffa',     price:5.200,  img:'Rawaj Products/SKU-0002.jpg',  desc:'Complete wall-mount bidet sprayer set including holder, 1.2m hose and T-valve. Chrome finish, all fittings included.', badge:null, stock:'in-stock' },
  { id:3,  name:'Dual-Mode Bidet Sprayer',            category:'shataffa',     price:7.800,  img:'Rawaj Products/SKU-0003.jpg',  desc:'Two-mode pressure control sprayer with soft and strong jet settings. Anti-leak brass head, ergonomic grip.', badge:null, stock:'in-stock' },
  { id:4,  name:'Clip-On Bidet Toilet Attachment',   category:'shataffa',     price:4.500,  img:'Rawaj Products/SKU-0004.jpg',  desc:'Easy clip-on bidet attachment fits most standard toilets. Cold water, no electricity needed, installs in minutes.', badge:null, stock:'in-stock' },
  { id:5,  name:'Braided Shataffa Hose 1.2m',        category:'shataffa',     price:1.200,  img:'Rawaj Products/SKU-0005.jpg',  desc:'1.2m stainless steel braided flexible hose for bidet sprayers. 1/2" fittings, burst-proof inner tube.', badge:null, stock:'in-stock' },
  { id:6,  name:'Angle Valve with T-Connector',      category:'shataffa',     price:1.800,  img:'Rawaj Products/SKU-0006.jpg',  desc:'Chrome angle stop valve with T-piece connector for shataffa installation. Quarter-turn operation, 1/2" BSP.', badge:null, stock:'in-stock' },
  { id:7,  name:'Brushed Nickel Bidet Sprayer',      category:'shataffa',     price:8.500,  img:'Rawaj Products/SKU-0007.jpg',  desc:'Premium brushed nickel bidet hand sprayer. Heavy solid brass body, drip-free ceramic valve, luxury finish.', badge:null, stock:'in-stock' },
  { id:8,  name:'Shataffa Holder Hook Chrome',       category:'shataffa',     price:0.800,  img:'Rawaj Products/SKU-0008.jpg',  desc:'Adjustable chrome shataffa sprayer holder. Mounts on wall or cistern. Keeps sprayer accessible and neat.', badge:null, stock:'in-stock' },
  { id:9,  name:'Hot & Cold Bidet Mixer Set',        category:'shataffa',     price:12.000, img:'Rawaj Products/SKU-0009.jpg',  desc:'Hot and cold water bidet sprayer set with thermostatic mixing valve. Delivers warm comfortable water wash.', badge:null, stock:'low-stock' },
  { id:10, name:'Non-Return Check Valve 1/2"',       category:'shataffa',     price:0.600,  img:'Rawaj Products/SKU-0010.jpg', desc:'Brass non-return check valve 1/2" for shataffa and bidet lines. Prevents back-flow contamination.', badge:null, stock:'in-stock' },
  // ── TOILET SEATS (11-18) ──────────────────────────────────────────────────
  { id:11, name:'Standard White Toilet Seat',        category:'toilet-seats', price:4.500,  img:'Rawaj Products/SKU-0011.jpg', desc:'Standard polypropylene toilet seat with chrome hinges. Universal fitting for most toilet bowls, easy to clean.', badge:'Best Seller', stock:'in-stock' },
  { id:12, name:'Soft-Close Toilet Seat',            category:'toilet-seats', price:9.800,  img:'Rawaj Products/SKU-0012.jpg', desc:'Slow soft-close mechanism prevents slamming. PP material, adjustable hinges, quick-release for cleaning.', badge:'Popular', stock:'in-stock' },
  { id:13, name:'Slim Soft-Close Toilet Seat',       category:'toilet-seats', price:11.500, img:'Rawaj Products/SKU-0013.jpg', desc:'Ultra-slim profile soft-close toilet seat. Scratch-resistant surface, top-fix installation, white gloss finish.', badge:null, stock:'in-stock' },
  { id:14, name:'D-Shape Soft-Close Seat',           category:'toilet-seats', price:10.200, img:'Rawaj Products/SKU-0014.jpg', desc:'D-shaped soft-close seat for modern back-to-wall and wall-hung toilets. Chrome hinges, white PP.', badge:null, stock:'in-stock' },
  { id:15, name:'Kids Toilet Training Seat',         category:'toilet-seats', price:3.200,  img:'Rawaj Products/SKU-0015.jpg', desc:'Soft padded training seat insert for young children. Non-slip base, fits standard round and oval bowls.', badge:null, stock:'in-stock' },
  { id:16, name:'Quick-Release Toilet Seat',         category:'toilet-seats', price:8.500,  img:'Rawaj Products/SKU-0016.jpg', desc:'One-click quick-release hinges allow full removal for deep cleaning. Includes soft-close mechanism.', badge:null, stock:'in-stock' },
  { id:17, name:'Elongated Toilet Seat White',       category:'toilet-seats', price:6.800,  img:'Rawaj Products/SKU-0017.jpg', desc:'Elongated oval toilet seat with standard close hinges. White heavy-duty PP, durable chrome fixings.', badge:null, stock:'in-stock' },
  { id:18, name:'Antibacterial Soft-Close Seat',     category:'toilet-seats', price:14.500, img:'Rawaj Products/SKU-0018.jpg', desc:'Antibacterial treated toilet seat with soft-close and quick-release hinges. Inhibits bacterial growth.', badge:null, stock:'low-stock' },
  // ── LIGHTING (19-28) ──────────────────────────────────────────────────────
  { id:19, name:'LED Bulb E27 9W Warm White',        category:'lighting',     price:0.600,  img:'Rawaj Products/SKU-0019.jpg', desc:'9W E27 LED bulb, 810 lumens, 3000K warm white. Replaces 60W incandescent. 15,000-hour lifespan.', badge:'Best Seller', stock:'in-stock' },
  { id:20, name:'LED Bulb E27 12W Daylight',         category:'lighting',     price:0.750,  img:'Rawaj Products/SKU-0020.jpg', desc:'12W E27 LED bulb, 1080 lumens, 6500K daylight. Instant full brightness, 80% energy saving.', badge:null, stock:'in-stock' },
  { id:21, name:'LED Bulb E14 6W Warm White',        category:'lighting',     price:0.550,  img:'Rawaj Products/SKU-0021.jpg', desc:'6W E14 small Edison screw LED. 550 lumens, 3000K warm white. For chandeliers and decorative lamps.', badge:null, stock:'in-stock' },
  { id:22, name:'LED Spotlight GU10 7W',             category:'lighting',     price:0.900,  img:'Rawaj Products/SKU-0022.jpg', desc:'7W GU10 LED spotlight, 630 lumens, 4000K neutral white. 38-degree beam, ideal for kitchens and bathrooms.', badge:null, stock:'in-stock' },
  { id:23, name:'LED Recessed Downlight 12W',        category:'lighting',     price:2.500,  img:'Rawaj Products/SKU-0023.jpg', desc:'12W recessed LED downlight, 90mm cut-out, 3000K warm white. Ultra-slim design, tool-free spring clips.', badge:null, stock:'in-stock' },
  { id:24, name:'LED Strip Light 5m 12V',            category:'lighting',     price:3.800,  img:'Rawaj Products/SKU-0024.jpg', desc:'5-metre 12V LED strip, 300 LEDs, warm white, self-adhesive backing. Cuttable every 50mm.', badge:'Popular', stock:'in-stock' },
  { id:25, name:'LED Panel Light 18W 30x30cm',       category:'lighting',     price:4.500,  img:'Rawaj Products/SKU-0025.jpg', desc:'18W 300x300mm slim LED panel, 1600 lumens, 6500K daylight. For false ceilings and offices.', badge:null, stock:'in-stock' },
  { id:26, name:'LED Tube Light 18W 120cm',          category:'lighting',     price:2.200,  img:'Rawaj Products/SKU-0026.jpg', desc:'18W T8 LED tube 120cm, 1800 lumens, 6500K. Direct wire replacement, no ballast required.', badge:null, stock:'in-stock' },
  { id:27, name:'Smart RGB LED Bulb E27 10W',        category:'lighting',     price:3.200,  img:UL(27), desc:'WiFi smart LED bulb with 16 million colours and warm white. Works with Alexa and Google Home.', badge:null, stock:'in-stock' },
  { id:28, name:'LED Outdoor Bulb IP65 12W',         category:'lighting',     price:1.500,  img:UL(28), desc:'IP65 waterproof 12W E27 LED bulb. For garden, porch and exterior fittings. Dust and rain proof.', badge:null, stock:'in-stock' },
  // ── TAPS & MIXERS (29-38) ─────────────────────────────────────────────────
  { id:29, name:'Basin Mixer Tap Chrome',            category:'taps',         price:9.800,  img:'Rawaj Products/SKU-0029.jpg', desc:'Single lever basin mixer, chrome finish, solid brass body. 35mm ceramic cartridge, 1/2" hot and cold inlets.', badge:'Best Seller', stock:'in-stock' },
  { id:30, name:'Kitchen Sink Mixer Tap',            category:'taps',         price:11.500, img:UL(30), desc:'Single lever kitchen mixer with 360° swivel spout. Chrome brass, ceramic disc, easy install flexible tails.', badge:null, stock:'in-stock' },
  { id:31, name:'Pull-Out Kitchen Spray Tap',        category:'taps',         price:18.500, img:UL(31), desc:'Pull-out spray head kitchen mixer tap. 2-function spray and stream modes. Braided hose, chrome finish.', badge:null, stock:'in-stock' },
  { id:32, name:'Bath & Shower Mixer Valve',         category:'taps',         price:16.000, img:UL(32), desc:'Exposed bath and shower mixer valve with diverter. Chrome solid brass, 1/2" inlets, anti-scald ceramic.', badge:null, stock:'in-stock' },
  { id:33, name:'Pillar Tap Pair Hot & Cold',        category:'taps',         price:5.500,  img:UL(33), desc:'Pair of chrome pillar taps hot and cold. Quarter-turn ceramic disc, 1/2" BSP. For baths and basins.', badge:null, stock:'in-stock' },
  { id:34, name:'Wall-Mount Basin Mixer Tap',        category:'taps',         price:14.000, img:UL(34), desc:'Wall-mounted basin mixer tap, 150mm centre distance. Chrome long spout, ceramic cartridge, flexible tails.', badge:null, stock:'in-stock' },
  { id:35, name:'Thermostatic Shower Bar Set',       category:'taps',         price:28.000, img:UL(35), desc:'Exposed thermostatic shower bar with overhead rain head and handheld shower. Chrome brass, anti-scald.', badge:null, stock:'low-stock' },
  { id:36, name:'Tap Aerator M22 Flow Saver',        category:'taps',         price:0.400,  img:UL(36), desc:'M22 chrome tap aerator with water-saving flow restrictor. Reduces tap flow to 5 litres per minute.', badge:null, stock:'in-stock' },
  { id:37, name:'Quarter-Turn Stop Cock 1/2"',       category:'taps',         price:1.200,  img:UL(37), desc:'Brass quarter-turn full-bore stop cock 1/2" BSP. For water supply isolation under basins and WCs.', badge:null, stock:'in-stock' },
  { id:38, name:'Tall Single Lever Basin Mixer',     category:'taps',         price:13.500, img:UL(38), desc:'Tall single lever basin mixer for countertop vessel basins. Chrome, 450mm height, ceramic cartridge.', badge:null, stock:'in-stock' },
  // ── PLUMBING (39-48) ──────────────────────────────────────────────────────
  { id:39, name:'PVC Pressure Pipe 1/2" x 3m',      category:'plumbing',     price:1.200,  img:UL(39), desc:'White PVC pressure pipe 1/2" (15mm) x 3 metres. For cold water supply lines and irrigation systems.', badge:null, stock:'in-stock' },
  { id:40, name:'CPVC Hot Water Pipe 3/4" x 3m',    category:'plumbing',     price:2.200,  img:UL(40), desc:'CPVC pipe 3/4" x 3m rated to 93°C. For hot and cold water supply. Solvent weld fittings.', badge:null, stock:'in-stock' },
  { id:41, name:'Braided Flexible Hose 40cm',        category:'plumbing',     price:0.800,  img:'Rawaj Products/SKU-0041.jpg', desc:'40cm stainless steel braided connector 3/8" x 1/2". Anti-burst, for basin and toilet supply.', badge:'Best Seller', stock:'in-stock' },
  { id:42, name:'Braided Flexible Hose 60cm',        category:'plumbing',     price:1.000,  img:UL(42), desc:'60cm braided flexible connector 3/8" x 1/2". Anti-burst stainless braid with EPDM inner tube.', badge:null, stock:'in-stock' },
  { id:43, name:'PTFE Teflon Tape 12m',              category:'plumbing',     price:0.200,  img:UL(43), desc:'12m PTFE thread seal tape, 12mm wide, white. Essential for sealing all threaded pipe joints.', badge:null, stock:'in-stock' },
  { id:44, name:'PVC Elbow 90° 1/2" — 10 Pack',     category:'plumbing',     price:0.500,  img:UL(44), desc:'Pack of 10 PVC 90° elbows 1/2". Solvent weld for cold water pipework. Pressure rated.', badge:null, stock:'in-stock' },
  { id:45, name:'Brass Ball Valve 1/2"',             category:'plumbing',     price:1.500,  img:UL(45), desc:'Full-bore brass ball valve 1/2" with lever handle. Chrome plated, rated for water and gas lines.', badge:null, stock:'in-stock' },
  { id:46, name:'P-Trap Waste Bend 32mm',            category:'plumbing',     price:1.200,  img:UL(46), desc:'32mm white P-trap with adjustable telescopic pipe. For hand basins and vanity units. Easy-fit push seal.', badge:null, stock:'in-stock' },
  { id:47, name:'Sanitary Silicone Sealant 280ml',   category:'plumbing',     price:1.200,  img:UL(47), desc:'Mould-resistant white sanitary silicone 280ml. For sealing baths, basins, shower trays and tiles.', badge:null, stock:'in-stock' },
  { id:48, name:'Drain Auger Cleaning Snake 5m',     category:'plumbing',     price:3.500,  img:UL(48), desc:'5m flexible drain auger with T-handle. Clears blocked sinks, basins, showers and floor drains.', badge:null, stock:'in-stock' },
  // ── BATHROOM ACCESSORIES (49-56) ──────────────────────────────────────────
  { id:49, name:'Round Towel Ring Chrome',           category:'bathroom',     price:3.200,  img:UL(49), desc:'Round wall-mounted chrome towel ring. Solid brass construction with concealed fixings. Easy to install.', badge:null, stock:'in-stock' },
  { id:50, name:'Toilet Roll Holder Chrome',         category:'bathroom',     price:2.800,  img:'Rawaj Products/SKU-0050.jpg', desc:'Wall-mount chrome toilet roll holder. Solid brass with spring-loaded paper bar. Concealed screw fixing.', badge:'Popular', stock:'in-stock' },
  { id:51, name:'Double Towel Bar 60cm Chrome',      category:'bathroom',     price:5.500,  img:UL(51), desc:'600mm double towel rail bar in chrome. Solid brass body, wall-mounted with concealed screws.', badge:null, stock:'in-stock' },
  { id:52, name:'Wall-Mount Soap Dispenser',         category:'bathroom',     price:4.200,  img:UL(52), desc:'300ml wall-mounted soap dispenser with chrome pump and ceramic body. Refillable, drip-free nozzle.', badge:null, stock:'in-stock' },
  { id:53, name:'Frameless Bathroom Mirror 60x80',   category:'bathroom',     price:12.000, img:UL(53), desc:'60x80cm frameless bevelled edge bathroom mirror. Wall-mounted, suitable horizontal or vertical.', badge:null, stock:'in-stock' },
  { id:54, name:'Shower Curtain + 12 Rings 180x200', category:'bathroom',     price:4.500,  img:UL(54), desc:'180x200cm waterproof polyester shower curtain with 12 chrome rings. Machine washable.', badge:null, stock:'in-stock' },
  { id:55, name:'Chrome Corner Shower Shelf',        category:'bathroom',     price:6.800,  img:UL(55), desc:'Stainless steel corner shower caddy shelf, chrome finish. No-drill adhesive fixing, rust-proof.', badge:null, stock:'in-stock' },
  { id:56, name:'Double Robe Hook Chrome',           category:'bathroom',     price:2.200,  img:UL(56), desc:'Double chrome robe and towel hook. Wall-mounted solid brass with concealed fixing plate.', badge:null, stock:'in-stock' },
  // ── SANITARYWARE (57-60) ──────────────────────────────────────────────────
  { id:57, name:'Wall-Hung Basin 50cm White',        category:'sanitaryware', price:35.000, img:UL(57), desc:'50cm wall-hung vitreous china wash basin, white. Includes fixing bolts. Single tap hole with overflow.', badge:null, stock:'in-stock' },
  { id:58, name:'Pedestal Basin 55cm White',         category:'sanitaryware', price:28.000, img:UL(58), desc:'55cm pedestal wash basin, white vitreous china. Full pedestal included, single tap hole, overflow.', badge:null, stock:'in-stock' },
  { id:59, name:'Close-Coupled Toilet Suite',        category:'sanitaryware', price:65.000, img:'Rawaj Products/SKU-0059.jpg', desc:'Complete close-coupled toilet with soft-close seat, dual flush 4/6L cistern. White vitreous china.', badge:'Popular', stock:'in-stock' },
  { id:60, name:'Concealed Cistern Frame',           category:'sanitaryware', price:45.000, img:UL(60), desc:'Steel in-wall concealed cistern frame for wall-hung toilets. Height-adjustable 820–1000mm, dual flush.', badge:null, stock:'low-stock' }
];

// ── ARABIC PRODUCT TRANSLATIONS ───────────────────────────────────────────
var _AR_PRODUCTS = {
  1:  { name:'شتافة ستانلس ستيل',                  desc:'رأس شطاف من الستانلس ستيل الثقيل مع صمام معدني. مقاوم للتآكل، سهل التركيب بجانب أي مرحاض.' },
  2:  { name:'طقم شتافة جداري كامل',               desc:'طقم شطاف كامل للتركيب على الجدار يشمل الحامل وخرطوم 1.2م وصمام T. تشطيب كروم، جميع الوصلات مرفقة.' },
  3:  { name:'شتافة ثنائية الضغط',                 desc:'رأس شطاف بوضعيتين للضغط: ناعم وقوي. رأس نحاسي مضاد للتسرب، مقبض مريح للإمساك.' },
  4:  { name:'شتافة توصيل للمرحاض',                desc:'شطاف سهل التركيب يناسب معظم المراحيض القياسية. ماء بارد، بدون كهرباء، يُركّب في دقائق.' },
  5:  { name:'خرطوم شتافة مضفر 1.2م',              desc:'خرطوم مرن مضفر من الستانلس ستيل 1.2 متر. وصلات 1/2 بوصة، أنبوب داخلي مضاد للانفجار.' },
  6:  { name:'صمام زاوية مع وصلة T',               desc:'صمام إيقاف زاوية كروم مع وصلة T لتركيب الشتافة. ربع دوران، 1/2 بوصة BSP.' },
  7:  { name:'شتافة نيكل مصقول فاخرة',             desc:'رأس شطاف نيكل مصقول فاخر. هيكل نحاسي ثقيل، صمام سيراميك خالٍ من التقطير، تشطيب راقٍ.' },
  8:  { name:'حامل شتافة كروم',                    desc:'حامل شطاف قابل للتعديل بتشطيب كروم. يُثبّت على الجدار أو خزان المرحاض بسهولة.' },
  9:  { name:'طقم شتافة ساخن وبارد',               desc:'طقم شطاف ماء ساخن وبارد مع صمام خلاط حراري. يوفر غسيلاً بالماء الدافئ للراحة.' },
  10: { name:'صمام عدم رجوع 1/2 بوصة',             desc:'صمام عدم رجوع نحاسي 1/2 بوصة لخطوط الشتافة والشطاف. يمنع تدفق الماء للخلف.' },
  11: { name:'غطاء مرحاض قياسي أبيض',              desc:'غطاء مرحاض بولي بروبيلين مع مفصلات كروم. تركيب عالمي لمعظم أوعية المراحيض، سهل التنظيف.' },
  12: { name:'غطاء مرحاض إغلاق بطيء',              desc:'آلية إغلاق بطيء تمنع الطرق المزعج. مادة PP، مفصلات قابلة للضبط، سريع الفك للتنظيف.' },
  13: { name:'غطاء مرحاض سليم إغلاق بطيء',         desc:'غطاء مرحاض نحيف بإغلاق بطيء. سطح مقاوم للخدش، تركيب علوي، تشطيب أبيض لامع.' },
  14: { name:'غطاء مرحاض D-شيب إغلاق بطيء',        desc:'غطاء D-شيب للمراحيض العصرية المعلقة والمدمجة في الجدار. مفصلات كروم، PP أبيض.' },
  15: { name:'مقعد تدريب أطفال',                   desc:'مقعد تدريب مبطن ناعم للأطفال الصغار. قاعدة مانعة للانزلاق، يناسب الأوعية المستديرة والبيضاوية.' },
  16: { name:'غطاء مرحاض سريع الفك',               desc:'مفصلات سريعة الفك بنقرة واحدة للتنظيف العميق الكامل. يشمل آلية الإغلاق البطيء.' },
  17: { name:'غطاء مرحاض بيضاوي ممتد أبيض',        desc:'غطاء مرحاض بيضاوي ممتد مع مفصلات قياسية. PP أبيض ثقيل الوزن، تثبيت كروم متين.' },
  18: { name:'غطاء مرحاض مضاد للبكتيريا',          desc:'غطاء مرحاض بمعالجة مضادة للبكتيريا مع إغلاق بطيء وفك سريع. صحي ومتين.' },
  19: { name:'لمبة LED E27 9 واط أبيض دافئ',        desc:'لمبة LED 9 واط E27، 810 لومن، 3000K أبيض دافئ. تعوض 60 واط تقليدي. عمر 15,000 ساعة.' },
  20: { name:'لمبة LED E27 12 واط ضوء نهاري',       desc:'لمبة LED 12 واط E27، 1080 لومن، 6500K ضوء نهاري. إضاءة فورية كاملة، توفير 80% للطاقة.' },
  21: { name:'لمبة LED E14 6 واط أبيض دافئ',        desc:'لمبة LED صغيرة 6 واط E14. 550 لومن، 3000K. للنجف والمصابيح الزخرفية.' },
  22: { name:'سبوت LED GU10 7 واط',                 desc:'سبوت LED 7 واط GU10، 630 لومن، 4000K أبيض محايد. زاوية 38 درجة، مثالي للمطبخ والحمام.' },
  23: { name:'داونلايت LED مدمج 12 واط',            desc:'داونلايت LED مدمج 12 واط، قطر القطع 90 ملم، 3000K. تصميم نحيف، سهل التركيب.' },
  24: { name:'شريط LED 5 متر 12 فولت',              desc:'شريط LED 5 متر 12 فولت، 300 لمبة، أبيض دافئ، لاصق ذاتي. قابل للقطع كل 50 ملم.' },
  25: { name:'لوحة LED 18 واط 30×30 سم',            desc:'لوحة LED نحيفة 18 واط 300×300 ملم، 1600 لومن، 6500K. للأسقف المعلقة والمكاتب.' },
  26: { name:'أنبوب LED 18 واط 120 سم',             desc:'أنبوب LED T8 18 واط 120 سم، 1800 لومن، 6500K. توصيل مباشر بدون بالاست.' },
  27: { name:'لمبة LED ذكية RGB 10 واط',            desc:'لمبة LED ذكية واي فاي، 16 مليون لون + أبيض دافئ. تعمل مع أليكسا وجوجل هوم.' },
  28: { name:'لمبة LED خارجية IP65 12 واط',         desc:'لمبة LED مقاومة للماء IP65 12 واط E27. للحديقة والمدخل والإضاءة الخارجية.' },
  29: { name:'خلاط حوض كروم',                      desc:'خلاط حوض أحادي الذراع، تشطيب كروم، هيكل نحاسي. خرطوشة سيراميك 35 ملم، مداخل 1/2 بوصة.' },
  30: { name:'خلاط مطبخ كروم',                     desc:'خلاط مطبخ أحادي الذراع مع فوهة دوارة 360 درجة. نحاس كروم، قرص سيراميك.' },
  31: { name:'خلاط مطبخ رأس سحب',                  desc:'خلاط مطبخ برأس رش قابل للسحب. وضعيتان رش وتيار. خرطوم مضفر، تشطيب كروم.' },
  32: { name:'صمام خلاط حمام ودش',                  desc:'صمام خلاط حمام ودش بارز مع محول. نحاس كروم، مداخل 1/2 بوصة، سيراميك مضاد للحرق.' },
  33: { name:'طقم صنابير ساخن وبارد',               desc:'طقم صنابير ساخن وبارد، تشطيب كروم. قرص سيراميك ربع دوران، 1/2 بوصة BSP.' },
  34: { name:'خلاط حوض جداري',                     desc:'خلاط حوض للتركيب على الجدار بمسافة 150 ملم. فوهة كروم طويلة، خرطوشة سيراميك.' },
  35: { name:'طقم شاور ثيرموستاتي',                 desc:'شاور ثيرموستاتي بارز مع رأس مطر علوي وشاور يدوي. نحاس كروم، مضاد للحرق.' },
  36: { name:'مصفاة صنبور M22 موفرة للمياه',        desc:'مصفاة صنبور M22 كروم مع موفر تدفق. تقلل التدفق إلى 5 لترات في الدقيقة.' },
  37: { name:'صمام إيقاف ربع دوران 1/2 بوصة',      desc:'صمام إيقاف نحاسي ربع دوران 1/2 بوصة BSP. لعزل إمدادات المياه تحت الأحواض والمراحيض.' },
  38: { name:'خلاط حوض طويل أحادي الذراع',          desc:'خلاط حوض طويل للأحواض المدمجة العلوية. كروم، ارتفاع 450 ملم، خرطوشة سيراميك.' },
  39: { name:'ماسورة PVC 1/2 بوصة × 3م',           desc:'ماسورة PVC ضغط بيضاء 1/2 بوصة × 3 متر. لخطوط إمداد المياه الباردة والري.' },
  40: { name:'ماسورة CPVC ماء ساخن 3/4 × 3م',      desc:'ماسورة CPVC 3/4 بوصة × 3م مقيّمة لـ93 درجة. للماء الساخن والبارد، وصلات بالمذيب.' },
  41: { name:'خرطوم مرن مضفر 40 سم',               desc:'موصل مرن ستانلس ستيل 40 سم. وصلات 3/8 × 1/2 بوصة. مضاد للانفجار، للأحواض والمراحيض.' },
  42: { name:'خرطوم مرن مضفر 60 سم',               desc:'موصل مرن مضفر 60 سم 3/8 × 1/2 بوصة. ضفيرة ستانلس مع أنبوب EPDM داخلي.' },
  43: { name:'شريط تيفلون PTFE 12 متر',            desc:'شريط PTFE لختم وصلات المواسير 12 متر. عرض 12 ملم، أبيض، ضروري لجميع الوصلات.' },
  44: { name:'كوع PVC 90° 1/2 — 10 قطع',           desc:'عشر كواع PVC 90° × 1/2 بوصة. لحام مذيب، مقاوم للضغط، لمواسير الماء الباردة.' },
  45: { name:'صمام كروي نحاسي 1/2 بوصة',           desc:'صمام كروي نحاسي كامل الفتحة 1/2 بوصة مع مقبض رافعة. مطلي بالكروم، للماء والغاز.' },
  46: { name:'سيفون P-تراب 32 ملم',                desc:'سيفون P-تراب أبيض 32 ملم بأنبوب تلسكوبي قابل للضبط. لأحواض الغسيل ووحدات التجميل.' },
  47: { name:'سيليكون صحي أبيض 280 مل',            desc:'سيليكون صحي أبيض 280 مل مقاوم للعفن. لختم الأحواض والمغاطس وأحواض الدش والبلاط.' },
  48: { name:'سلك تسليك بالوعة 5 متر',             desc:'سلك تسليك مرن 5 متر مع مقبض T. يفتح انسداد الأحواض والمغاسل والدش وصرف الأرضية.' },
  49: { name:'حلقة مناشف مستديرة كروم',             desc:'حلقة مناشف مستديرة للجدار بتشطيب كروم. بناء نحاسي صلب مع تثبيت مخفي.' },
  50: { name:'حامل ورق تواليت كروم',               desc:'حامل ورق تواليت للجدار بتشطيب كروم. نحاس صلب مع قضيب زنبركي. تثبيت مخفي.' },
  51: { name:'عارضة مناشف مزدوجة 60 سم كروم',      desc:'عارضة مناشف مزدوجة 600 ملم بتشطيب كروم. هيكل نحاسي صلب، تركيب على الجدار.' },
  52: { name:'موزع صابون للجدار',                  desc:'موزع صابون للجدار 300 مل بمضخة كروم وهيكل خزفي أبيض. قابل لإعادة الملء، بدون تقطير.' },
  53: { name:'مرآة حمام 60×80 سم بدون إطار',       desc:'مرآة حمام 60×80 سم بدون إطار مع حافة مشطوفة. تركيب أفقي أو رأسي على الجدار.' },
  54: { name:'ستارة حمام + 12 حلقة 180×200',       desc:'ستارة دش مقاومة للماء 180×200 سم مع 12 حلقة كروم. قابلة للغسيل في الغسالة.' },
  55: { name:'رف زاوية حمام كروم',                 desc:'رف زاوية ستانلس ستيل كروم للحمام. تثبيت لاصق بدون حفر، مضاد للصدأ.' },
  56: { name:'خطاف ملابس مزدوج كروم',              desc:'خطاف ملابس ومناشف مزدوج كروم للجدار. نحاس صلب مع لوحة تثبيت مخفية.' },
  57: { name:'حوض معلق 50 سم أبيض',               desc:'حوض سيراميك 50 سم للتعليق على الجدار، أبيض. مع مسامير تثبيت، فتحة صنبور واحدة مع فيضان.' },
  58: { name:'حوض بيدستال 55 سم أبيض',            desc:'حوض غسيل 55 سم مع بيدستال كامل، سيراميك أبيض. فتحة صنبور واحدة مع فيضان.' },
  59: { name:'طقم مرحاض كامل',                    desc:'مرحاض كامل مع غطاء إغلاق بطيء وخزان ثنائي الضغط 4/6 لتر. سيراميك أبيض فاخر.' },
  60: { name:'إطار خزان مرحاض مخفي',              desc:'إطار فولاذي لخزان مرحاض معلق مخفي. ارتفاع قابل للضبط 820-1000 ملم، ضغط مزدوج.' }
};

// Arabic category display names
var _AR_CATS = {
  'shataffa':    'شتافة',
  'toilet-seats':'أغطية مراحيض',
  'lighting':    'إضاءة',
  'taps':        'صنابير وخلاطات',
  'plumbing':    'سباكة',
  'bathroom':    'إكسسوارات الحمام',
  'sanitaryware':'أدوات صحية'
};

let cart = [];
let activeFilter = 'all';

// ── MULTI-CATEGORY HELPER (storefront) ────────────────────────────────────
// Returns array of extra category slugs assigned to a product via the admin
// multi-category picker (stored in rawaj_multi_cats in localStorage).
function getMultiCats(id) {
  try {
    var map = JSON.parse(localStorage.getItem('rawaj_multi_cats') || '{}');
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
  const v = JSON.parse(localStorage.getItem('rawaj_views') || '{}');
  v[id] = (v[id] || 0) + 1;
  localStorage.setItem('rawaj_views', JSON.stringify(v));
}
function trackSearch(ids) {
  if (!ids || !ids.length) return;
  const s = JSON.parse(localStorage.getItem('rawaj_searches') || '{}');
  ids.forEach(function(id) { s[id] = (s[id] || 0) + 1; });
  localStorage.setItem('rawaj_searches', JSON.stringify(s));
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
  const { error } = await sbFetch(SB_URL + '/rest/v1/rawaj_stock', {
    method: 'POST',
    headers: { ...SB_H, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(rows)
  });
  if (error) localStorage.setItem('rawaj_stock', JSON.stringify(_sbStock));
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
    '🔨 *Rawaj Order* 🔨',
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
    hero_tag:'<i class="fa fa-shower"></i> Kuwait\'s #1 Bathroom & Plumbing Store',
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
    about_badge:'EST. 2024 - KUWAIT',
    about_p1:'Rawaj is Kuwait\'s trusted destination for bathroom and plumbing supplies. Shataffa, toilet seats, LED lighting, taps, mixers and bathroom accessories — all under one roof.',
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
    mq_items:['Shataffa','Toilet Seats','LED Lighting','Taps & Mixers','Plumbing','Bathroom Accessories','Sanitaryware','Bidet Sprayers','LED Bulbs']
  },
  ar: {
    nav_home:'الرئيسية', nav_about:'من نحن', nav_products:'المنتجات', nav_categories:'الفئات', nav_contact:'اتصل بنا',
    cart_label:' سلة',
    hero_tag:'<i class="fa fa-shower"></i> المتجر الأول للحمامات والسباكة في الكويت',
    hero_h1:'حمامات <span>راقية.</span><br/>صُنعت لـ<span>الكويت.</span>',
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
    about_badge:'تأسس 2024 - الكويت',
    about_p1:'رواج هي وجهتك الموثوقة في الكويت لمستلزمات الحمام والسباكة. شتافة، أغطية مراحيض، إضاءة LED، صنابير وخلاطات وإكسسوارات الحمام — كل شيء تحت سقف واحد.',
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
    mq_items:['شتافة','أغطية مراحيض','إضاءة LED','صنابير وخلاطات','سباكة','إكسسوارات الحمام','أدوات صحية','رشاشات بيديه','لمبات LED']
  }
};

function setLang(lang) {
  _lang = lang;
  localStorage.setItem('rawaj_lang', lang);
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
  var saved = localStorage.getItem('rawaj_lang');
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
  console.log('[Rawaj] Saving order:', payload);
  const result = await sbFetch(SB_URL + '/rest/v1/rawaj_orders', {
    method: 'POST',
    headers: Object.assign({}, SB_H, {
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }),
    body: JSON.stringify(payload)
  });
  if (result.error) {
    console.error('[Rawaj] Order save FAILED:', result.error);
    alert('⚠️ Order save failed: ' + result.error + '\n\nYour WhatsApp message was still sent.');
  } else {
    console.log('[Rawaj] Order saved OK:', result.data);
  }
}
