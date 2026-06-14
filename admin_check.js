const ADMIN_USER = 'rawaj';
const ADMIN_PASS = 'admin1234';

// â”€â”€ SUPABASE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SB_URL  = 'https://sinzmodmefkyjkzzitjy.supabase.co';
const SB_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpbnptb2RtZWZreWprenppdGp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMjQ4MzYsImV4cCI6MjA5NTcwMDgzNn0.Ft88pQEKbSVP_yb7UTRVq2fLa_TScR97_jvJmgAMlSc';
const SB_HDRS = { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };

const DEFAULT_CATS = [
  { slug:'shataffa',     label:'Shataffa' },
  { slug:'toilet-seats', label:'Toilet Seats' },
  { slug:'lighting',     label:'Lighting' },
  { slug:'taps',         label:'Taps & Mixers' },
  { slug:'plumbing',     label:'Plumbing' },
  { slug:'bathroom',     label:'Bathroom' },
  { slug:'sanitaryware', label:'Sanitaryware' }
];

// â”€â”€ SUPABASE FETCH WRAPPER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function encodeHtml(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
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

const U  = id => 'https://picsum.photos/seed/' + id + '/80/80';
const UL = id => 'product-images/' + id + '.jpg';

let _customProductRows = []; // populated from Supabase rawaj_products table
let _hiddenBaseIds     = new Set();

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
    await sbFetch(SB_URL + '/rest/v1/rawaj_products?id=eq.' + p.id, { method:'DELETE', headers:SB_HDRS });
    // Also clean up orphaned stock/photos for old ID
    await sbFetch(SB_URL + '/rest/v1/rawaj_stock?product_id=eq.' + p.id, { method:'DELETE', headers:SB_HDRS });

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
    var result = await sbFetch(SB_URL + '/rest/v1/rawaj_products', {
      method: 'POST',
      headers: Object.assign({}, SB_HDRS, {'Prefer':'return=representation'}),
      body: JSON.stringify([payload])
    });
    if (result.data && result.data[0]) {
      _customProductRows.push(result.data[0]);
      // Migrate stock to new ID
      var oldQty = stockData[p.id] || 50;
      stockData[result.data[0].id] = oldQty;
      await sbFetch(SB_URL + '/rest/v1/rawaj_stock', {
        method: 'POST',
        headers: Object.assign({}, SB_HDRS, {'Prefer':'resolution=merge-duplicates'}),
        body: JSON.stringify([{ product_id: result.data[0].id, qty: oldQty }])
      });
      // Migrate photo to new ID
      var oldPhoto = null;
      try { var ph = JSON.parse(localStorage.getItem('rawaj_photos')||'{}'); oldPhoto = ph[String(p.id)]||null; } catch(_){}
      if (oldPhoto) {
        sbFetch(SB_URL + '/rest/v1/rawaj_photos', {
          method:'POST', headers:Object.assign({},SB_HDRS,{'Prefer':'resolution=merge-duplicates'}),
          body:JSON.stringify([{product_id:result.data[0].id, url:oldPhoto}])
        });
        // Update localStorage photo key
        try {
          var ph2 = JSON.parse(localStorage.getItem('rawaj_photos')||'{}');
          ph2[String(result.data[0].id)] = oldPhoto;
          delete ph2[String(p.id)];
          localStorage.setItem('rawaj_photos', JSON.stringify(ph2));
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
  const [s, p, c, h] = await Promise.all([
    sbFetch(SB_URL + '/rest/v1/rawaj_stock?select=*',          { headers: SB_HDRS }),
    sbFetch(SB_URL + '/rest/v1/rawaj_photos?select=*',         { headers: SB_HDRS }),
    sbFetch(SB_URL + '/rest/v1/rawaj_products?select=*',       { headers: SB_HDRS }),
    sbFetch(SB_URL + '/rest/v1/rawaj_hidden?select=product_id',{ headers: SB_HDRS })
  ]);

  // Stock
  if (s.error) {
    console.warn('Stock load failed:', s.error);
    showToast('Offline — using local data');
  } else if (Array.isArray(s.data)) {
    s.data.forEach(function(r) { stockData[r.product_id] = r.qty; });
    localStorage.setItem('rawaj_stock', JSON.stringify(stockData));
  }

  // Photos
  if (p.error) {
    console.warn('Photos load failed:', p.error);
  } else if (Array.isArray(p.data)) {
    const ph = JSON.parse(localStorage.getItem('rawaj_photos') || '{}');
    p.data.forEach(function(r) { ph[r.product_id] = r.url; });
    localStorage.setItem('rawaj_photos', JSON.stringify(ph));
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

// Merged list of all products (base + custom)
function getAllAdminProducts() {
  var deletedIds = new Set(getDeletedProducts().map(function(d){return d.id;}));
  var baseIds    = new Set(PRODUCTS.map(function(p){return p.id;}));  // IDs 1-60 are authoritative
  const base = PRODUCTS
    .filter(function(p){ return !deletedIds.has(p.id); })
    .map(function(p) {
      return { id:p.id, name:p.name, cat:p.cat, price:p.price, img:p.img, isBase:true, hidden:_hiddenBaseIds.has(p.id) };
    });
  const custom = _customProductRows
    .filter(function(p){ return !deletedIds.has(p.id) && !baseIds.has(p.id); }) // skip Supabase dupes of base IDs
    .map(function(p) {
      return { id:p.id, name:p.name, cat:p.category, price:parseFloat(p.price), img:p.img_url||'', isBase:false, hidden:p.hidden||false };
    });
  return [...base, ...custom].sort(function(a,b){return a.id-b.id;});
}

const PRODUCTS = [
  // SHATAFFA
  {id:1,  name:'Stainless Steel Shataffa Sprayer',   cat:'shataffa',     price:3.500,  img:UL(1)},
  {id:2,  name:'Wall-Mount Shataffa Set',            cat:'shataffa',     price:5.200,  img:UL(2)},
  {id:3,  name:'Dual-Mode Bidet Sprayer',            cat:'shataffa',     price:7.800,  img:UL(3)},
  {id:4,  name:'Clip-On Bidet Toilet Attachment',   cat:'shataffa',     price:4.500,  img:UL(4)},
  {id:5,  name:'Braided Shataffa Hose 1.2m',        cat:'shataffa',     price:1.200,  img:UL(5)},
  {id:6,  name:'Angle Valve with T-Connector',      cat:'shataffa',     price:1.800,  img:UL(6)},
  {id:7,  name:'Brushed Nickel Bidet Sprayer',      cat:'shataffa',     price:8.500,  img:UL(7)},
  {id:8,  name:'Shataffa Holder Hook Chrome',       cat:'shataffa',     price:0.800,  img:UL(8)},
  {id:9,  name:'Hot & Cold Bidet Mixer Set',        cat:'shataffa',     price:12.000, img:UL(9)},
  {id:10, name:'Non-Return Check Valve 1/2"',       cat:'shataffa',     price:0.600,  img:UL(10)},
  // TOILET SEATS
  {id:11, name:'Standard White Toilet Seat',        cat:'toilet-seats', price:4.500,  img:UL(11)},
  {id:12, name:'Soft-Close Toilet Seat',            cat:'toilet-seats', price:9.800,  img:UL(12)},
  {id:13, name:'Slim Soft-Close Toilet Seat',       cat:'toilet-seats', price:11.500, img:UL(13)},
  {id:14, name:'D-Shape Soft-Close Seat',           cat:'toilet-seats', price:10.200, img:UL(14)},
  {id:15, name:'Kids Toilet Training Seat',         cat:'toilet-seats', price:3.200,  img:UL(15)},
  {id:16, name:'Quick-Release Toilet Seat',         cat:'toilet-seats', price:8.500,  img:UL(16)},
  {id:17, name:'Elongated Toilet Seat White',       cat:'toilet-seats', price:6.800,  img:UL(17)},
  {id:18, name:'Antibacterial Soft-Close Seat',     cat:'toilet-seats', price:14.500, img:UL(18)},
  // LIGHTING
  {id:19, name:'LED Bulb E27 9W Warm White',        cat:'lighting',     price:0.600,  img:UL(19)},
  {id:20, name:'LED Bulb E27 12W Daylight',         cat:'lighting',     price:0.750,  img:UL(20)},
  {id:21, name:'LED Bulb E14 6W Warm White',        cat:'lighting',     price:0.550,  img:UL(21)},
  {id:22, name:'LED Spotlight GU10 7W',             cat:'lighting',     price:0.900,  img:UL(22)},
  {id:23, name:'LED Recessed Downlight 12W',        cat:'lighting',     price:2.500,  img:UL(23)},
  {id:24, name:'LED Strip Light 5m 12V',            cat:'lighting',     price:3.800,  img:UL(24)},
  {id:25, name:'LED Panel Light 18W 30x30cm',       cat:'lighting',     price:4.500,  img:UL(25)},
  {id:26, name:'LED Tube Light 18W 120cm',          cat:'lighting',     price:2.200,  img:UL(26)},
  {id:27, name:'Smart RGB LED Bulb E27 10W',        cat:'lighting',     price:3.200,  img:UL(27)},
  {id:28, name:'LED Outdoor Bulb IP65 12W',         cat:'lighting',     price:1.500,  img:UL(28)},
  // TAPS & MIXERS
  {id:29, name:'Basin Mixer Tap Chrome',            cat:'taps',         price:9.800,  img:UL(29)},
  {id:30, name:'Kitchen Sink Mixer Tap',            cat:'taps',         price:11.500, img:UL(30)},
  {id:31, name:'Pull-Out Kitchen Spray Tap',        cat:'taps',         price:18.500, img:UL(31)},
  {id:32, name:'Bath & Shower Mixer Valve',         cat:'taps',         price:16.000, img:UL(32)},
  {id:33, name:'Pillar Tap Pair Hot & Cold',        cat:'taps',         price:5.500,  img:UL(33)},
  {id:34, name:'Wall-Mount Basin Mixer Tap',        cat:'taps',         price:14.000, img:UL(34)},
  {id:35, name:'Thermostatic Shower Bar Set',       cat:'taps',         price:28.000, img:UL(35)},
  {id:36, name:'Tap Aerator M22 Flow Saver',        cat:'taps',         price:0.400,  img:UL(36)},
  {id:37, name:'Quarter-Turn Stop Cock 1/2"',       cat:'taps',         price:1.200,  img:UL(37)},
  {id:38, name:'Tall Single Lever Basin Mixer',     cat:'taps',         price:13.500, img:UL(38)},
  // PLUMBING
  {id:39, name:'PVC Pressure Pipe 1/2" x 3m',      cat:'plumbing',     price:1.200,  img:UL(39)},
  {id:40, name:'CPVC Hot Water Pipe 3/4" x 3m',    cat:'plumbing',     price:2.200,  img:UL(40)},
  {id:41, name:'Braided Flexible Hose 40cm',        cat:'plumbing',     price:0.800,  img:UL(41)},
  {id:42, name:'Braided Flexible Hose 60cm',        cat:'plumbing',     price:1.000,  img:UL(42)},
  {id:43, name:'PTFE Teflon Tape 12m',              cat:'plumbing',     price:0.200,  img:UL(43)},
  {id:44, name:'PVC Elbow 90° 1/2" — 10 Pack',     cat:'plumbing',     price:0.500,  img:UL(44)},
  {id:45, name:'Brass Ball Valve 1/2"',             cat:'plumbing',     price:1.500,  img:UL(45)},
  {id:46, name:'P-Trap Waste Bend 32mm',            cat:'plumbing',     price:1.200,  img:UL(46)},
  {id:47, name:'Sanitary Silicone Sealant 280ml',   cat:'plumbing',     price:1.200,  img:UL(47)},
  {id:48, name:'Drain Auger Cleaning Snake 5m',     cat:'plumbing',     price:3.500,  img:UL(48)},
  // BATHROOM ACCESSORIES
  {id:49, name:'Round Towel Ring Chrome',           cat:'bathroom',     price:3.200,  img:'Rawaj Products/SKU-0049.jpg'},
  {id:50, name:'Toilet Roll Holder Chrome',         cat:'bathroom',     price:2.800,  img:'Rawaj Products/SKU-0050.jpg'},
  {id:51, name:'Double Towel Bar 60cm Chrome',      cat:'bathroom',     price:5.500,  img:'Rawaj Products/SKU-0051.jpg'},
  {id:52, name:'Wall-Mount Soap Dispenser',         cat:'bathroom',     price:4.200,  img:'Rawaj Products/SKU-0052.jpg'},
  {id:53, name:'Frameless Bathroom Mirror 60x80',   cat:'bathroom',     price:12.000, img:'Rawaj Products/SKU-0053.jpg'},
  {id:54, name:'Shower Curtain + 12 Rings 180x200', cat:'bathroom',     price:4.500,  img:'Rawaj Products/SKU-0054.jpg'},
  {id:55, name:'Chrome Corner Shower Shelf',        cat:'bathroom',     price:6.800,  img:'Rawaj Products/SKU-0055.jpg'},
  {id:56, name:'Double Robe Hook Chrome',           cat:'bathroom',     price:2.200,  img:'Rawaj Products/SKU-0056.jpg'},
  // SANITARYWARE
  {id:57, name:'Wall-Hung Basin 50cm White',        cat:'sanitaryware', price:35.000, img:'Rawaj Products/SKU-0057.jpg'},
  {id:58, name:'Pedestal Basin 55cm White',         cat:'sanitaryware', price:28.000, img:'Rawaj Products/SKU-0058.jpg'},
  {id:59, name:'Close-Coupled Toilet Suite',        cat:'sanitaryware', price:65.000, img:'Rawaj Products/SKU-0059.jpg'},
  {id:60, name:'Concealed Cistern Frame',           cat:'sanitaryware', price:45.000, img:'Rawaj Products/SKU-0060.jpg'}
];

// â”€â”€ STOCK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getStock() {
  const s = localStorage.getItem('rawaj_stock');
  if (s) return JSON.parse(s);
  const d = {};
  PRODUCTS.forEach(p => { d[p.id] = p.price > 10 ? 15 : p.price > 5 ? 30 : 50; });
  return d;
}
let stockData = getStock();

let _prodOverrides = {};
try { _prodOverrides = JSON.parse(localStorage.getItem('rawaj_overrides') || '{}'); } catch(e) {}

// â”€â”€ UNDO / REDO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let _undoStack = [];
let _redoStack = [];
function _pushUndo() {
  _undoStack.push(JSON.stringify(stockData));
  if (_undoStack.length > 50) _undoStack.shift();
  _redoStack = [];
  _syncUrBtns();
}
function _syncUrBtns() {
  document.getElementById('undoBtn').disabled = _undoStack.length === 0;
  document.getElementById('redoBtn').disabled = _redoStack.length === 0;
}
function undo() {
  if (!_undoStack.length) return;
  _redoStack.push(JSON.stringify(stockData));
  stockData = JSON.parse(_undoStack.pop());
  localStorage.setItem('rawaj_stock', JSON.stringify(stockData));
  renderTable(); renderStats(); _syncUrBtns();
  showToast('Undone â†©');
}
function redo() {
  if (!_redoStack.length) return;
  _undoStack.push(JSON.stringify(stockData));
  stockData = JSON.parse(_redoStack.pop());
  localStorage.setItem('rawaj_stock', JSON.stringify(stockData));
  renderTable(); renderStats(); _syncUrBtns();
  showToast('Redone â†ª');
}
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey||e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
  if ((e.ctrlKey||e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
});

// â”€â”€ LOGIN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Populate forgot-password overlay with current credentials
var _fpu = document.getElementById('fpUser'); if (_fpu) _fpu.textContent = ADMIN_USER;
var _fpp = document.getElementById('fpPass'); if (_fpp) _fpp.textContent = ADMIN_PASS;

function doLogin(e) {
  if (e) e.preventDefault();
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  if (u === ADMIN_USER && p === ADMIN_PASS) {
    localStorage.setItem('rawaj_auth', '1');
    // Tell the browser to offer saving these credentials
    if (window.PasswordCredential) {
      const cred = new PasswordCredential({ id: u, password: p, name: 'Rawaj Admin' });
      navigator.credentials.store(cred);
    }
    showAdmin();
  } else {
    const err = document.getElementById('loginError');
    err.style.display = 'block';
    setTimeout(function() { err.style.display = 'none'; }, 3000);
  }
}
function showAdmin() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminPanel').style.display = 'block';
  loadFromSupabase();
  _loadSavedHandles();
  loadOrders(false);
}
function logout() {
  localStorage.removeItem('rawaj_auth');
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('adminPanel').style.display = 'none';
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
}
// Auto-login if session is still active (survives page refresh)
if (localStorage.getItem('rawaj_auth') === '1') { showAdmin(); }

// â”€â”€ CLOCK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function tick() {
  const n = new Date();
  document.getElementById('clockEl').textContent =
    n.toLocaleDateString('en-KW',{weekday:'short',day:'numeric',month:'short'}) + ' â€” ' +
    n.toLocaleTimeString('en-KW',{hour:'2-digit',minute:'2-digit'});
}
setInterval(tick, 1000); tick();

// â”€â”€ TABS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function switchTab(tab) {
  document.getElementById('inventorySection').style.display = tab==='inventory' ? 'block' : 'none';
  document.getElementById('analyticsSection').style.display = tab==='analytics' ? 'block' : 'none';
  document.getElementById('deletedSection').style.display   = tab==='deleted'   ? 'block' : 'none';
  document.getElementById('ordersSection').style.display    = tab==='orders'    ? 'block' : 'none';
  document.getElementById('reportsSection').style.display   = tab==='reports'   ? 'block' : 'none';
  document.getElementById('tabInventory').classList.toggle('active', tab==='inventory');
  document.getElementById('tabAnalytics').classList.toggle('active', tab==='analytics');
  document.getElementById('tabDeleted').classList.toggle('active',   tab==='deleted');
  document.getElementById('tabOrders').classList.toggle('active',    tab==='orders');
  document.getElementById('tabReports').classList.toggle('active',   tab==='reports');
  if (tab==='analytics') renderAnalytics();
  if (tab==='deleted')   renderDeletedTab();
  if (tab==='orders')  { loadOrders(false); }
  if (tab==='reports') { renderReports(); renderOrdersReport(); _autoWriteReports(); }
}

// ── REPORTS ───────────────────────────────────────────────────────────────────
function renderReports() {
  const all     = getAllAdminProducts();
  const views   = JSON.parse(localStorage.getItem('rawaj_views')   || '{}');
  const searches= JSON.parse(localStorage.getItem('rawaj_searches')|| '{}');
  const now     = new Date().toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});

  // ── INVENTORY ──────────────────────────────────────────────────────────────
  const totalUnits = all.reduce(function(s,p){ return s+(stockData[p.id]||0); },0);
  const totalValue = all.reduce(function(s,p){ return s+p.price*(stockData[p.id]||0); },0);
  const outCount   = all.filter(function(p){ return (stockData[p.id]||0)===0; }).length;
  const lowCount   = all.filter(function(p){ var q=stockData[p.id]||0; return q>0&&q<=10; }).length;

  document.getElementById('rptInvDate').textContent = 'Last updated: ' + now;
  document.getElementById('rptInvSummary').innerHTML =
    '<div class="rpt-sum-item"><span class="sv">'+all.length+'</span><span class="sl">Products</span></div>' +
    '<div class="rpt-sum-item"><span class="sv">'+totalUnits+'</span><span class="sl">Total Units</span></div>' +
    '<div class="rpt-sum-item"><span class="sv">'+totalValue.toFixed(3)+'</span><span class="sl">Total Value KWD</span></div>' +
    '<div class="rpt-sum-item"><span class="sv" style="color:var(--yellow)">'+lowCount+'</span><span class="sl">Low Stock</span></div>' +
    '<div class="rpt-sum-item"><span class="sv" style="color:var(--red)">'+outCount+'</span><span class="sl">Out of Stock</span></div>';

  var invRows = all.map(function(p){
    var qty=stockData[p.id]||0;
    var val=(p.price*qty).toFixed(3);
    var statusCls=qty===0?'out':qty<=10?'low':'in';
    var statusLbl=qty===0?'Out of Stock':qty<=10?'Low Stock':'In Stock';
    return '<tr>'+
      '<td style="color:#aaa;font-size:11px;font-weight:700">#'+p.id+'</td>'+
      '<td style="font-family:monospace;font-size:11px;color:var(--orange)">'+getProductSku(p.id)+'</td>'+
      '<td style="font-weight:700;color:var(--dark)">'+encodeHtml(p.name)+'</td>'+
      '<td><span class="cat-pill">'+p.cat+'</span></td>'+
      '<td style="font-weight:800">'+p.price.toFixed(3)+'</td>'+
      '<td style="font-weight:800;text-align:center">'+qty+'</td>'+
      '<td><span class="rpt-status '+statusCls+'">'+statusLbl+'</span></td>'+
      '<td style="font-weight:700">'+val+'</td>'+
    '</tr>';
  }).join('');
  document.getElementById('rptInvBody').innerHTML = invRows;
  document.getElementById('rptInvFoot').innerHTML =
    '<tr><td colspan="5" style="font-weight:800">TOTAL ('+all.length+' products)</td>'+
    '<td style="font-weight:800;text-align:center">'+totalUnits+' units</td><td></td>'+
    '<td style="font-weight:800">'+totalValue.toFixed(3)+' KWD</td></tr>';

  // ── SALES ──────────────────────────────────────────────────────────────────
  const salesData = all.map(function(p){
    return { p:p, cartAdds:views[p.id]||0, searchHits:searches[p.id]||0,
             estRev:((views[p.id]||0)*p.price) };
  }).sort(function(a,b){ return b.cartAdds - a.cartAdds; });

  const totalCartAdds  = salesData.reduce(function(s,r){ return s+r.cartAdds; },0);
  const totalSearches  = salesData.reduce(function(s,r){ return s+r.searchHits; },0);
  const totalEstRev    = salesData.reduce(function(s,r){ return s+r.estRev; },0);

  document.getElementById('rptSalesDate').textContent = 'Last updated: ' + now;
  document.getElementById('rptSalesSummary').innerHTML =
    '<div class="rpt-sum-item"><span class="sv">'+totalCartAdds+'</span><span class="sl">Total Cart Adds</span></div>' +
    '<div class="rpt-sum-item"><span class="sv">'+totalSearches+'</span><span class="sl">Total Searches</span></div>' +
    '<div class="rpt-sum-item"><span class="sv">'+totalEstRev.toFixed(3)+'</span><span class="sl">Est. Revenue KWD</span></div>' +
    '<div class="rpt-sum-item"><span class="sv">'+(salesData.filter(function(r){return r.cartAdds>0;}).length)+'</span><span class="sl">Products Selling</span></div>';

  var salesRows = salesData.map(function(r,i){
    return '<tr>'+
      '<td style="color:#aaa;font-size:11px;font-weight:700">'+(i+1)+'</td>'+
      '<td style="font-family:monospace;font-size:11px;color:var(--orange)">'+getProductSku(r.p.id)+'</td>'+
      '<td style="font-weight:700;color:var(--dark)">'+encodeHtml(r.p.name)+'</td>'+
      '<td><span class="cat-pill">'+r.p.cat+'</span></td>'+
      '<td style="font-weight:800">'+r.p.price.toFixed(3)+'</td>'+
      '<td style="font-weight:900;text-align:center;color:'+(r.cartAdds>0?'var(--orange)':'#ccc')+'">'+r.cartAdds+'</td>'+
      '<td style="text-align:center;color:'+(r.searchHits>0?'var(--purple)':'#ccc')+'">'+r.searchHits+'</td>'+
      '<td style="font-weight:700;color:'+(r.estRev>0?'var(--green)':'#ccc')+'">'+r.estRev.toFixed(3)+'</td>'+
    '</tr>';
  }).join('');
  document.getElementById('rptSalesBody').innerHTML = salesRows;
  document.getElementById('rptSalesFoot').innerHTML =
    '<tr><td colspan="5" style="font-weight:800">TOTAL ('+all.length+' products)</td>'+
    '<td style="font-weight:800;text-align:center">'+totalCartAdds+'</td>'+
    '<td style="font-weight:800;text-align:center">'+totalSearches+'</td>'+
    '<td style="font-weight:800">'+totalEstRev.toFixed(3)+' KWD</td></tr>';
}

function exportInventoryExcel() {
  if (typeof XLSX === 'undefined') { showToast('Excel library loading — try again'); return; }
  const all = getAllAdminProducts();
  const now = new Date().toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const rows = [['#','SKU','Product Name','Category','Price (KWD)','Stock Qty','Status','Value (KWD)']];
  var totalUnits=0, totalValue=0;
  all.forEach(function(p){
    var qty=stockData[p.id]||0;
    var val=parseFloat((p.price*qty).toFixed(3));
    var status=qty===0?'Out of Stock':qty<=10?'Low Stock':'In Stock';
    totalUnits+=qty; totalValue+=val;
    rows.push([p.id, getProductSku(p.id), p.name, p.cat, parseFloat(p.price.toFixed(3)), qty, status, val]);
  });
  rows.push(['','','','','TOTAL',totalUnits,'',parseFloat(totalValue.toFixed(3))]);
  var ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:6},{wch:12},{wch:32},{wch:16},{wch:12},{wch:10},{wch:14},{wch:12}];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
  var date = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, 'Rawaj_Inventory_'+date+'.xlsx');
  showToast('Inventory Excel downloaded ✅ — save it to your excel website management folder');
}

function exportSalesExcel() {
  if (typeof XLSX === 'undefined') { showToast('Excel library loading — try again'); return; }
  const all     = getAllAdminProducts();
  const views   = JSON.parse(localStorage.getItem('rawaj_views')   || '{}');
  const searches= JSON.parse(localStorage.getItem('rawaj_searches')|| '{}');
  const salesData = all.map(function(p){
    return { p:p, cartAdds:views[p.id]||0, searchHits:searches[p.id]||0, estRev:((views[p.id]||0)*p.price) };
  }).sort(function(a,b){ return b.cartAdds - a.cartAdds; });
  const rows = [['Rank','SKU','Product Name','Category','Price (KWD)','Cart Adds','Searches','Est. Revenue (KWD)']];
  var totalAdds=0,totalSearches=0,totalRev=0;
  salesData.forEach(function(r,i){
    var rev=parseFloat(r.estRev.toFixed(3));
    totalAdds+=r.cartAdds; totalSearches+=r.searchHits; totalRev+=rev;
    rows.push([i+1, getProductSku(r.p.id), r.p.name, r.p.cat, parseFloat(r.p.price.toFixed(3)), r.cartAdds, r.searchHits, rev]);
  });
  rows.push(['','','','','TOTAL',totalAdds,totalSearches,parseFloat(totalRev.toFixed(3))]);
  var ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:6},{wch:12},{wch:32},{wch:16},{wch:12},{wch:10},{wch:10},{wch:16}];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sales');
  var date = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, 'Rawaj_Sales_'+date+'.xlsx');
  showToast('Sales Excel downloaded ✅ — save it to your excel website management folder');
}

// ── FILE SYSTEM ACCESS API — AUTO-UPDATE EXCEL FILES ─────────────────────────
// Stores file handles in IndexedDB so they survive page reloads.
// User clicks "Connect File" once → admin panel writes directly on every Reports open.

var _invFileHandle   = null;
var _salesFileHandle = null;

function _openFsDb() {
  return new Promise(function(resolve, reject) {
    var req = indexedDB.open('rawaj_fs', 1);
    req.onupgradeneeded = function(e) { e.target.result.createObjectStore('handles'); };
    req.onsuccess  = function(e) { resolve(e.target.result); };
    req.onerror    = function(e) { reject(e.target.error); };
  });
}
function _saveFsHandle(key, handle) {
  return _openFsDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').put(handle, key);
      tx.oncomplete = resolve;
      tx.onerror    = function(e) { reject(e.target.error); };
    });
  });
}
function _loadFsHandle(key) {
  return _openFsDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction('handles', 'readonly');
      var req = tx.objectStore('handles').get(key);
      req.onsuccess = function(e) { resolve(e.target.result || null); };
      req.onerror   = function(e) { reject(e.target.error); };
    });
  });
}

function _buildInventoryWorkbook() {
  var all = getAllAdminProducts();
  var rows = [['#','SKU','Product Name','Category','Price (KWD)','Stock Qty','Status','Value (KWD)']];
  var totalUnits=0, totalValue=0;
  all.forEach(function(p){
    var qty=stockData[p.id]||0;
    var val=parseFloat((p.price*qty).toFixed(3));
    var status=qty===0?'Out of Stock':qty<=10?'Low Stock':'In Stock';
    totalUnits+=qty; totalValue+=val;
    rows.push([p.id, getProductSku(p.id), p.name, p.cat, parseFloat(p.price.toFixed(3)), qty, status, val]);
  });
  rows.push(['','','','','TOTAL',totalUnits,'',parseFloat(totalValue.toFixed(3))]);
  var ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:6},{wch:12},{wch:32},{wch:16},{wch:12},{wch:10},{wch:14},{wch:12}];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
  return wb;
}

function _buildSalesWorkbook() {
  var all     = getAllAdminProducts();
  var views   = JSON.parse(localStorage.getItem('rawaj_views')   || '{}');
  var searches= JSON.parse(localStorage.getItem('rawaj_searches')|| '{}');
  var salesData = all.map(function(p){
    return { p:p, cartAdds:views[p.id]||0, searchHits:searches[p.id]||0, estRev:((views[p.id]||0)*p.price) };
  }).sort(function(a,b){ return b.cartAdds - a.cartAdds; });
  var rows = [['Rank','SKU','Product Name','Category','Price (KWD)','Cart Adds','Searches','Est. Revenue (KWD)']];
  var totalAdds=0,totalSearches=0,totalRev=0;
  salesData.forEach(function(r,i){
    var rev=parseFloat(r.estRev.toFixed(3));
    totalAdds+=r.cartAdds; totalSearches+=r.searchHits; totalRev+=rev;
    rows.push([i+1, getProductSku(r.p.id), r.p.name, r.p.cat, parseFloat(r.p.price.toFixed(3)), r.cartAdds, r.searchHits, rev]);
  });
  rows.push(['','','','','TOTAL',totalAdds,totalSearches,parseFloat(totalRev.toFixed(3))]);
  var ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:6},{wch:12},{wch:32},{wch:16},{wch:12},{wch:10},{wch:10},{wch:16}];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sales');
  return wb;
}

async function _writeToHandle(handle, buildFn) {
  if (typeof XLSX === 'undefined') return false;
  try {
    var perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') perm = await handle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') return false;
    var wb   = buildFn();
    var buf  = XLSX.write(wb, { bookType:'xlsx', type:'array' });
    var writable = await handle.createWritable();
    await writable.write(new Blob([buf], { type:'application/octet-stream' }));
    await writable.close();
    return true;
  } catch(e) {
    console.warn('File write failed:', e);
    return false;
  }
}

async function connectInventoryFile() {
  if (!window.showSaveFilePicker) {
    showToast('Use Chrome or Edge for auto-connect'); return;
  }
  try {
    var handle = await window.showSaveFilePicker({
      suggestedName: 'Rawaj_Inventory.xlsx',
      startIn: 'documents',
      types: [{ description: 'Excel File', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }]
    });
    _invFileHandle = handle;
    await _saveFsHandle('inv', handle);
    _updateConnectUI();
    var ok = await _writeToHandle(_invFileHandle, _buildInventoryWorkbook);
    showToast(ok ? 'Inventory file connected & updated ✅' : 'Connected but write failed');
  } catch(e) { if (e.name !== 'AbortError') showToast('Could not connect file'); }
}

async function connectSalesFile() {
  if (!window.showSaveFilePicker) {
    showToast('Use Chrome or Edge for auto-connect'); return;
  }
  try {
    var handle = await window.showSaveFilePicker({
      suggestedName: 'Rawaj_Sales.xlsx',
      startIn: 'documents',
      types: [{ description: 'Excel File', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }]
    });
    _salesFileHandle = handle;
    await _saveFsHandle('sales', handle);
    _updateConnectUI();
    var ok = await _writeToHandle(_salesFileHandle, _buildSalesWorkbook);
    showToast(ok ? 'Sales file connected & updated ✅' : 'Connected but write failed');
  } catch(e) { if (e.name !== 'AbortError') showToast('Could not connect file'); }
}

function _updateConnectUI() {
  var pairs = [
    ['invConnectBtn',   'invConnectLbl',   _invFileHandle],
    ['salesConnectBtn', 'salesConnectLbl', _salesFileHandle],
    ['ordConnectBtn',   'ordConnectLbl',   _ordFileHandle]
  ];
  pairs.forEach(function(p) {
    var btn = document.getElementById(p[0]);
    var lbl = document.getElementById(p[1]);
    if (!btn || !lbl) return;
    if (p[2]) { btn.classList.add('connected'); lbl.textContent = '✓ ' + p[2].name; }
    else       { btn.classList.remove('connected'); lbl.textContent = 'Connect File'; }
  });
}

async function _autoWriteReports() {
  var wrote = false;
  if (_invFileHandle) {
    var ok = await _writeToHandle(_invFileHandle, _buildInventoryWorkbook);
    if (ok) wrote = true;
  }
  if (_salesFileHandle) {
    var ok2 = await _writeToHandle(_salesFileHandle, _buildSalesWorkbook);
    if (ok2) wrote = true;
  }
  if (_ordFileHandle && _allOrders.length) {
    var ok3 = await _writeToHandle(_ordFileHandle, _buildOrdersWorkbook);
    if (ok3) wrote = true;
  }
  if (wrote) showToast('Reports auto-updated in your folder ✅');
}

async function _loadSavedHandles() {
  try {
    var [inv, sales, ord] = await Promise.all([_loadFsHandle('inv'), _loadFsHandle('sales'), _loadFsHandle('ord')]);
    if (inv)   _invFileHandle   = inv;
    if (sales) _salesFileHandle = sales;
    if (ord)   _ordFileHandle   = ord;
    _updateConnectUI();
  } catch(e) { console.warn('Could not load saved file handles:', e); }
}

// ── ORDERS ────────────────────────────────────────────────────────────────────
var _allOrders       = [];
var _ordFileHandle   = null;

async function loadOrders(showToastMsg) {
  if (showToastMsg) showToast('Loading orders…');
  var res = await sbFetch(SB_URL + '/rest/v1/rawaj_orders?select=*&order=created_at.desc', { headers: SB_HDRS });
  console.log('[Admin] loadOrders result:', res);
  if (res.error) {
    console.error('[Admin] Orders load FAILED:', res.error);
    showToast('❌ Orders error: ' + res.error);
    if (document.getElementById('ordTblBody')) {
      document.getElementById('ordTblBody').innerHTML =
        '<tr><td colspan="7" style="padding:20px;color:var(--red);font-weight:700;text-align:center"><i class="fa fa-exclamation-triangle"></i> Load error: ' + res.error + '</td></tr>';
    }
    return;
  }
  _allOrders = res.data || [];
  console.log('[Admin] Orders loaded:', _allOrders.length, 'rows');
  // Update badge on tab
  var pending = _allOrders.filter(function(o){ return o.status === 'pending'; }).length;
  var badge   = document.getElementById('ordBadge');
  if (badge) { badge.textContent = pending; badge.style.display = pending ? 'inline' : 'none'; }
  renderOrdersTab();
  if (showToastMsg) showToast('Orders refreshed ✓');
}

function renderOrdersTab() {
  var filter = document.getElementById('ordStatusFilter') ? document.getElementById('ordStatusFilter').value : 'all';
  var q      = (document.getElementById('ordSearch') ? document.getElementById('ordSearch').value : '').toLowerCase();
  var list   = _allOrders.filter(function(o){
    if (filter !== 'all' && o.status !== filter) return false;
    if (q && !(o.customer_name||'').toLowerCase().includes(q) && !(o.customer_phone||'').includes(q)) return false;
    return true;
  });

  // Stats
  var total    = _allOrders.length;
  var pending  = _allOrders.filter(function(o){ return o.status==='pending'; }).length;
  var delivered= _allOrders.filter(function(o){ return o.status==='delivered'; }).length;
  var revenue  = _allOrders.reduce(function(s,o){ return s+(parseFloat(o.total)||0); }, 0);
  document.getElementById('ordStats').innerHTML =
    card('fa-receipt','ic-orange','Total Orders', total, 'All time') +
    card('fa-clock','ic-yellow','Pending', pending, 'Awaiting confirmation') +
    card('fa-truck','ic-green','Delivered', delivered, 'Completed orders') +
    card('fa-coins','ic-blue','Revenue', revenue.toFixed(3)+' KWD', 'All orders');

  document.getElementById('ordCountLbl').textContent = list.length + ' order' + (list.length!==1?'s':'') + ' shown';

  if (!list.length) {
    document.getElementById('ordTblBody').innerHTML =
      '<tr><td colspan="7"><div class="ord-empty"><i class="fa fa-receipt"></i><p>No orders found</p><small>'+(total?'Try changing the filter':'No orders yet — they appear here once customers checkout')+'</small></div></td></tr>';
    return;
  }

  document.getElementById('ordTblBody').innerHTML = list.map(function(o, i){
    var dt    = o.created_at ? new Date(o.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
    var items = '';
    try {
      var arr = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []);
      items = arr.map(function(it){ return '<span style="display:block">• '+encodeHtml(it.name)+' ×'+it.qty+' — '+parseFloat(it.price).toFixed(3)+' KWD</span>'; }).join('');
    } catch(e){ items = encodeHtml(String(o.items||'')); }
    var statusOpts = ['pending','confirmed','delivered','cancelled'];
    var statusSel  = '<select class="ord-status '+o.status+'" onchange="updateOrderStatus('+o.id+',this.value,this)">'
      + statusOpts.map(function(s){ return '<option value="'+s+'"'+(s===o.status?' selected':'')+'>'+s.charAt(0).toUpperCase()+s.slice(1)+'</option>'; }).join('')
      + '</select>';
    return '<tr>'+
      '<td style="color:#aaa;font-size:11px;font-weight:700;white-space:nowrap">#'+(i+1)+'</td>'+
      '<td class="ord-date" style="white-space:nowrap">'+dt+'</td>'+
      '<td><div class="ord-name">'+encodeHtml(o.customer_name||'—')+'</div><div class="ord-phone"><i class="fab fa-whatsapp" style="color:var(--green)"></i> '+encodeHtml(o.customer_phone||'—')+'</div></td>'+
      '<td><div class="ord-addr">'+encodeHtml(o.address||'—')+'</div>'+(o.notes?'<div class="ord-notes">'+encodeHtml(o.notes)+'</div>':'')+'</td>'+
      '<td><div class="ord-items">'+items+'</div></td>'+
      '<td><span class="ord-total">'+parseFloat(o.total||0).toFixed(3)+'</span></td>'+
      '<td>'+statusSel+'</td>'+
    '</tr>';
  }).join('');
}

async function updateOrderStatus(id, newStatus, selectEl) {
  selectEl.className = 'ord-status ' + newStatus;
  var res = await sbFetch(SB_URL + '/rest/v1/rawaj_orders?id=eq.'+id, {
    method: 'PATCH',
    headers: Object.assign({}, SB_HDRS, {'Content-Type':'application/json','Prefer':'return=minimal'}),
    body: JSON.stringify({ status: newStatus })
  });
  if (res.error) { showToast('Failed to update status'); return; }
  var ord = _allOrders.find(function(o){ return o.id === id; });
  if (ord) ord.status = newStatus;
  // Refresh badge
  var pending = _allOrders.filter(function(o){ return o.status==='pending'; }).length;
  var badge   = document.getElementById('ordBadge');
  if (badge) { badge.textContent = pending; badge.style.display = pending ? 'inline' : 'none'; }
  showToast('Order status updated ✓');
}

function _buildOrdersWorkbook() {
  var rows = [['#','Date & Time','Customer Name','Phone / WhatsApp','Delivery Address','Notes','Items Ordered','Total (KWD)','Status']];
  _allOrders.forEach(function(o, i){
    var dt = o.created_at ? new Date(o.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
    var itemStr = '';
    try {
      var arr = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []);
      itemStr = arr.map(function(it){ return it.name+' x'+it.qty+' ('+parseFloat(it.price).toFixed(3)+' KWD)'; }).join(' | ');
    } catch(e){ itemStr = String(o.items||''); }
    rows.push([i+1, dt, o.customer_name||'', o.customer_phone||'', o.address||'', o.notes||'', itemStr, parseFloat(o.total||0).toFixed(3), o.status||'']);
  });
  var totalRev = _allOrders.reduce(function(s,o){ return s+(parseFloat(o.total)||0); }, 0);
  rows.push(['','','','','','','TOTAL', parseFloat(totalRev.toFixed(3)),'']);
  var ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:4},{wch:18},{wch:22},{wch:18},{wch:28},{wch:20},{wch:50},{wch:12},{wch:12}];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Customer Orders');
  return wb;
}

function exportOrdersExcel() {
  if (typeof XLSX === 'undefined') { showToast('Excel library loading — try again'); return; }
  if (!_allOrders.length) { showToast('No orders to export yet'); return; }
  var wb   = _buildOrdersWorkbook();
  var date = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, 'Rawaj_Orders_'+date+'.xlsx');
  showToast('Orders Excel downloaded ✅');
}

async function connectOrdersFile() {
  if (!window.showSaveFilePicker) { showToast('Use Chrome or Edge for auto-connect'); return; }
  try {
    var handle = await window.showSaveFilePicker({
      suggestedName: 'Rawaj_Orders.xlsx',
      startIn: 'documents',
      types: [{ description: 'Excel File', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }]
    });
    _ordFileHandle = handle;
    await _saveFsHandle('ord', handle);
    _updateConnectUI();
    var ok = await _writeToHandle(_ordFileHandle, _buildOrdersWorkbook);
    showToast(ok ? 'Orders file connected & updated ✅' : 'Connected but write failed');
  } catch(e) { if (e.name !== 'AbortError') showToast('Could not connect file'); }
}

function renderOrdersReport() {
  var now = new Date().toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  var total   = _allOrders.length;
  var pending = _allOrders.filter(function(o){ return o.status==='pending'; }).length;
  var delivered=_allOrders.filter(function(o){ return o.status==='delivered'; }).length;
  var revenue = _allOrders.reduce(function(s,o){ return s+(parseFloat(o.total)||0); }, 0);

  document.getElementById('rptOrdDate').textContent = 'Last updated: ' + now;
  document.getElementById('rptOrdSummary').innerHTML =
    '<div class="rpt-sum-item"><span class="sv">'+total+'</span><span class="sl">Total Orders</span></div>'+
    '<div class="rpt-sum-item"><span class="sv" style="color:var(--yellow)">'+pending+'</span><span class="sl">Pending</span></div>'+
    '<div class="rpt-sum-item"><span class="sv" style="color:var(--green)">'+delivered+'</span><span class="sl">Delivered</span></div>'+
    '<div class="rpt-sum-item"><span class="sv" style="color:var(--orange)">'+revenue.toFixed(3)+'</span><span class="sl">Revenue KWD</span></div>';

  if (!total) {
    document.getElementById('rptOrdBody').innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:#aaa;font-size:13px"><i class="fa fa-receipt" style="margin-right:8px"></i>No orders yet</td></tr>';
    document.getElementById('rptOrdFoot').innerHTML = '';
    return;
  }

  document.getElementById('rptOrdBody').innerHTML = _allOrders.map(function(o, i){
    var dt = o.created_at ? new Date(o.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
    var itemStr = '';
    try {
      var arr = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []);
      itemStr = arr.map(function(it){ return it.name+' ×'+it.qty; }).join('<br>');
    } catch(e){ itemStr = String(o.items||''); }
    var sc = o.status||'pending';
    return '<tr>'+
      '<td style="color:#aaa;font-size:11px;font-weight:700">'+(i+1)+'</td>'+
      '<td style="white-space:nowrap;font-size:11px">'+dt+'</td>'+
      '<td style="font-weight:700">'+encodeHtml(o.customer_name||'—')+'</td>'+
      '<td style="font-size:11px">'+encodeHtml(o.customer_phone||'—')+'</td>'+
      '<td style="font-size:11px">'+encodeHtml(o.address||'—')+'</td>'+
      '<td style="font-size:11px;color:var(--gray);font-style:italic">'+encodeHtml(o.notes||'—')+'</td>'+
      '<td style="font-size:11px">'+itemStr+'</td>'+
      '<td style="font-weight:800;color:var(--green)">'+parseFloat(o.total||0).toFixed(3)+'</td>'+
      '<td><span class="rpt-status '+(sc==='delivered'?'in':sc==='pending'?'low':'out')+'">'+sc+'</span></td>'+
    '</tr>';
  }).join('');
  document.getElementById('rptOrdFoot').innerHTML =
    '<tr><td colspan="7" style="font-weight:800">TOTAL ('+total+' orders)</td>'+
    '<td style="font-weight:800">'+revenue.toFixed(3)+' KWD</td><td></td></tr>';
}

// â”€â”€ STATS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderStats() {
  const total  = PRODUCTS.length;
  const units  = PRODUCTS.reduce(function(s,p) { return s+(stockData[p.id]||0); }, 0);
  const value  = PRODUCTS.reduce(function(s,p) { return s+p.price*(stockData[p.id]||0); }, 0);
  const low    = PRODUCTS.filter(function(p) { return (stockData[p.id]||0) > 0 && (stockData[p.id]||0) <= 10; }).length;
  const out    = PRODUCTS.filter(function(p) { return (stockData[p.id]||0) === 0; }).length;
  document.getElementById('statsGrid').innerHTML =
    card('fa-boxes','ic-orange','Total Products', total, getAllAdminProducts().length + ' active products') +
    card('fa-layer-group','ic-blue','Total Units', units.toLocaleString(), 'In stock') +
    card('fa-coins','ic-green','Inventory Value', value.toFixed(2)+' KWD', 'Total stock value') +
    card('fa-exclamation-triangle','ic-red','Alerts', low+out, low+' low &nbsp;|&nbsp; '+out+' out');
  const lowList = PRODUCTS.filter(function(p) { return (stockData[p.id]||0) <= 10; });
  const box = document.getElementById('alertsBox');
  if (lowList.length) {
    box.classList.add('show');
    document.getElementById('alertItems').innerHTML = lowList.map(function(p) {
      return '<div class="alert-chip"><i class="fa fa-warning"></i> '+p.name+' &mdash; '+(stockData[p.id]||0)+' left</div>';
    }).join('');
  } else { box.classList.remove('show'); }
}
function card(icon, cls, label, val, sub) {
  return '<div class="stat-card"><div class="stat-icon '+cls+'"><i class="fa '+icon+'"></i></div>' +
    '<div class="stat-info"><label>'+label+'</label><strong>'+val+'</strong><small>'+sub+'</small></div></div>';
}

// â”€â”€ TABLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderTable() {
  const photos   = JSON.parse(localStorage.getItem('rawaj_photos')||'{}');
  const views    = JSON.parse(localStorage.getItem('rawaj_views')||'{}');
  const searches = JSON.parse(localStorage.getItem('rawaj_searches')||'{}');
  const q   = document.getElementById('adminSearch').value.toLowerCase();
  const cat = document.getElementById('catFilter').value;
  const list = getAllAdminProducts().filter(function(p) {
    return (cat==='all'||p.cat===cat) && (!q||p.name.toLowerCase().includes(q));
  });
  const rows = list.map(function(p) {
    const qty    = stockData[p.id]||0;
    const cls    = qty===0?'out':qty<=10?'low':'';
    const dotCls = qty===0?'dot-red':qty<=10?'dot-yellow':'dot-green';
    const status = qty===0?'Out of Stock':qty<=10?'Low Stock':'In Stock';
    const val    = (p.price*qty).toFixed(3);
    const thumb  = photos[p.id] || p.img || ('https://picsum.photos/seed/dhow'+p.id+'/80/80');
    const vCount = views[p.id]||0;
    const sCount = searches[p.id]||0;
    const visLbl = p.hidden ? '<i class="fa fa-eye-slash"></i> Show' : '<i class="fa fa-eye"></i> Hide';
    const visCls = p.hidden ? 'hidden-p' : 'visible';
    const isChk  = _selectedIds.has(p.id);
    // Build multi-category pills
    const allCats = getProductCatSlugs(p);
    const catPills = '<div class="cat-pills-wrap">' +
      allCats.map(function(slug){
        var match = getAllCats().find(function(c){return c.slug===slug;});
        var lbl = match ? match.label : slug.replace(/-/g,' ');
        return '<span class="cat-pill">'+lbl+'</span>';
      }).join('') +
      '<button onclick="openMC('+p.id+')" style="background:none;border:1px dashed #ccc;color:#aaa;font-size:9px;padding:2px 6px;border-radius:20px;cursor:pointer;font-weight:700;flex-shrink:0;line-height:1.4" title="Edit categories"><i class="fa fa-edit"></i></button>' +
    '</div>';
    return '<tr class="'+(p.hidden?'row-hidden':'')+'">' +
      '<td class="chk-col"><input type="checkbox" class="row-chk" data-id="'+p.id+'" '+(isChk?'checked':'')+' onchange="toggleRowSelect('+p.id+',this.checked)" /></td>' +
      '<td style="color:#aaa;font-size:11px;font-weight:700">#'+p.id+'</td>' +
      '<td><div style="display:flex;align-items:center;gap:11px">' +
        '<img class="prod-img" id="thumb'+p.id+'" src="'+thumb+'" alt="'+p.name+'" onerror="this.style.opacity=0.3" />' +
        '<div><input class="name-input" id="ni'+p.id+'" value="'+encodeHtml((_prodOverrides[p.id]||{}).name||p.name)+'" oninput="onNameEdit('+p.id+')" title="Click to edit name" />' +
        '<div class="prod-sku" style="display:flex;gap:8px;margin-top:2px">' +
          '<span>'+getProductSku(p.id)+'</span>' +
          (vCount>0 ? '<span style="color:var(--orange)"><i class="fa fa-eye"></i> '+vCount+'</span>' : '') +
          (sCount>0 ? '<span style="color:var(--purple)"><i class="fa fa-search"></i> '+sCount+'</span>' : '') +
        '</div></div>' +
      '</div></td>' +
      '<td>'+catPills+'</td>' +
      '<td><input class="price-input" id="pi'+p.id+'" type="number" step="0.001" min="0" value="'+((_prodOverrides[p.id]||{}).price!==undefined?(_prodOverrides[p.id].price).toFixed(3):p.price.toFixed(3))+'" oninput="onPriceEdit('+p.id+')" /></td>' +
      '<td><input type="number" class="stock-input '+cls+'" id="si'+p.id+'" value="'+qty+'" min="0" oninput="onStock('+p.id+')" /></td>' +
      '<td><span class="status-dot"><span class="dot '+dotCls+'"></span>'+status+'</span></td>' +
      '<td class="val-cell">'+val+'</td>' +
      '<td>' +
        '<button class="vis-btn '+visCls+'" onclick="toggleVisibility('+p.id+','+p.isBase+')">'+visLbl+'</button>' +
        '<button class="act-btn" onclick="setStock('+p.id+',0)"><i class="fa fa-times"></i> Clear</button>' +
        '<button class="act-btn" onclick="addStock('+p.id+')"><i class="fa fa-plus"></i> +50</button>' +
        '<button class="act-btn blue" onclick="openPhoto('+p.id+')"><i class="fa fa-camera"></i> Photo</button>' +
        '<button class="act-btn purple" onclick="openStats('+p.id+')"><i class="fa fa-chart-bar"></i> Stats</button>' +
        '<button class="del-btn" onclick="deleteProduct('+p.id+','+p.isBase+')"><i class="fa fa-trash"></i></button>' +
      '</td>' +
    '</tr>';
  }).join('');
  document.getElementById('tblBody').innerHTML = rows;
  const tv = list.reduce(function(s,p){ return s+p.price*(stockData[p.id]||0); },0);
  const tu = list.reduce(function(s,p){ return s+(stockData[p.id]||0); },0);
  document.getElementById('tblFoot').innerHTML =
    '<tr class="tfoot-row"><td colspan="5">TOTAL ('+list.length+' shown, '+list.filter(function(p){return p.hidden;}).length+' hidden)</td>' +
    '<td>'+tu+' units</td><td></td><td>'+tv.toFixed(3)+' KWD</td><td></td></tr>';
  // Sync select-all checkbox state
  var allChks = document.querySelectorAll('.row-chk');
  var sa = document.getElementById('selectAll');
  if (sa && allChks.length) {
    var nChecked = Array.from(allChks).filter(function(c){return c.checked;}).length;
    sa.checked = nChecked === allChks.length;
    sa.indeterminate = nChecked > 0 && nChecked < allChks.length;
  }
}
function onStock(id) {
  const el = document.getElementById('si'+id);
  const v = Math.max(0, parseInt(el.value)||0);
  if (stockData[id] !== v) _pushUndo();
  stockData[id] = v;
  el.className = 'stock-input' + (v===0?' out':v<=10?' low':'');
  renderStats();
}

function onNameEdit(id) {
  const val = document.getElementById('ni'+id).value;
  if (!_prodOverrides[id]) _prodOverrides[id] = {};
  _prodOverrides[id].name = val;
}
function onPriceEdit(id) {
  const val = parseFloat(document.getElementById('pi'+id).value);
  if (!_prodOverrides[id]) _prodOverrides[id] = {};
  _prodOverrides[id].price = isNaN(val) ? 0 : val;
  renderStats();
}
function setStock(id, qty) { _pushUndo(); stockData[id]=qty; renderTable(); renderStats(); }
function addStock(id) { _pushUndo(); const cur=stockData[id]||0; stockData[id]=Math.ceil((cur+1)/50)*50; renderTable(); renderStats(); }
async function saveAll() {
  _pushUndo();
  // collect name + price edits
  getAllAdminProducts().forEach(function(p) {
    var ni = document.getElementById('ni'+p.id);
    var pi = document.getElementById('pi'+p.id);
    if (ni) { if (!_prodOverrides[p.id]) _prodOverrides[p.id]={}; _prodOverrides[p.id].name = ni.value; }
    if (pi) { var pv=parseFloat(pi.value); if (!isNaN(pv)) { if (!_prodOverrides[p.id]) _prodOverrides[p.id]={}; _prodOverrides[p.id].price=pv; } }
  });
  localStorage.setItem('rawaj_overrides', JSON.stringify(_prodOverrides));

  PRODUCTS.forEach(function(p) { const el=document.getElementById('si'+p.id); if(el) stockData[p.id]=Math.max(0,parseInt(el.value)||0); });
  localStorage.setItem('rawaj_stock', JSON.stringify(stockData));
  const rows = PRODUCTS.map(function(p) { return { product_id: p.id, qty: stockData[p.id]||0 }; });
  const { error } = await sbFetch(SB_URL + '/rest/v1/rawaj_stock', {
    method: 'POST',
    headers: Object.assign({}, SB_HDRS, { 'Prefer': 'resolution=merge-duplicates' }),
    body: JSON.stringify(rows)
  });
  showToast(error ? 'Saved locally (cloud error)' : 'Saved to cloud â˜ï¸');
  renderStats();
}

// â”€â”€ ANALYTICS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderAnalytics() {
  const views   = JSON.parse(localStorage.getItem('rawaj_views')||'{}');
  const searches= JSON.parse(localStorage.getItem('rawaj_searches')||'{}');
  const photos  = JSON.parse(localStorage.getItem('rawaj_photos')||'{}');

  const totalViews   = Object.values(views).reduce(function(a,b){return a+b;},0);
  const totalSearches= Object.values(searches).reduce(function(a,b){return a+b;},0);

  // Most viewed
  const topV = PRODUCTS.slice().sort(function(a,b){ return (views[b.id]||0)-(views[a.id]||0); })[0];
  const topS = PRODUCTS.slice().sort(function(a,b){ return (searches[b.id]||0)-(searches[a.id]||0); })[0];

  document.getElementById('analyticsStats').innerHTML =
    aCard('fa-eye','ic-orange','Total Views', totalViews, 'Add-to-cart clicks') +
    aCard('fa-search','ic-purple','Total Searches', totalSearches, 'Search appearances') +
    aCard('fa-fire','ic-orange','Most Viewed', topV ? (views[topV.id]||0)+' views' : 'â€”', topV ? topV.name : 'No data yet') +
    aCard('fa-trophy','ic-purple','Most Searched', topS ? (searches[topS.id]||0)+' times' : 'â€”', topS ? topS.name : 'No data yet');

  // Top 10 viewed
  const sortedViews = PRODUCTS.slice().sort(function(a,b){ return (views[b.id]||0)-(views[a.id]||0); }).slice(0,10);
  const maxV = views[sortedViews[0] && sortedViews[0].id] || 1;
  document.getElementById('viewsTable').innerHTML = buildAnTable(sortedViews, views, photos, maxV, 'bar-orange', 'views');

  // Top 10 searched
  const sortedSearches = PRODUCTS.slice().sort(function(a,b){ return (searches[b.id]||0)-(searches[a.id]||0); }).slice(0,10);
  const maxS = searches[sortedSearches[0] && sortedSearches[0].id] || 1;
  document.getElementById('searchesTable').innerHTML = buildAnTable(sortedSearches, searches, photos, maxS, 'bar-purple', 'searches');
}
function aCard(icon, cls, label, val, sub) {
  return '<div class="stat-card"><div class="stat-icon '+cls+'"><i class="fa '+icon+'"></i></div>' +
    '<div class="stat-info"><label>'+label+'</label><strong>'+val+'</strong><small>'+sub+'</small></div></div>';
}
function buildAnTable(list, counts, photos, maxCount, barCls, unit) {
  const hasData = list.some(function(p) { return (counts[p.id]||0) > 0; });
  if (!hasData) {
    return '<div class="no-data"><i class="fa fa-chart-bar"></i><p>No data yet</p>' +
      '<small>Data will appear as customers browse and search products</small></div>';
  }
  const rankCls = function(i) { return i===0?'rank-1':i===1?'rank-2':i===2?'rank-3':'rank-n'; };
  const rows = list.map(function(p, i) {
    const count = counts[p.id]||0;
    const pct = Math.round((count/maxCount)*100);
    const thumb = photos[p.id] || p.img || ('https://picsum.photos/seed/dhow'+p.id+'/80/80');
    return '<tr>' +
      '<td><div class="rank-badge '+rankCls(i)+'">'+(i+1)+'</div></td>' +
      '<td><div style="display:flex;align-items:center;gap:10px">' +
        '<img src="'+thumb+'" style="width:36px;height:36px;border-radius:6px;object-fit:cover;border:1px solid #eee" onerror="this.style.opacity=0.2" />' +
        '<div><div style="font-weight:700;font-size:13px;color:var(--dark)">'+p.name+'</div>' +
        '<div style="font-size:10px;color:var(--gray);text-transform:uppercase;letter-spacing:0.5px">'+((p.cat||'').replace('-',' '))+'</div></div>' +
      '</div></td>' +
      '<td><div class="an-bar-wrap"><div class="an-bar '+barCls+'" style="width:'+pct+'%"></div></div></td>' +
      '<td><span class="an-count">'+count+'<small>'+unit+'</small></span></td>' +
      '<td><button class="act-btn" onclick="openStats('+p.id+')" style="font-size:10px;padding:4px 8px"><i class="fa fa-chart-bar"></i></button></td>' +
    '</tr>';
  }).join('');
  return '<table class="an-table">' +
    '<thead><tr><th>Rank</th><th>Product</th><th style="width:130px">Activity</th><th>Count</th><th></th></tr></thead>' +
    '<tbody>'+rows+'</tbody></table>';
}
function resetViews() {
  if (!confirm('Reset all view data?')) return;
  localStorage.removeItem('rawaj_views');
  renderAnalytics(); renderTable();
  showToast('View data reset');
}
function resetSearches() {
  if (!confirm('Reset all search data?')) return;
  localStorage.removeItem('rawaj_searches');
  renderAnalytics(); renderTable();
  showToast('Search data reset');
}

// â”€â”€ PRODUCT STATS MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openStats(id) {
  const p = PRODUCTS.find(function(x) { return x.id===id; });
  const views   = JSON.parse(localStorage.getItem('rawaj_views')||'{}');
  const searches= JSON.parse(localStorage.getItem('rawaj_searches')||'{}');
  const photos  = JSON.parse(localStorage.getItem('rawaj_photos')||'{}');
  const vCount  = views[id]||0;
  const sCount  = searches[id]||0;

  // Compute ranks
  const sortedV = PRODUCTS.slice().sort(function(a,b){ return (views[b.id]||0)-(views[a.id]||0); });
  const sortedS = PRODUCTS.slice().sort(function(a,b){ return (searches[b.id]||0)-(searches[a.id]||0); });
  const vRank   = sortedV.findIndex(function(x){ return x.id===id; })+1;
  const sRank   = sortedS.findIndex(function(x){ return x.id===id; })+1;
  const thumb   = photos[id] || p.img || ('https://picsum.photos/seed/dhow'+id+'/80/80');

  document.getElementById('smBody').innerHTML =
    '<div class="sm-prod-row">' +
      '<img src="'+thumb+'" onerror="this.style.opacity=0.2" />' +
      '<div class="sm-prod-info"><strong>'+p.name+'</strong><span>#'+id+' &nbsp;â€¢&nbsp; '+((p.cat||'').replace('-',' '))+'</span></div>' +
    '</div>' +
    '<div class="sm-metrics">' +
      '<div class="sm-metric"><i class="fa fa-eye" style="color:var(--orange)"></i>' +
        '<span class="sm-val">'+vCount+'</span><span class="sm-lbl">Total Views</span>' +
      '</div>' +
      '<div class="sm-metric"><i class="fa fa-search" style="color:var(--purple)"></i>' +
        '<span class="sm-val">'+sCount+'</span><span class="sm-lbl">Search Hits</span>' +
      '</div>' +
    '</div>' +
    '<div class="sm-rank-row">' +
      '<div class="sm-rank-chip orange"><i class="fa fa-eye"></i>&nbsp; Rank #'+vRank+' Most Viewed</div>' +
      '<div class="sm-rank-chip purple"><i class="fa fa-search"></i>&nbsp; Rank #'+sRank+' Most Searched</div>' +
    '</div>' +
    '<p class="sm-note">Views = times customers added this product to cart. Search hits = times this product appeared in a customer search.</p>' +
    '<button class="sm-close-btn" onclick="closeStats()"><i class="fa fa-times"></i>&nbsp; Close</button>';

  document.getElementById('statsOverlay').classList.add('open');
}
function closeStats() { document.getElementById('statsOverlay').classList.remove('open'); }

// â”€â”€ VISIBILITY TOGGLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function toggleVisibility(id, isBase) {
  let err = null;
  if (isBase) {
    if (_hiddenBaseIds.has(id)) {
      ({ error: err } = await sbFetch(SB_URL + '/rest/v1/rawaj_hidden?product_id=eq.' + id, { method:'DELETE', headers:SB_HDRS }));
      if (!err) _hiddenBaseIds.delete(id);
    } else {
      ({ error: err } = await sbFetch(SB_URL + '/rest/v1/rawaj_hidden', {
        method:'POST', headers:Object.assign({},SB_HDRS,{'Prefer':'resolution=merge-duplicates'}),
        body:JSON.stringify([{product_id:id, hidden:true}])
      }));
      if (!err) _hiddenBaseIds.add(id);
    }
  } else {
    const row = _customProductRows.find(function(p){ return p.id===id; });
    if (!row) return;
    const newHidden = !row.hidden;
    ({ error: err } = await sbFetch(SB_URL + '/rest/v1/rawaj_products?id=eq.' + id, {
      method:'PATCH', headers:SB_HDRS, body:JSON.stringify({hidden:newHidden})
    }));
    if (!err) row.hidden = newHidden;
  }
  if (err) { showToast('Error updating visibility'); return; }
  const isNowHidden = isBase ? _hiddenBaseIds.has(id) : !!(_customProductRows.find(function(p){return p.id===id;})?.hidden);
  showToast(isNowHidden ? 'Product hidden from store' : 'Product now visible');
  renderTable();
}

// ── SKU HELPERS ─────────────────────────────────────────────────────────────
// SKU is a display label; product ID is always sequential (count-based).
// If user sets a custom SKU different from the product ID, it's stored here.
function getProductSku(id) {
  try {
    var map = JSON.parse(localStorage.getItem('rawaj_sku_map') || '{}');
    var val = map[String(id)];
    return 'SKU-' + String(val !== undefined ? val : id).padStart(4, '0');
  } catch(e) { return 'SKU-' + String(id).padStart(4, '0'); }
}
function setProductSku(id, skuNum) {
  try {
    var map = JSON.parse(localStorage.getItem('rawaj_sku_map') || '{}');
    map[String(id)] = skuNum;
    localStorage.setItem('rawaj_sku_map', JSON.stringify(map));
  } catch(e) {}
}
function removeProductSku(id) {
  try {
    var map = JSON.parse(localStorage.getItem('rawaj_sku_map') || '{}');
    delete map[String(id)];
    localStorage.setItem('rawaj_sku_map', JSON.stringify(map));
  } catch(e) {}
}

// ── ADD PRODUCT ────────────────────────────────────────────────────────────
// Returns the next sequential product number based on COUNT of existing custom products.
// If you typed SKU 101 for product 62, the next auto-fill is still 63 — not 102.
function getNextSkuNumber() {
  var customIds = new Set(
    _customProductRows.filter(function(r){return r.id > 60;}).map(function(r){return r.id;})
    .concat(getDeletedProducts().filter(function(d){return d.id > 60;}).map(function(d){return d.id;}))
  );
  return 61 + customIds.size;
}

let _apPendingFile = null;

function apUrlPreview() {
  var url = document.getElementById('apImg').value.trim();
  if (url) { _apPendingFile = null; _apShowImgPreview(url); }
  else { document.getElementById('apImgPreviewWrap').style.display = 'none'; }
}
function apFileChosen(e) {
  var file = e.target.files[0]; if (!file) return;
  _apPendingFile = file;
  document.getElementById('apImg').value = '';
  var reader = new FileReader();
  reader.onload = function(ev) { _apShowImgPreview(ev.target.result); };
  reader.readAsDataURL(file);
}
function _apShowImgPreview(src) {
  var wrap = document.getElementById('apImgPreviewWrap');
  var img  = document.getElementById('apImgPreview');
  img.src  = src;
  wrap.style.display = 'block';
}

function openAddProduct() {
  try {
    _apPendingFile = null;
    document.getElementById('apName').value  = '';
    document.getElementById('apDesc').value  = '';
    document.getElementById('apImg').value   = '';
    document.getElementById('apPrice').value = '';
    document.getElementById('apStock').value = '50';
    document.getElementById('apBadge').value = '';
    document.getElementById('apImgPreviewWrap').style.display = 'none';
    document.getElementById('apFileInput').value = '';
    // Auto-fill next sequential product number (count-based, never affected by custom SKU labels)
    var nextSku = getNextSkuNumber();
    document.getElementById('apSku').value = nextSku;
    refreshCategorySelects();
    document.getElementById('apOverlay').classList.add('open');
    setTimeout(function(){ document.getElementById('apName').focus(); }, 150);
  } catch(err) { console.error('openAddProduct error:', err); }
}
function closeAddProduct() {
  document.getElementById('apOverlay').classList.remove('open');
  _apPendingFile = null;
}
async function saveNewProduct() {
  var name  = document.getElementById('apName').value.trim();
  var cat   = document.getElementById('apCat').value;
  var price = parseFloat(document.getElementById('apPrice').value);
  if (!name || !cat || isNaN(price) || price < 0) { showToast('Name, category and price are required'); return; }
  var btn = document.getElementById('apSaveBtn');
  btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>&nbsp; Saving...';

  // Resolve image URL
  var imgUrl = '';
  var pastedUrl = document.getElementById('apImg').value.trim();
  if (_apPendingFile) {
    try {
      var ext = (_apPendingFile.name.split('.').pop()||'jpg').toLowerCase();
      var tmpId = 'tmp_' + Date.now();
      imgUrl = await uploadToStorage(_apPendingFile, tmpId, ext);
    } catch(e) { showToast('Image upload failed: ' + e.message); btn.disabled=false; btn.innerHTML='<i class="fa fa-plus"></i>&nbsp; Add Product'; return; }
  } else if (pastedUrl) {
    imgUrl = pastedUrl;
  }

  // Product ID is always sequential (count-based) — SKU input is just a display label
  var safeId = getNextSkuNumber();
  var baseIds = new Set(PRODUCTS.map(function(p){return p.id;}));
  while (baseIds.has(safeId)) safeId++;

  // If user typed a different SKU than the auto-filled sequential number, save it as display label
  var skuTyped = parseInt(document.getElementById('apSku').value);
  if (skuTyped && skuTyped > 0 && skuTyped !== safeId) {
    setProductSku(safeId, skuTyped);
  }

  var { data: rows, error } = await sbFetch(SB_URL + '/rest/v1/rawaj_products', {
    method:'POST',
    headers:Object.assign({},SB_HDRS,{'Prefer':'return=representation'}),
    body:JSON.stringify([{
      id: safeId,
      name, category:cat, price, hidden:false,
      description: document.getElementById('apDesc').value.trim(),
      badge:  document.getElementById('apBadge').value || null,
      img_url: imgUrl
    }])
  });
  if (error) {
    showToast('Error saving product: ' + error);
  } else if (rows && rows[0]) {
    var newId = rows[0].id;
    var qty   = parseInt(document.getElementById('apStock').value) || 50;
    stockData[newId] = qty;
    await sbFetch(SB_URL + '/rest/v1/rawaj_stock', {
      method:'POST', headers:Object.assign({},SB_HDRS,{'Prefer':'resolution=merge-duplicates'}),
      body:JSON.stringify([{product_id:newId, qty}])
    });
    // If temp storage path, rename to proper product ID
    if (_apPendingFile && imgUrl) {
      try {
        var ext2 = (_apPendingFile.name.split('.').pop()||'jpg').toLowerCase();
        var blob = await fetch(imgUrl).then(r=>r.blob());
        var finalUrl = await uploadToStorage(blob, newId, ext2);
        var photos = JSON.parse(localStorage.getItem('rawaj_photos')||'{}');
        photos[newId] = finalUrl;
        localStorage.setItem('rawaj_photos', JSON.stringify(photos));
        await sbFetch(SB_URL + '/rest/v1/rawaj_photos', {
          method:'POST', headers:Object.assign({},SB_HDRS,{'Prefer':'resolution=merge-duplicates'}),
          body:JSON.stringify([{product_id:newId, url:finalUrl}])
        });
      } catch(e) { console.warn('Image rename failed:', e); }
    }
    showToast('Product added successfully!');
    closeAddProduct();
    await loadFromSupabase();
  }
  btn.disabled = false; btn.innerHTML = '<i class="fa fa-plus"></i>&nbsp; Add Product';
}
// ── DELETE & TRASH SYSTEM ────────────────────────────────────────────────────
const _DELETED_TTL = 60 * 24 * 60 * 60 * 1000; // 60 days

function getDeletedProducts() {
  try {
    const raw = JSON.parse(localStorage.getItem('rawaj_deleted') || '[]');
    const cutoff = Date.now() - _DELETED_TTL;
    const valid = raw.filter(function(d){ return d.deletedAt > cutoff; });
    if (valid.length !== raw.length) localStorage.setItem('rawaj_deleted', JSON.stringify(valid));
    return valid;
  } catch(e) { return []; }
}
function saveDeletedProducts(list) { localStorage.setItem('rawaj_deleted', JSON.stringify(list)); }

async function deleteProduct(id, isBase) {
  if (!confirm('Delete this product? It moves to the Deleted tab for 60 days — you can restore it any time.')) return;
  const prod = getAllAdminProducts().find(function(p){ return p.id===id; });
  if (!prod) return;
  // Save snapshot to deleted list
  const deleted = getDeletedProducts().filter(function(d){ return d.id!==id; });
  deleted.push({ id:prod.id, name:prod.name, cat:prod.cat, price:prod.price, img:prod.img, isBase:prod.isBase, deletedAt:Date.now() });
  saveDeletedProducts(deleted);
  if (isBase) {
    const { error } = await sbFetch(SB_URL + '/rest/v1/rawaj_hidden', {
      method:'POST', headers: Object.assign({},SB_HDRS,{'Prefer':'resolution=ignore-duplicates'}),
      body:JSON.stringify({ product_id: id })
    });
    if (error) console.warn('Hide on delete failed:', error);
    _hiddenBaseIds.add(id);
  } else {
    await Promise.all([
      sbFetch(SB_URL + '/rest/v1/rawaj_products?id=eq.' + id,       { method:'DELETE', headers:SB_HDRS }),
      sbFetch(SB_URL + '/rest/v1/rawaj_stock?product_id=eq.' + id,  { method:'DELETE', headers:SB_HDRS }),
      sbFetch(SB_URL + '/rest/v1/rawaj_photos?product_id=eq.' + id, { method:'DELETE', headers:SB_HDRS })
    ]);
  }
  showToast('Deleted — restore from Deleted tab within 60 days');
  await loadFromSupabase();
}

async function restoreProduct(id, isBase) {
  if (!confirm('Restore this product back to inventory?')) return;
  const deleted = getDeletedProducts();
  const entry = deleted.find(function(d){ return d.id===id; });
  if (!entry) { showToast('Product not found'); return; }
  if (isBase) {
    const { error } = await sbFetch(SB_URL + '/rest/v1/rawaj_hidden?product_id=eq.' + id, { method:'DELETE', headers:SB_HDRS });
    if (error) { showToast('Restore failed: ' + error); return; }
    _hiddenBaseIds.delete(id);
  } else {
    const { error } = await sbFetch(SB_URL + '/rest/v1/rawaj_products', {
      method:'POST', headers:Object.assign({},SB_HDRS,{'Prefer':'return=representation'}),
      body:JSON.stringify([{ name:entry.name, category:entry.cat, price:entry.price, img_url:entry.img||'', hidden:false }])
    });
    if (error) { showToast('Restore failed: ' + error); return; }
  }
  saveDeletedProducts(deleted.filter(function(d){ return d.id!==id; }));
  showToast('Product restored to inventory!');
  await loadFromSupabase();
  renderDeletedTab();
}

function permanentDelete(id) {
  if (!confirm('Permanently remove this product? This CANNOT be undone.')) return;
  saveDeletedProducts(getDeletedProducts().filter(function(d){ return d.id!==id; }));
  renderDeletedTab();
  showToast('Permanently removed');
}

function renderDeletedTab() {
  const body = document.getElementById('deletedBody');
  if (!body) return;
  const deleted = getDeletedProducts().slice().sort(function(a,b){ return b.deletedAt-a.deletedAt; });
  const photos  = JSON.parse(localStorage.getItem('rawaj_photos')||'{}');
  if (!deleted.length) {
    body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:48px;color:#aaa">' +
      '<i class="fa fa-trash" style="font-size:36px;display:block;margin-bottom:12px;color:#ddd"></i>' +
      '<div style="font-size:14px;font-weight:700;margin-bottom:4px">No deleted products</div>' +
      '<div style="font-size:12px">Products deleted in the last 60 days appear here and can be restored.</div></td></tr>';
    return;
  }
  body.innerHTML = deleted.map(function(d) {
    const thumb    = photos[d.id] || d.img || ('https://picsum.photos/seed/dhow'+d.id+'/80/80');
    const daysAgo  = Math.floor((Date.now()-d.deletedAt)/(24*60*60*1000));
    const daysLeft = 60 - daysAgo;
    const dateStr  = new Date(d.deletedAt).toLocaleDateString('en-KW',{day:'numeric',month:'short',year:'numeric'});
    const urgency  = daysLeft<=7?'var(--red)':daysLeft<=14?'var(--yellow)':'var(--gray)';
    return '<tr>' +
      '<td style="color:#aaa;font-size:11px;font-weight:700">#'+d.id+'</td>' +
      '<td><div style="display:flex;align-items:center;gap:11px">' +
        '<img src="'+thumb+'" style="width:42px;height:42px;border-radius:7px;object-fit:cover;border:1px solid #e0e0e0;filter:grayscale(70%)" onerror="this.style.opacity=0.2" />' +
        '<div><div style="font-weight:700;color:#888;font-size:13px">'+encodeHtml(d.name)+'</div>' +
        '<div style="font-size:10px;color:#aaa">'+getProductSku(d.id)+'&nbsp;&bull;&nbsp;'+(d.isBase?'Built-in':'Custom')+'</div></div>' +
      '</div></td>' +
      '<td><span class="cat-pill" style="opacity:0.5">'+((d.cat||'').replace('-',' '))+'</span></td>' +
      '<td style="font-weight:700;color:#aaa">'+d.price.toFixed(3)+'</td>' +
      '<td>' +
        '<div style="font-size:12px;font-weight:700;color:#666">'+dateStr+'</div>' +
        '<div style="font-size:10px;font-weight:700;color:'+urgency+'">'+daysLeft+' day'+(daysLeft!==1?'s':'')+' left</div>' +
      '</td>' +
      '<td>' +
        '<button class="act-btn" style="color:var(--green);border-color:var(--green);margin-right:4px" onclick="restoreProduct('+d.id+','+d.isBase+')"><i class="fa fa-undo"></i> Restore</button>' +
        '<button class="del-btn" onclick="permanentDelete('+d.id+')" title="Delete permanently"><i class="fa fa-times"></i></button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

// â”€â”€ CSV / EXCEL IMPORT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let _csvParsedRows = [];
let _csvImageMap   = {}; // filename (lowercase) → compressed base64 data URL (CSV fallback)
let _rowImageMap   = {}; // row index (0 = first data row) → base64 data URL (Excel embedded)
function openCSV() {
  _csvParsedRows = [];
  _csvImageMap   = {};
  _rowImageMap   = {};
  document.getElementById('csvFile').value   = '';
  document.getElementById('csvImages').value = '';
  document.getElementById('csvPreview').innerHTML    = '';
  document.getElementById('csvImgThumbs').innerHTML  = '';
  document.getElementById('csvImportBtn').style.display = 'none';
  document.getElementById('csvOverlay').classList.add('open');
}
function closeCSV() { document.getElementById('csvOverlay').classList.remove('open'); }
function showFormatHelp() { document.getElementById('helpOverlay').classList.add('open'); }
function closeHelp()      { document.getElementById('helpOverlay').classList.remove('open'); }

function handleCSVDrop(e) {
  e.preventDefault();
  document.getElementById('csvDrop').classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (file) processCSVFile(file);
}
function handleCSVFile(e) {
  const file = e.target.files[0];
  if (file) processCSVFile(file);
}

// ── CSV IMAGE UPLOAD ───────────────────────────────────────────────────────
function handleCSVImages(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  const thumbs = document.getElementById('csvImgThumbs');
  files.forEach(function(file) {
    _compressCSVImage(file, function(dataUrl) {
      const key = file.name.toLowerCase();
      _csvImageMap[key] = dataUrl;
      // Show thumbnail
      var img = document.createElement('img');
      img.src = dataUrl;
      img.className = 'csv-img-thumb';
      img.title = file.name;
      thumbs.appendChild(img);
    });
  });
}
function _compressCSVImage(file, callback) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var image = new Image();
    image.onload = function() {
      var MAX = 700;
      var w = image.width, h = image.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(image, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', 0.82));
    };
    image.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function processCSVFile(file) {
  const isCSV = file.name.toLowerCase().endsWith('.csv');
  const reader = new FileReader();
  reader.onload = async function(ev) {
    try {
      let rows;
      if (isCSV) {
        rows = parseCSVText(ev.target.result);
        previewCSVRows(rows);
      } else {
        if (typeof XLSX === 'undefined') { showToast('Excel support loading — try again'); return; }
        const arrayBuf = ev.target.result;
        // ── Extract embedded images from the xlsx zip structure ──────────
        _rowImageMap = {};
        if (typeof JSZip !== 'undefined') {
          try {
            const zip = await JSZip.loadAsync(arrayBuf);
            const drawingFile = zip.file('xl/drawings/drawing1.xml');
            const relsFile    = zip.file('xl/drawings/_rels/drawing1.xml.rels');
            if (drawingFile && relsFile) {
              const drawXml = await drawingFile.async('text');
              const relsXml = await relsFile.async('text');
              // Build rId → media path map from rels
              const ridToPath = {};
              const relRe = /Id=”(rId\d+)”[^>]+Target=”([^”]+)”/g;
              let m;
              while ((m = relRe.exec(relsXml)) !== null) {
                ridToPath[m[1]] = m[2].replace(/^\.\.\//,'xl/');
              }
              // Find each anchor: get the from-row and the rId
              const anchorRe = /<xdr:(?:twoCellAnchor|oneCellAnchor)[\s\S]*?<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g;
              const rowRe    = /<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/;
              const ridRe    = /r:embed=”(rId\d+)”/;
              let anchor;
              while ((anchor = anchorRe.exec(drawXml)) !== null) {
                const rm = rowRe.exec(anchor[0]);
                const rr = ridRe.exec(anchor[0]);
                if (rm && rr) {
                  const excelRow  = parseInt(rm[1]); // 0-indexed; row 0 = header, row 1 = first data row
                  const dataIndex = excelRow - 1;    // convert to 0-based data index
                  if (dataIndex >= 0) {
                    const mediaPath = ridToPath[rr[1]];
                    const imgFile   = mediaPath && zip.file(mediaPath);
                    if (imgFile) {
                      const b64  = await imgFile.async('base64');
                      const ext  = mediaPath.split('.').pop().toLowerCase();
                      const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
                      // Compress via canvas
                      _rowImageMap[dataIndex] = await _compressB64Image('data:'+mime+';base64,'+b64);
                    }
                  }
                }
              }
            }
          } catch(imgErr) { console.warn('Image extraction skipped:', imgErr); }
        }
        // ── Parse cell data ───────────────────────────────────────────────
        const wb  = XLSX.read(new Uint8Array(arrayBuf), {type:'array'});
        const ws  = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, {defval:''});
        rows = raw.map(function(r) {
          const out = {};
          Object.keys(r).forEach(function(k){ out[k.toLowerCase().trim().replace(/\s+/g,'_')] = String(r[k]); });
          return out;
        });
        const imgCount = Object.keys(_rowImageMap).length;
        if (imgCount) showToast('✅ Found ' + imgCount + ' embedded image' + (imgCount!==1?'s':'') + ' in Excel');
        previewCSVRows(rows);
      }
    } catch(err) { showToast('Parse error: ' + err.message); }
  };
  isCSV ? reader.readAsText(file) : reader.readAsArrayBuffer(file);
}

// Compress a base64 data URL via canvas (reused for both upload and Excel extraction)
function _compressB64Image(dataUrl) {
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload = function() {
      var MAX = 700, w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h*MAX/w); w = MAX; }
        else { w = Math.round(w*MAX/h); h = MAX; }
      }
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = function() { resolve(dataUrl); }; // fallback: keep original
    img.src = dataUrl;
  });
}
function parseCSVText(text) {
  const lines = text.split(/\r?\n/).map(function(l){return l.trim();}).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map(function(h){return h.trim().toLowerCase().replace(/['"]/g,'').replace(/\s+/g,'_');});
  return lines.slice(1).map(function(line) {
    const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) || line.split(',');
    const obj  = {};
    headers.forEach(function(h,i){ obj[h] = (vals[i]||'').trim().replace(/^"|"$/g,''); });
    return obj;
  });
}
function previewCSVRows(rows) {
  _csvParsedRows = rows.filter(function(r){ return r.name && r.category && r.price && !isNaN(parseFloat(r.price)); });
  const preview = document.getElementById('csvPreview');
  if (!_csvParsedRows.length) {
    preview.innerHTML = '<div style="color:var(--red);font-size:13px;padding:10px 0"><i class="fa fa-exclamation-triangle"></i> No valid rows found. Make sure columns are named: name, category, price</div>';
    document.getElementById('csvImportBtn').style.display = 'none';
    return;
  }
  const show = _csvParsedRows.slice(0,5);
  const hasEmbedded  = Object.keys(_rowImageMap).length > 0;
  const hasNamed     = show.some(function(r){ return (r.image||r.img||'').trim(); });
  const showImgCol   = hasEmbedded || hasNamed;
  const embeddedNote = hasEmbedded
    ? '<div style="background:rgba(147,51,234,.08);border:1px solid #c084fc;border-radius:8px;padding:9px 14px;font-size:12px;font-weight:700;color:#6b21a8;margin-bottom:10px;display:flex;align-items:center;gap:8px"><i class="fa fa-check-circle" style="color:#9333ea"></i> '+Object.keys(_rowImageMap).length+' image'+(Object.keys(_rowImageMap).length!==1?'s':'')+' extracted from Excel — they will be saved automatically on import</div>'
    : '';
  preview.innerHTML = embeddedNote +
    '<div class="csv-count"><i class="fa fa-check-circle"></i> '+_csvParsedRows.length+' product'+(+_csvParsedRows.length!==1?'s':'')+' ready to import</div>' +
    '<table class="csv-prev-tbl"><thead><tr>'+(showImgCol?'<th>Image</th>':'')+'<th>Name</th><th>Category</th><th>Price KWD</th><th>Stock</th></tr></thead><tbody>' +
    show.map(function(r, i){
      var imgCell = '';
      if (showImgCol) {
        var src = _rowImageMap[i] || (_csvImageMap[(r.image||r.img||'').trim().toLowerCase()]) || '';
        imgCell = src
          ? '<td><img src="'+src+'" style="width:36px;height:36px;border-radius:5px;object-fit:cover;border:1px solid #e9d5ff" /></td>'
          : '<td style="color:#ccc;font-size:11px">—</td>';
      }
      return '<tr>'+imgCell+'<td>'+r.name+'</td><td>'+r.category+'</td><td>'+parseFloat(r.price).toFixed(3)+'</td><td>'+(r.stock||'50')+'</td></tr>';
    }).join('') +
    (_csvParsedRows.length>5 ? '<tr><td colspan="'+(showImgCol?5:4)+'" style="text-align:center;color:#aaa;font-style:italic">… and '+(_csvParsedRows.length-5)+' more</td></tr>' : '') +
    '</tbody></table>';
  document.getElementById('csvImportBtn').style.display = 'flex';
}
async function importCSVProducts() {
  if (!_csvParsedRows.length) return;
  const btn = document.getElementById('csvImportBtn');
  btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Importing…';
  let count = 0;
  // Load existing localStorage photos map
  let localPhotos = {};
  try { localPhotos = JSON.parse(localStorage.getItem('rawaj_photos') || '{}'); } catch(_) {}

  for (let i = 0; i < _csvParsedRows.length; i++) {
    const r = _csvParsedRows[i];
    // Resolve image: 1) Excel embedded image (by row index), 2) manually uploaded file (by filename), 3) URL column
    const embeddedImg = _rowImageMap[i] || '';
    const imgFilename = (r.image || r.img || '').trim().toLowerCase();
    const namedImg    = imgFilename && _csvImageMap[imgFilename] ? _csvImageMap[imgFilename] : '';
    const imgDataUrl  = embeddedImg || namedImg;
    const imgUrl      = imgDataUrl || r.image_url || r.img_url || '';

    const { data: rows, error } = await sbFetch(SB_URL + '/rest/v1/rawaj_products', {
      method:'POST', headers:Object.assign({},SB_HDRS,{'Prefer':'return=representation'}),
      body:JSON.stringify([{
        name: r.name, category: r.category,
        price: parseFloat(r.price)||0,
        description: r.description||r.desc||'',
        badge: r.badge||null,
        img_url: imgUrl,
        hidden: false
      }])
    });
    if (error) { console.warn('Row import failed:', r.name, error); continue; }
    if (rows && rows[0]) {
      const newId = rows[0].id;
      const qty   = parseInt(r.stock)||50;
      stockData[newId] = qty;
      await sbFetch(SB_URL + '/rest/v1/rawaj_stock', {
        method:'POST', headers:Object.assign({},SB_HDRS,{'Prefer':'resolution=merge-duplicates'}),
        body:JSON.stringify([{product_id:newId, qty}])
      });
      // Save image to localStorage photos store (so storefront picks it up offline too)
      if (imgDataUrl) {
        localPhotos[String(newId)] = imgDataUrl;
        // Also save to Supabase photos table
        sbFetch(SB_URL + '/rest/v1/rawaj_photos', {
          method:'POST', headers:Object.assign({},SB_HDRS,{'Prefer':'resolution=merge-duplicates'}),
          body:JSON.stringify([{product_id:newId, url:imgDataUrl}])
        });
      }
      count++;
    }
  }
  // Persist photos to localStorage
  localStorage.setItem('rawaj_photos', JSON.stringify(localPhotos));
  const imgCount = Object.keys(_rowImageMap).length || Object.keys(_csvImageMap).length;
  showToast(count + ' product'+(count!==1?'s':'')+' imported' + (imgCount ? ' with '+imgCount+' image'+(imgCount!==1?'s':'') : '') + '! ✅');
  closeCSV();
  await loadFromSupabase();
  btn.disabled = false; btn.innerHTML = '<i class="fa fa-download"></i> Import All Products';
}
function downloadTemplate() {
  const csv = [
    'name,category,price,stock,description,badge,image',
    'Shataffa Sprayer Pro,shataffa,12.500,50,20V drill with keyless chuck and LED light,Best Seller,drill.jpg',
    'Heavy Duty Hammer,hand-tools,3.200,100,16oz forged steel claw hammer,,hammer.jpg',
    'Wood Screws 200pc,fasteners,1.500,200,Self-tapping wood screws assorted sizes,Popular,screws.jpg'
  ].join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'rawaj_import_template.csv';
  a.click();
}

// â”€â”€ TOAST â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function showToast(msg) {
  document.getElementById('toastMsg').textContent = msg||'Saved!';
  const t = document.getElementById('toast');
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 2500);
}

// â”€â”€ CATEGORY MANAGEMENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DEFAULT_CATS moved to top of script

function getCustomCats() {
  return JSON.parse(localStorage.getItem('rawaj_categories') || '[]');
}
function getAllCats() {
  return [...DEFAULT_CATS, ...getCustomCats()];
}
function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function refreshCategorySelects() {
  const cats = getAllCats();
  const filterOpts = '<option value="all">All Categories</option>' +
    cats.map(c => '<option value="'+c.slug+'">'+c.label+'</option>').join('');
  document.getElementById('catFilter').innerHTML = filterOpts;

  const prodOpts = cats.map(c => '<option value="'+c.slug+'">'+c.label+'</option>').join('');
  const apCat = document.getElementById('apCat');
  if (apCat) apCat.innerHTML = prodOpts;
}
function openNewCat() {
  document.getElementById('newCatInput').value = '';
  document.getElementById('newCatSlug').textContent = 'â€”';
  renderCatChips();
  document.getElementById('newcatOverlay').classList.add('open');
  setTimeout(function(){ document.getElementById('newCatInput').focus(); }, 100);
}
function closeNewCat() { document.getElementById('newcatOverlay').classList.remove('open'); }
function updateSlugPreview() {
  const val = document.getElementById('newCatInput').value;
  document.getElementById('newCatSlug').textContent = val ? slugify(val) : 'â€”';
}
function renderCatChips() {
  const custom = getCustomCats();
  const defaultHtml = DEFAULT_CATS.map(c =>
    '<div class="cat-chip default-cat"><i class="fa fa-lock" style="font-size:9px"></i> '+c.label+'</div>'
  ).join('');
  const customHtml = custom.map(c =>
    '<div class="cat-chip">'+c.label+
    ' <button class="del-cat" onclick="deleteCustomCat(\''+c.slug+'\')"><i class="fa fa-times"></i></button></div>'
  ).join('');
  document.getElementById('catChips').innerHTML = defaultHtml + customHtml;
}
function saveNewCat() {
  const name = document.getElementById('newCatInput').value.trim();
  if (!name) { showToast('Enter a category name'); return; }
  const slug = slugify(name);
  const all = getAllCats();
  if (all.find(c => c.slug === slug)) { showToast('Category already exists'); return; }
  const custom = getCustomCats();
  custom.push({ slug, label: name });
  localStorage.setItem('rawaj_categories', JSON.stringify(custom));
  document.getElementById('newCatInput').value = '';
  document.getElementById('newCatSlug').textContent = 'â€”';
  renderCatChips();
  refreshCategorySelects();
  showToast('Category "' + name + '" added!');
}
function deleteCustomCat(slug) {
  if (!confirm('Delete this category? Products using it won\'t be affected.')) return;
  const custom = getCustomCats().filter(c => c.slug !== slug);
  localStorage.setItem('rawaj_categories', JSON.stringify(custom));
  renderCatChips();
  refreshCategorySelects();
  showToast('Category deleted');
}

// â”€â”€ PHOTO EDITOR + CROP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let currentPhotoId = null;
let _cropImg = null, _cropCanvas = null, _cropCtx = null;
let _cX=0, _cY=0, _cW=0, _cH=0;         // selection in canvas coords
let _iW=0, _iH=0, _dW=0, _dH=0;          // natural size, display size
let _dragging=false, _sx=0, _sy=0;
let _croppedDataUrl = null;               // set after applyCrop, used by savePhoto
let _offscreen = null;                    // cached full-image canvas (drawn once)
let _rafPending = false;                  // requestAnimationFrame throttle flag

function openPhoto(id) {
  currentPhotoId = id;
  _croppedDataUrl = null;
  const p = getAllAdminProducts().find(function(x){ return x.id===id; });
  if (!p) return;
  const photos = JSON.parse(localStorage.getItem('rawaj_photos')||'{}');
  const src = photos[id] || p.img || '';
  document.getElementById('phProdName').textContent = '#'+id+' â€” '+p.name;
  document.getElementById('phUrlInput').value = src.startsWith('data:') ? '' : src;
  document.getElementById('cropSection').classList.remove('show');
  document.getElementById('cropLockedBadge').classList.remove('show');
  showPreview(src);
  document.getElementById('photoOverlay').classList.add('open');
}
function closePhoto() {
  document.getElementById('photoOverlay').classList.remove('open');
  currentPhotoId = null; _croppedDataUrl = null; _pendingFile = null;
  document.getElementById('phFileInput').value = '';
}
function showPreview(src) {
  const img = document.getElementById('phPreviewImg');
  const fb  = document.getElementById('phFallback');
  img.style.display='block'; fb.style.display='none';
  img.src = src;
  // auto-init crop once image loads
  img.onload = function() { initCrop(src); };
  img.onerror = function() { document.getElementById('cropSection').classList.remove('show'); };
}
function previewUrl() {
  const u = document.getElementById('phUrlInput').value.trim();
  if (u) { _croppedDataUrl=null; document.getElementById('cropLockedBadge').classList.remove('show'); showPreview(u); }
}
let _pendingFile = null;   // actual File object for Supabase Storage upload

function handleUpload(e) {
  const file = e.target.files[0]; if (!file) return;
  _pendingFile = file;
  _croppedDataUrl = null;
  const reader = new FileReader();
  reader.onload = function(ev) {
    document.getElementById('cropLockedBadge').classList.remove('show');
    document.getElementById('phUrlInput').value = '';
    showPreview(ev.target.result);   // base64 used for preview/crop only
  };
  reader.readAsDataURL(file);
}

// Helper: convert base64 data URL â†’ Blob (for cropped images)
function dataURLtoBlob(dataURL) {
  const arr = dataURL.split(','), mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]); let n = bstr.length;
  const u8 = new Uint8Array(n);
  while (n--) u8[n] = bstr.charCodeAt(n);
  return new Blob([u8], { type: mime });
}

// Convert Blob/File to base64 data URL (no storage bucket required)
async function uploadToStorage(fileOrBlob, productId, ext) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(e) { resolve(e.target.result); };
    reader.onerror = function() { reject(new Error("Image read failed")); };
    reader.readAsDataURL(fileOrBlob);
  });
}

// â”€â”€ CROP ENGINE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function initCrop(src) {
  const section = document.getElementById('cropSection');
  const canvas  = document.getElementById('cropCanvas');
  const wrap    = document.getElementById('cropWrap');
  _cropCanvas = canvas;
  _cropCtx    = canvas.getContext('2d');
  _cropImg    = null;
  _offscreen  = null;
  _rafPending = false;

  // Show section FIRST so wrap.clientWidth is measurable
  section.classList.add('show');

  const tempImg = new Image();
  tempImg.crossOrigin = 'anonymous';
  tempImg.onload = function() {
    _cropImg = tempImg;
    _iW = tempImg.naturalWidth;
    _iH = tempImg.naturalHeight;
    const maxW = wrap.clientWidth || 480;
    const maxH = 320;
    const ratio = Math.min(maxW / _iW, maxH / _iH, 1);
    _dW = Math.round(_iW * ratio);
    _dH = Math.round(_iH * ratio);
    canvas.width  = _dW;
    canvas.height = _dH;
    _cX=0; _cY=0; _cW=_dW; _cH=_dH;

    // Cache full image into offscreen canvas — drawn once, reused every frame
    _offscreen = document.createElement('canvas');
    _offscreen.width  = _dW;
    _offscreen.height = _dH;
    _offscreen.getContext('2d').drawImage(_cropImg, 0, 0, _dW, _dH);

    _drawCrop();
    document.getElementById('cropHint').textContent = 'Drag on the image to select the area you want to keep';
  };
  tempImg.onerror = function() { section.classList.remove('show'); };
  tempImg.src = src;

  // Clean up old listeners then attach fresh ones via AbortController
  if (canvas._cropAbort) canvas._cropAbort.abort();
  const ac = new AbortController();
  canvas._cropAbort = ac;
  const sig = { signal: ac.signal };

  canvas.addEventListener('mousedown', function(e) {
    const r = canvas.getBoundingClientRect();
    _sx = e.clientX - r.left; _sy = e.clientY - r.top; _dragging = true;
  }, sig);
  canvas.addEventListener('mousemove', function(e) {
    if (!_dragging) return;
    const r = canvas.getBoundingClientRect();
    const ex = Math.max(0, Math.min(_dW, e.clientX - r.left));
    const ey = Math.max(0, Math.min(_dH, e.clientY - r.top));
    _cX = Math.min(_sx, ex); _cY = Math.min(_sy, ey);
    _cW = Math.abs(ex - _sx); _cH = Math.abs(ey - _sy);
    _scheduleDraw();
  }, sig);
  canvas.addEventListener('mouseup',    function() { _dragging = false; }, sig);
  canvas.addEventListener('mouseleave', function() { _dragging = false; }, sig);
  canvas.addEventListener('touchstart', function(e) {
    const t=e.touches[0]; const r=canvas.getBoundingClientRect();
    _sx=t.clientX-r.left; _sy=t.clientY-r.top; _dragging=true; e.preventDefault();
  }, { passive:false, signal:ac.signal });
  canvas.addEventListener('touchmove', function(e) {
    if(!_dragging) return;
    const t=e.touches[0]; const r=canvas.getBoundingClientRect();
    const ex=Math.max(0,Math.min(_dW,t.clientX-r.left));
    const ey=Math.max(0,Math.min(_dH,t.clientY-r.top));
    _cX=Math.min(_sx,ex); _cY=Math.min(_sy,ey);
    _cW=Math.abs(ex-_sx); _cH=Math.abs(ey-_sy);
    _scheduleDraw(); e.preventDefault();
  }, { passive:false, signal:ac.signal });
  canvas.addEventListener('touchend', function(){ _dragging=false; }, sig);
}

// Throttle redraws to one per animation frame — prevents mousemove flood
function _scheduleDraw() {
  if (_rafPending) return;
  _rafPending = true;
  requestAnimationFrame(function() { _rafPending = false; _drawCrop(); });
}

function _drawCrop() {
  if (!_cropImg || !_offscreen) return;
  const ctx = _cropCtx, c = _cropCanvas;
  // 1. Draw cached full image (no image decode cost per frame)
  ctx.globalAlpha = 1;
  ctx.drawImage(_offscreen, 0, 0);
  // 2. Dim everything
  ctx.globalAlpha = 0.55; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, _dW, _dH);
  ctx.globalAlpha = 1;
  // 3. Draw bright selected region from offscreen cache
  if (_cW > 2 && _cH > 2) {
    ctx.drawImage(_offscreen, _cX, _cY, _cW, _cH, _cX, _cY, _cW, _cH);
    // Border
    ctx.strokeStyle = '#1B50D8'; ctx.lineWidth = 2; ctx.setLineDash([6,3]);
    ctx.strokeRect(_cX+1, _cY+1, _cW-2, _cH-2); ctx.setLineDash([]);
    // Corner handles
    const s=8; ctx.fillStyle='#1B50D8';
    [[_cX,_cY],[_cX+_cW-s,_cY],[_cX,_cY+_cH-s],[_cX+_cW-s,_cY+_cH-s]].forEach(function(pt){
      ctx.fillRect(pt[0], pt[1], s, s);
    });
    // Size label
    const lw = Math.round((_cW/_dW)*_iW), lh = Math.round((_cH/_dH)*_iH);
    ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(_cX, _cY, 82, 18);
    ctx.fillStyle='#fff'; ctx.font='bold 11px monospace'; ctx.fillText(lw+'x'+lh, _cX+4, _cY+13);
  }
}

function applyCrop() {
  if (!_cropImg || _cW < 5 || _cH < 5) { showToast('Drag to select an area first'); return; }
  const out = document.createElement('canvas');
  const srcX = Math.round((_cX/_dW)*_iW), srcY = Math.round((_cY/_dH)*_iH);
  const srcW = Math.round((_cW/_dW)*_iW), srcH = Math.round((_cH/_dH)*_iH);
  out.width = srcW; out.height = srcH;
  out.getContext('2d').drawImage(_cropImg, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
  _croppedDataUrl = out.toDataURL('image/jpeg', 0.92);
  // Update preview image with cropped result
  document.getElementById('phPreviewImg').src = _croppedDataUrl;
  document.getElementById('cropLockedBadge').classList.add('show');
  document.getElementById('cropHint').textContent = 'Crop applied â€” click "Save Photo" to confirm';
  showToast('Crop applied!');
}

function resetCrop() {
  if (!_cropImg) return;
  _cX=0; _cY=0; _cW=_dW; _cH=_dH; _croppedDataUrl=null;
  document.getElementById('cropLockedBadge').classList.remove('show');
  document.getElementById('cropHint').textContent = 'Drag on the image to select the area you want to keep';
  document.getElementById('phPreviewImg').src = _cropImg.src;
  _drawCrop();
}

// ── MULTI-SELECT ──────────────────────────────────────────────────────────────
var _selectedIds = new Set();

function toggleSelectAll(checked) {
  var q = document.getElementById('adminSearch').value.toLowerCase();
  var cat = document.getElementById('catFilter').value;
  var list = getAllAdminProducts().filter(function(p){
    return (cat==='all'||p.cat===cat) && (!q||p.name.toLowerCase().includes(q));
  });
  list.forEach(function(p){ checked ? _selectedIds.add(p.id) : _selectedIds.delete(p.id); });
  document.querySelectorAll('.row-chk').forEach(function(c){ c.checked = checked; });
  _syncBulkBar();
}

function toggleRowSelect(id, checked) {
  checked ? _selectedIds.add(id) : _selectedIds.delete(id);
  _syncBulkBar();
  var allChks = document.querySelectorAll('.row-chk');
  var nChecked = Array.from(allChks).filter(function(c){return c.checked;}).length;
  var sa = document.getElementById('selectAll');
  if (sa) {
    sa.checked = allChks.length > 0 && nChecked === allChks.length;
    sa.indeterminate = nChecked > 0 && nChecked < allChks.length;
  }
}

function _syncBulkBar() {
  var bar = document.getElementById('bulkBar');
  var cnt = document.getElementById('bulkCount');
  if (_selectedIds.size > 0) {
    bar.classList.add('show');
    cnt.textContent = _selectedIds.size + ' selected';
  } else {
    bar.classList.remove('show');
  }
}

function clearSelection() {
  _selectedIds.clear();
  document.querySelectorAll('.row-chk').forEach(function(c){ c.checked = false; });
  var sa = document.getElementById('selectAll');
  if (sa) { sa.checked = false; sa.indeterminate = false; }
  _syncBulkBar();
}

async function bulkHide() {
  if (!_selectedIds.size) return;
  showToast('Hiding ' + _selectedIds.size + ' products…');
  for (var id of _selectedIds) {
    var p = getAllAdminProducts().find(function(x){return x.id===id;});
    if (!p || p.hidden) continue;
    if (p.isBase) {
      await sbFetch(SB_URL+'/rest/v1/rawaj_hidden',{method:'POST',headers:Object.assign({},SB_HDRS,{'Prefer':'resolution=merge-duplicates'}),body:JSON.stringify([{product_id:id,hidden:true}])});
      _hiddenBaseIds.add(id);
    } else {
      await sbFetch(SB_URL+'/rest/v1/rawaj_products?id=eq.'+id,{method:'PATCH',headers:SB_HDRS,body:JSON.stringify({hidden:true})});
      var row=_customProductRows.find(function(r){return r.id===id;}); if(row) row.hidden=true;
    }
  }
  showToast(_selectedIds.size+' products hidden');
  clearSelection(); renderTable();
}

async function bulkShow() {
  if (!_selectedIds.size) return;
  showToast('Showing ' + _selectedIds.size + ' products…');
  for (var id of _selectedIds) {
    var p = getAllAdminProducts().find(function(x){return x.id===id;});
    if (!p || !p.hidden) continue;
    if (p.isBase) {
      await sbFetch(SB_URL+'/rest/v1/rawaj_hidden?product_id=eq.'+id,{method:'DELETE',headers:SB_HDRS});
      _hiddenBaseIds.delete(id);
    } else {
      await sbFetch(SB_URL+'/rest/v1/rawaj_products?id=eq.'+id,{method:'PATCH',headers:SB_HDRS,body:JSON.stringify({hidden:false})});
      var row=_customProductRows.find(function(r){return r.id===id;}); if(row) row.hidden=false;
    }
  }
  showToast(_selectedIds.size+' products now visible');
  clearSelection(); renderTable();
}

function bulkClearStock() {
  if (!_selectedIds.size) return;
  if (!confirm('Clear stock for '+_selectedIds.size+' selected products?')) return;
  _pushUndo();
  _selectedIds.forEach(function(id){ stockData[id]=0; });
  showToast('Stock cleared for '+_selectedIds.size+' products');
  clearSelection(); renderTable(); renderStats();
}

function bulkAddStock() {
  if (!_selectedIds.size) return;
  _pushUndo();
  _selectedIds.forEach(function(id){
    var cur=stockData[id]||0; stockData[id]=Math.ceil((cur+1)/50)*50;
  });
  showToast('+50 added to '+_selectedIds.size+' products');
  clearSelection(); renderTable(); renderStats();
}

async function bulkDelete() {
  if (!_selectedIds.size) return;
  if (!confirm('Delete '+_selectedIds.size+' selected products? They move to the Deleted tab.')) return;
  for (var id of _selectedIds) {
    var p=getAllAdminProducts().find(function(x){return x.id===id;}); if(!p) continue;
    var deleted=getDeletedProducts().filter(function(d){return d.id!==id;});
    deleted.push({id:p.id,name:p.name,cat:p.cat,price:p.price,img:p.img,isBase:p.isBase,deletedAt:Date.now()});
    saveDeletedProducts(deleted);
    if (p.isBase) {
      await sbFetch(SB_URL+'/rest/v1/rawaj_hidden',{method:'POST',headers:Object.assign({},SB_HDRS,{'Prefer':'resolution=ignore-duplicates'}),body:JSON.stringify({product_id:id})});
      _hiddenBaseIds.add(id);
    } else {
      await Promise.all([
        sbFetch(SB_URL+'/rest/v1/rawaj_products?id=eq.'+id,{method:'DELETE',headers:SB_HDRS}),
        sbFetch(SB_URL+'/rest/v1/rawaj_stock?product_id=eq.'+id,{method:'DELETE',headers:SB_HDRS})
      ]);
    }
  }
  showToast(_selectedIds.size+' products deleted');
  clearSelection(); await loadFromSupabase();
}

// ── MULTI-CATEGORY ────────────────────────────────────────────────────────────
var _mcCurrentId = null;

function getExtraCats(id) {
  try {
    var map=JSON.parse(localStorage.getItem('rawaj_multi_cats')||'{}');
    return Array.isArray(map[String(id)]) ? map[String(id)] : [];
  } catch(e){ return []; }
}
function saveExtraCats(id, cats) {
  try {
    var map=JSON.parse(localStorage.getItem('rawaj_multi_cats')||'{}');
    map[String(id)]=cats;
    localStorage.setItem('rawaj_multi_cats',JSON.stringify(map));
  } catch(e){}
}
function getProductCatSlugs(p) {
  var primary = p.cat||'';
  var extra   = getExtraCats(p.id);
  var all     = [primary].concat(extra.filter(function(c){return c!==primary;})).filter(Boolean);
  return all.filter(function(v,i,a){return a.indexOf(v)===i;}); // unique
}

function openMC(id) {
  _mcCurrentId = id;
  var p = getAllAdminProducts().find(function(x){return x.id===id;});
  if (!p) return;
  document.getElementById('mcProdName').textContent = '#'+id+' — '+p.name;
  var assigned = getProductCatSlugs(p);
  var html = getAllCats().map(function(c){
    var isCk      = assigned.includes(c.slug);
    var isPrimary = c.slug === p.cat;
    return '<div class="mc-cat-row'+(isCk?' mc-selected':'')+'" onclick="mcRowClick(this,\''+c.slug+'\','+isPrimary+')">' +
      '<input type="checkbox" value="'+c.slug+'"'+(isCk?' checked':'')+(isPrimary?' data-primary="1"':'')+' onclick="event.stopPropagation()" onchange="mcChkChange(this,'+isPrimary+')" />' +
      '<span class="mc-lbl">'+c.label+'</span>' +
      (isPrimary ? '<span class="mc-primary-tag">primary</span>' : '') +
    '</div>';
  }).join('');
  document.getElementById('mcCatsList').innerHTML = html;
  document.getElementById('mcOverlay').classList.add('open');
}
function closeMC() {
  document.getElementById('mcOverlay').classList.remove('open');
  _mcCurrentId = null;
}
function mcRowClick(row, slug, isPrimary) {
  var chk = row.querySelector('input[type="checkbox"]');
  if (isPrimary && chk.checked) return; // can't remove primary
  chk.checked = !chk.checked;
  row.classList.toggle('mc-selected', chk.checked);
}
function mcChkChange(chk, isPrimary) {
  if (isPrimary && !chk.checked) { chk.checked = true; return; }
  chk.closest('.mc-cat-row').classList.toggle('mc-selected', chk.checked);
}
function saveMC() {
  if (!_mcCurrentId) return;
  var cats = Array.from(document.querySelectorAll('#mcCatsList input[type="checkbox"]:checked'))
    .map(function(c){return c.value;});
  saveExtraCats(_mcCurrentId, cats);
  showToast('Categories updated!');
  closeMC();
  renderTable();
}

async function savePhoto() {
  if (!currentPhotoId) return;

  const inputUrl    = document.getElementById('phUrlInput').value.trim();
  const hasCrop     = !!_croppedDataUrl;
  const hasFile     = !!_pendingFile;
  const previewSrc  = document.getElementById('phPreviewImg').src;

  // Nothing was changed
  if (!inputUrl && !hasCrop && !hasFile && (!previewSrc || previewSrc === window.location.href)) {
    closePhoto(); return;
  }

  let finalUrl = null;

  // Case 1: URL was pasted â€” use it directly
  if (inputUrl && !hasCrop && !hasFile) {
    finalUrl = inputUrl;
  }
  // Case 2: File uploaded + crop applied â†’ upload cropped blob to Storage
  else if (hasCrop) {
    showToast('Uploadingâ€¦');
    try {
      const blob = dataURLtoBlob(_croppedDataUrl);
      finalUrl   = await uploadToStorage(blob, currentPhotoId, 'jpg');
    } catch(e) {
      showToast('Upload failed: ' + e.message);
      return;
    }
  }
  // Case 3: File uploaded (no crop) â†’ upload raw file to Storage
  else if (hasFile) {
    showToast('Uploadingâ€¦');
    try {
      const ext  = (_pendingFile.name.split('.').pop() || 'jpg').toLowerCase();
      finalUrl   = await uploadToStorage(_pendingFile, currentPhotoId, ext);
    } catch(e) {
      showToast('Upload failed: ' + e.message);
      return;
    }
  }
  // Fallback: use whatever is in the preview
  else {
    finalUrl = previewSrc;
  }

  if (!finalUrl) return;

  // Save URL to localStorage + thumbnail
  const photos = JSON.parse(localStorage.getItem('rawaj_photos')||'{}');
  photos[currentPhotoId] = finalUrl;
  localStorage.setItem('rawaj_photos', JSON.stringify(photos));
  const th = document.getElementById('thumb'+currentPhotoId);
  if (th) th.src = finalUrl;

  // Save URL to Supabase rawaj_photos table
  const { error: dbErr } = await sbFetch(SB_URL + '/rest/v1/rawaj_photos', {
    method: 'POST',
    headers: Object.assign({}, SB_HDRS, { 'Prefer': 'resolution=merge-duplicates' }),
    body: JSON.stringify([{ product_id: currentPhotoId, url: finalUrl }])
  });
  if (dbErr) console.warn('Photo DB save failed:', dbErr);

  _pendingFile = null;
  closePhoto();
  showToast('Photo saved!');
}
