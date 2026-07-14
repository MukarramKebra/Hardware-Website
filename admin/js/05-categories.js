// ── CATEGORY EDITOR ────────────────────────────────────────────────────────────
// CAT_DEFS = the list of categories with their name, icon, and default background image.
// renderCatEditor() draws the grid of category cards in the Categories tab.
// saveCatBg()  — saves a new background image when you click "Change Image"
// resetCatBg() — puts the default image back
var CAT_DEFS = [
  { slug:'tools',            label:'DCK Power Tools', icon:'fa-bolt',         default:'cat-images/tools.jpg' },
  { slug:'hand-tools',       label:'Hand Tools',      icon:'fa-hammer',       default:'cat-images/hand-tools.png' },
  { slug:'fastener',         label:'Fasteners',       icon:'fa-cog',          default:'cat-images/fastener.png' },
  { slug:'construction',     label:'Nails/Wires',     icon:'fa-thumbtack',    default:'cat-images/construction.png' },
  { slug:'safety',           label:'Safety',          icon:'fa-hard-hat',     default:'cat-images/safety.jpg' },
  { slug:'spray-adhesive',   label:'Adhesives',       icon:'fa-spray-can',    default:'cat-images/spray-adhesive.png' },
  { slug:'tape',             label:'Tapes',           icon:'fa-tape',         default:'cat-images/tape.png' },
  { slug:'door-handle',      label:'Door Handles',    icon:'fa-door-open',    default:'cat-images/door-handle.png' },
  { slug:'hardware',         label:'Hardware',        icon:'fa-toolbox',      default:'cat-images/hardware.png' },
  { slug:'paint-tool',       label:'Paint Tools',     icon:'fa-paint-roller', default:'cat-images/paint-tool.jpg' },
  { slug:'gardening',        label:'Garden Tools',    icon:'fa-seedling',     default:'cat-images/gardening.png' },
  { slug:'disc',             label:'Discs',           icon:'fa-compact-disc', default:'cat-images/disc.jpg' },
  { slug:'trolley-caster',   label:'Wheel Barrow',    icon:'fa-dolly',        default:'cat-images/trolley-caster.png' },
  { slug:'household',        label:'Cleaning',        icon:'fa-broom',        default:'cat-images/household.png' },
  { slug:'plumbing-fitting', label:'Fittings',        icon:'fa-wrench',       default:'cat-images/plumbing-fitting.png' },
  { slug:'sanitary',         label:'Sanitary Ware',   icon:'fa-shower',       default:'cat-images/sanitary.png' },
  { slug:'filter',           label:'Filters',         icon:'fa-filter',       default:'cat-images/filter.png' },
  { slug:'all',              label:'All Products',    icon:'fa-th-large',     default:'Bahar-Products/SKU-0015.jpg' }
];

function renderCatEditor() {
  var bgs = {};
  try { bgs = JSON.parse(localStorage.getItem('jain_cat_bgs') || '{}'); } catch(e) {}
  var grid = document.getElementById('catEditGrid');
  if (!grid) return;
  grid.innerHTML = CAT_DEFS.map(function(cat) {
    var img = bgs[cat.slug] || cat.default;
    return '<div style="background:#fff;border:1px solid #e2e4e8;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.07)">' +
      '<div style="height:150px;background:url(\'' + img + '\') center/cover no-repeat;position:relative">' +
        '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center">' +
          '<i class="fa ' + cat.icon + '" style="color:#fff;font-size:32px"></i>' +
        '</div>' +
      '</div>' +
      '<div style="padding:12px 14px">' +
        '<div style="font-weight:800;font-size:13px;color:#1c1c1c;margin-bottom:10px">' + cat.label + '</div>' +
        '<label style="display:block;background:var(--orange);color:#fff;text-align:center;padding:8px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700">' +
          '<i class="fa fa-image"></i> Change Image' +
          '<input type="file" accept="image/*" style="display:none" onchange="saveCatBg(\'' + cat.slug + '\',this)" />' +
        '</label>' +
        (cat.slug !== 'all'
          ? '<button onclick="openCatProducts(\'' + cat.slug + '\')" style="width:100%;margin-top:6px;background:none;border:1px solid var(--orange);border-radius:6px;padding:7px;font-size:11px;font-weight:700;color:var(--orange);cursor:pointer"><i class="fa fa-boxes"></i> Products</button>'
          : '') +
        '<button onclick="resetCatBg(\'' + cat.slug + '\')" style="width:100%;margin-top:6px;background:none;border:1px solid #e2e4e8;border-radius:6px;padding:6px;font-size:11px;color:#888;cursor:pointer"><i class="fa fa-undo"></i> Reset Default</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function saveCatBg(slug, input) {
  if (!input.files || !input.files[0]) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var bgs = {};
    try { bgs = JSON.parse(localStorage.getItem('jain_cat_bgs') || '{}'); } catch(er) {}
    bgs[slug] = e.target.result;
    localStorage.setItem('jain_cat_bgs', JSON.stringify(bgs));
    // Save to Supabase
    sbFetch(SB_URL + '/rest/v1/expert_cat_bgs', {
      method: 'POST',
      headers: Object.assign({}, SB_HDRS, { 'Prefer': 'resolution=merge-duplicates' }),
      body: JSON.stringify([{ slug: slug, img_url: e.target.result }])
    });
    showToast('Category image updated!');
    renderCatEditor();
  };
  reader.readAsDataURL(input.files[0]);
}

function resetCatBg(slug) {
  var bgs = {};
  try { bgs = JSON.parse(localStorage.getItem('jain_cat_bgs') || '{}'); } catch(e) {}
  delete bgs[slug];
  localStorage.setItem('jain_cat_bgs', JSON.stringify(bgs));
  sbFetch(SB_URL + '/rest/v1/expert_cat_bgs?slug=eq.' + slug, { method: 'DELETE', headers: SB_HDRS });
  showToast('Reset to default');
  renderCatEditor();
}

// ── SIDE BANNERS ─────────────────────────────────────────────────────────────
// loadBanners()   — fetches the current banner list from Supabase and draws it.
//                   The first time this runs with an empty table, it seeds the
//                   database with the same defaults the storefront falls back
//                   to (Banners/ folder) so they show up here as real rows you
//                   can edit or delete — otherwise there'd be nothing to manage
//                   until you added a banner yourself.
// addBanner()     — uploads a new banner (brand name + image) to Supabase
// editBanner()    — opens the edit modal for one banner
// saveEditBanner()— saves the brand name / replacement image for that banner
// deleteBanner()  — removes one banner
var _bannerList = [];
var _editBannerId = null;
var DEFAULT_BANNERS = [
  { brand: 'DCK',    img: 'Banners/dck1.jpg' },
  { brand: 'DCK',    img: 'Banners/dck2.jpg' },
  { brand: 'Covax',  img: 'Banners/covax1.jpg' },
  { brand: 'Covax',  img: 'Banners/covax2.jpg' },
  { brand: 'iTrust', img: 'Banners/itrust1.jpg' },
  { brand: 'iTrust', img: 'Banners/itrust2.jpg' },
  { brand: 'iTrust', img: 'Banners/itrust3.jpg' },
  { brand: 'iTrust', img: 'Banners/itrust4.jpg' }
];

async function loadBanners() {
  var res = await sbFetch(SB_URL + '/rest/v1/expert_banners?select=*&order=id.asc', { headers: SB_HDRS });
  var list = Array.isArray(res.data) ? res.data : [];
  if (!list.length && !res.error) {
    var seedRows = DEFAULT_BANNERS.map(function(b) { return { brand: b.brand, img_url: b.img }; });
    var seedRes = await sbFetch(SB_URL + '/rest/v1/expert_banners', {
      method: 'POST',
      headers: Object.assign({}, SB_HDRS, { 'Prefer': 'return=representation' }),
      body: JSON.stringify(seedRows)
    });
    list = Array.isArray(seedRes.data) ? seedRes.data : [];
  }
  _bannerList = list;
  renderBannerEditor();
}

function renderBannerEditor() {
  var grid = document.getElementById('bannerEditGrid');
  if (!grid) return;
  if (!_bannerList.length) {
    grid.innerHTML = '<p style="color:#aaa;font-size:12px;grid-column:1/-1">No custom banners yet — the homepage is showing the default set from the Banners folder.</p>';
    return;
  }
  grid.innerHTML = _bannerList.map(function(b) {
    return '<div style="background:#fff;border:1px solid #e2e4e8;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.07)">' +
      '<div style="height:130px;background:url(\'' + b.img_url + '\') center/cover no-repeat"></div>' +
      '<div style="padding:10px 12px">' +
        '<div style="font-weight:800;font-size:13px;color:#1c1c1c;margin-bottom:8px">' + encodeHtml(b.brand) + '</div>' +
        '<div style="display:flex;gap:6px">' +
          '<button onclick="editBanner(' + b.id + ')" style="flex:1;background:none;border:1px solid var(--border);color:var(--gray);border-radius:6px;padding:6px;font-size:11px;font-weight:700;cursor:pointer"><i class="fa fa-edit"></i> Edit</button>' +
          '<button onclick="deleteBanner(' + b.id + ')" style="flex:1;background:none;border:1px solid var(--red);color:var(--red);border-radius:6px;padding:6px;font-size:11px;font-weight:700;cursor:pointer"><i class="fa fa-trash"></i> Delete</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function addBanner() {
  var fileInput  = document.getElementById('newBannerFile');
  var brandInput = document.getElementById('newBannerBrand');
  var brand = (brandInput.value || '').trim();
  if (!brand) { showToast('Enter a brand name first'); fileInput.value = ''; return; }
  if (!fileInput.files || !fileInput.files[0]) return;
  var reader = new FileReader();
  reader.onload = async function(e) {
    var res = await sbFetch(SB_URL + '/rest/v1/expert_banners', {
      method: 'POST',
      headers: Object.assign({}, SB_HDRS, { 'Prefer': 'return=representation' }),
      body: JSON.stringify([{ brand: brand, img_url: e.target.result }])
    });
    if (res.error) { showToast('Failed to save banner'); return; }
    brandInput.value = '';
    fileInput.value  = '';
    showToast('Banner added!');
    loadBanners();
  };
  reader.readAsDataURL(fileInput.files[0]);
}

function editBanner(id) {
  var b = _bannerList.find(function(x) { return x.id === id; });
  if (!b) return;
  _editBannerId = id;
  document.getElementById('editBannerBrand').value = b.brand;
  document.getElementById('editBannerFile').value = '';
  document.getElementById('editBannerOverlay').classList.add('open');
}

function closeEditBanner() {
  document.getElementById('editBannerOverlay').classList.remove('open');
  _editBannerId = null;
}

async function saveEditBanner() {
  if (_editBannerId === null) return;
  var brand = (document.getElementById('editBannerBrand').value || '').trim();
  if (!brand) { showToast('Brand name can\'t be empty'); return; }
  var fileInput = document.getElementById('editBannerFile');

  function patch(imgUrl) {
    var body = { brand: brand };
    if (imgUrl) body.img_url = imgUrl;
    return sbFetch(SB_URL + '/rest/v1/expert_banners?id=eq.' + _editBannerId, {
      method: 'PATCH',
      headers: Object.assign({}, SB_HDRS, { 'Prefer': 'return=representation' }),
      body: JSON.stringify(body)
    });
  }

  var res;
  if (fileInput.files && fileInput.files[0]) {
    var dataUrl = await new Promise(function(resolve) {
      var reader = new FileReader();
      reader.onload = function(e) { resolve(e.target.result); };
      reader.readAsDataURL(fileInput.files[0]);
    });
    res = await patch(dataUrl);
  } else {
    res = await patch(null);
  }
  if (res.error) { showToast('Failed to save changes'); return; }
  showToast('Banner updated!');
  closeEditBanner();
  loadBanners();
}

async function deleteBanner(id) {
  if (!confirm('Delete this banner?')) return;
  await sbFetch(SB_URL + '/rest/v1/expert_banners?id=eq.' + id, { method: 'DELETE', headers: SB_HDRS });
  showToast('Banner deleted');
  loadBanners();
}

// ── CATEGORY PRODUCT MANAGER ─────────────────────────────────────────────────
// "Products" button on each category card: tick/untick products to add or
// remove them from that category. Adding puts the category in the product's
// extra-categories list; removing takes it out. If the category is a product's
// PRIMARY one, removing promotes one of its other categories to primary —
// or is skipped (with a warning) when it has no other category to fall back on.
var _cpSlug = null;
var _cpState = {};   // product id -> currently ticked (true/false)

function openCatProducts(slug) {
  _cpSlug = slug;
  _cpState = {};
  var cat = getAllCats().find(function(c){ return c.slug === slug; });
  document.getElementById('cpTitle').textContent = (cat ? cat.label : slug) + ' — Products';
  document.getElementById('cpSearch').value = '';
  getAllAdminProducts().forEach(function(p) {
    _cpState[p.id] = getProductCatSlugs(p).includes(slug);
  });
  _cpRenderList('');
  document.getElementById('catProdOverlay').classList.add('open');
  setTimeout(function(){ document.getElementById('cpSearch').focus(); }, 100);
}
function closeCatProducts() {
  document.getElementById('catProdOverlay').classList.remove('open');
  _cpSlug = null;
}
function _cpRenderList(q) {
  q = (q || '').toLowerCase();
  var rows = getAllAdminProducts().filter(function(p) {
    return !q || p.name.toLowerCase().includes(q) ||
      getProductSku(p.id).toLowerCase().includes(q) ||
      (typeof getBrand === 'function' && getBrand(p.id).toLowerCase().includes(q));
  }).map(function(p) {
    var ck = !!_cpState[p.id];
    var isPrimary = p.cat === _cpSlug;
    return '<div class="mc-cat-row' + (ck ? ' mc-selected' : '') + '" onclick="cpToggle(this,' + p.id + ')">' +
      '<input type="checkbox"' + (ck ? ' checked' : '') + ' />' +
      '<span class="mc-lbl">' + encodeHtml(p.name) + ' <span style="color:#aaa;font-weight:500;font-size:11px">' + getProductSku(p.id) + '</span></span>' +
      (isPrimary ? '<span class="mc-primary-tag">primary</span>' : '') +
    '</div>';
  }).join('');
  document.getElementById('cpList').innerHTML = rows || '<p style="color:#aaa;font-size:12px;padding:8px 2px">No products match this search.</p>';
}
function cpFilter() { _cpRenderList(document.getElementById('cpSearch').value); }
function cpToggle(row, id) {
  _cpState[id] = !_cpState[id];
  row.classList.toggle('mc-selected', _cpState[id]);
  row.querySelector('input[type="checkbox"]').checked = _cpState[id];
}
async function saveCatProducts() {
  if (!_cpSlug) return;
  var slug = _cpSlug;
  var added = 0, removed = 0, skipped = [];
  var products = getAllAdminProducts();
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var wasMember = getProductCatSlugs(p).includes(slug);
    var nowMember = !!_cpState[p.id];
    if (wasMember === nowMember) continue;

    var extras = getExtraCats(p.id).filter(function(c){ return c !== p.cat; });
    if (nowMember) {
      if (!extras.includes(slug)) extras.push(slug);
      saveExtraCats(p.id, extras);
      added++;
    } else if (p.cat === slug) {
      // Removing the product's primary category — promote another one
      var others = extras.filter(function(c){ return c !== slug; });
      if (!others.length) { skipped.push(p.name); continue; }
      var newPrimary = others[0];
      var r = await sbFetch(SB_URL + '/rest/v1/expert_products?id=eq.' + p.id, {
        method: 'PATCH', headers: SB_HDRS, body: JSON.stringify({ category: newPrimary })
      });
      if (r.error) { skipped.push(p.name); continue; }
      var row = _customProductRows.find(function(x){ return x.id === p.id; });
      if (row) row.category = newPrimary;
      saveExtraCats(p.id, others.filter(function(c){ return c !== newPrimary; }));
      removed++;
    } else {
      saveExtraCats(p.id, extras.filter(function(c){ return c !== slug; }));
      removed++;
    }
  }
  closeCatProducts();
  renderTable();
  var msg = added + ' added, ' + removed + ' removed';
  if (skipped.length) msg += ' — ' + skipped.length + ' skipped (only category: ' + skipped.slice(0,2).join(', ') + (skipped.length > 2 ? '…' : '') + ')';
  showToast(msg);
}

// ── FEATURED PRODUCTS (homepage offers strip) ────────────────────────────────
// Its own full-width tab (not a modal) so it reads like the Inventory table —
// thumbnail, name, SKU, brand, price, description — just without Inventory's
// stock/bulk-action buttons, which don't apply to picking homepage products.
// Admin picks any number of real products (no cap), each optionally with a
// Sale % that discounts its price only in the homepage strip (the product's
// real price everywhere else — cart, checkout, its own page — is untouched).
// Stored in expert_settings key 'featured_offers' as a JSON array of
// { id, sale } objects — array order is also the display order on the
// storefront, and 'sale' is the % off (0/absent = no sale).
var _foItems = []; // ordered array of { id, sale } (pending save)

function _foFind(id) { return _foItems.find(function(x) { return x.id === id; }); }
function _foOfferPrice(price, sale) { return sale > 0 ? price * (1 - sale / 100) : price; }

// ── UNDO / REDO ──────────────────────────────────────────────────────────────
// Mirrors Inventory's stock undo/redo (js/02-helpers.js): a snapshot of
// _foItems is pushed before every mutation (toggle, sale, select-all, bulk
// sale), so Ctrl+Z / Ctrl+Y or the toolbar buttons step back/forward through
// picks and prices without touching the live save until you hit Save.
var _foUndoStack = [];
var _foRedoStack = [];
function _foPushUndo() {
  _foUndoStack.push(JSON.stringify(_foItems));
  if (_foUndoStack.length > 50) _foUndoStack.shift();
  _foRedoStack = [];
  _foSyncUrBtns();
}
function _foSyncUrBtns() {
  var u = document.getElementById('foUndoBtn');
  var r = document.getElementById('foRedoBtn');
  if (u) u.disabled = _foUndoStack.length === 0;
  if (r) r.disabled = _foRedoStack.length === 0;
}
function foUndo() {
  if (!_foUndoStack.length) return;
  _foRedoStack.push(JSON.stringify(_foItems));
  _foItems = JSON.parse(_foUndoStack.pop());
  _foSyncUrBtns();
  _foUpdateCount();
  _foRenderList(document.getElementById('foSearch').value);
  showToast('Undone ↩');
}
function foRedo() {
  if (!_foRedoStack.length) return;
  _foUndoStack.push(JSON.stringify(_foItems));
  _foItems = JSON.parse(_foRedoStack.pop());
  _foSyncUrBtns();
  _foUpdateCount();
  _foRenderList(document.getElementById('foSearch').value);
  showToast('Redone ↪');
}

async function renderFeaturedTab() {
  var res = await sbFetch(SB_URL + '/rest/v1/expert_settings?key=eq.featured_offers&select=value', { headers: SB_HDRS });
  var raw = [];
  if (!res.error && Array.isArray(res.data) && res.data[0] && res.data[0].value) {
    try { raw = JSON.parse(res.data[0].value) || []; } catch(e) {}
  }
  // Older saves stored plain product ids (no sale support yet) — migrate those in-memory.
  _foItems = raw.map(function(x) { return (typeof x === 'number') ? { id: x, sale: 0 } : { id: x.id, sale: x.sale || 0 }; });
  // Undo history doesn't survive a fresh reload from the source of truth.
  _foUndoStack = [];
  _foRedoStack = [];
  _foSyncUrBtns();
  document.getElementById('foSearch').value = '';
  document.getElementById('foCatFilter').value = 'all';
  document.getElementById('foBrandFilter').value = 'all';
  document.getElementById('foCatComboLabel').textContent = 'All Categories';
  document.getElementById('foBrandComboLabel').textContent = 'All Brands';
  _foRenderList('');
  _foUpdateCount();
}
function _foUpdateCount() {
  var el = document.getElementById('foCount');
  if (el) el.textContent = _foItems.length + ' selected';
}
// Products currently matching the search box + category/brand filters —
// shared by rendering, Select All, and the header checkbox's tri-state sync.
function _foFilteredList(q) {
  q = (q || '').toLowerCase();
  var catF   = (document.getElementById('foCatFilter')   || { value: 'all' }).value;
  var brandF = (document.getElementById('foBrandFilter') || { value: 'all' }).value;
  return getAllAdminProducts().filter(function(p) {
    var matchesQ = !q || p.name.toLowerCase().includes(q) ||
      getProductSku(p.id).toLowerCase().includes(q) ||
      (typeof getBrand === 'function' && getBrand(p.id).toLowerCase().includes(q));
    var matchesCat   = catF === 'all'   || p.cat === catF;
    var matchesBrand = brandF === 'all' || getBrand(p.id) === brandF;
    return matchesQ && matchesCat && matchesBrand;
  });
}
function _foRenderList(q) {
  var photos = JSON.parse(localStorage.getItem('jain_photos') || '{}');
  var list = _foFilteredList(q);
  var rows = list.map(function(p) {
    var item = _foFind(p.id);
    var ck = !!item;
    var sale = item ? item.sale : 0;
    var rawPh = photos[p.id];
    var thumb = (rawPh && (rawPh.startsWith('http') || rawPh.startsWith('data:'))) ? rawPh : (p.img || NO_IMG);
    var brand = (typeof getBrand === 'function' ? getBrand(p.id) : '') || '';
    var priceCell = sale > 0
      ? '<div><div style="text-decoration:line-through;color:#aaa;font-size:11px">' + p.price.toFixed(3) + '</div>' +
        '<div class="price-cell" style="color:var(--red)">' + _foOfferPrice(p.price, sale).toFixed(3) + '</div></div>'
      : '<span class="price-cell">' + p.price.toFixed(3) + '</span>';
    var saleCell = '<div style="display:flex;align-items:center;gap:5px" onclick="event.stopPropagation()">' +
      '<input type="number" min="0" max="95" placeholder="—" value="' + (sale > 0 ? sale : '') + '" ' +
        'style="width:54px;padding:6px 7px;border:1.5px solid var(--border);border-radius:6px;font-size:12px;text-align:center;font-family:inherit" ' +
        'onchange="foSetSale(' + p.id + ',this.value)" />' +
      '<span style="font-size:11px;color:var(--gray)">%</span>' +
      (sale > 0 ? '<button onclick="foSetSale(' + p.id + ',0)" title="Clear sale" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:12px;padding:2px"><i class="fa fa-times"></i></button>' : '') +
    '</div>';
    return '<tr class="' + (ck ? 'fo-row-selected' : '') + '" onclick="foToggle(this,' + p.id + ')" style="cursor:pointer">' +
      '<td class="chk-col"><input type="checkbox" style="pointer-events:none"' + (ck ? ' checked' : '') + ' /></td>' +
      '<td><div style="display:flex;align-items:center;gap:11px">' +
        '<img class="prod-img" src="' + thumb + '" alt="" onerror="this.onerror=null;this.src=NO_IMG" />' +
        '<div><div class="prod-name">' + encodeHtml(p.name) + '</div><div class="prod-sku">' + getProductSku(p.id) + '</div></div>' +
      '</div></td>' +
      '<td>' + encodeHtml(brand) + '</td>' +
      '<td>' + priceCell + '</td>' +
      '<td>' + saleCell + '</td>' +
      '<td style="max-width:320px;color:var(--gray);font-size:12px;font-weight:500">' + (p.desc ? encodeHtml(p.desc) : '') + '</td>' +
    '</tr>';
  }).join('');
  document.getElementById('foTblBody').innerHTML = rows || '<tr><td colspan="6" style="color:#aaa;padding:20px;text-align:center">No products match this search.</td></tr>';
  var nSel = list.filter(function(p) { return !!_foFind(p.id); }).length;
  var allSelected = list.length > 0 && nSel === list.length;
  var saChk = document.getElementById('foSelectAll');
  if (saChk) {
    saChk.checked = allSelected;
    saChk.indeterminate = nSel > 0 && nSel < list.length;
  }
  var saBtn = document.getElementById('foSelectAllBtn');
  if (saBtn) saBtn.innerHTML = '<i class="fa fa-check-square"></i> ' + (allSelected ? 'Unselect All' : 'Select All');
  var bulkCount = document.getElementById('foBulkCount');
  if (bulkCount) bulkCount.textContent = nSel + ' selected here';
}
function foFilter() { _foRenderList(document.getElementById('foSearch').value); }

// ── SELECT ALL / UNSELECT ALL (respects the search + category/brand filters;
// no cap) — a real toggle: if everything currently shown is already
// featured, this removes all of them; otherwise it features whatever's
// missing. The header checkbox and toolbar button (label flips between
// "Select All" / "Unselect All") both read this same all-selected state.
function foToggleSelectAll() {
  var q = document.getElementById('foSearch').value;
  var list = _foFilteredList(q);
  if (!list.length) return;
  var allSelected = list.every(function(p) { return !!_foFind(p.id); });
  _foPushUndo();
  if (allSelected) {
    var ids = new Set(list.map(function(p) { return p.id; }));
    _foItems = _foItems.filter(function(x) { return !ids.has(x.id); });
  } else {
    list.filter(function(p) { return !_foFind(p.id); }).forEach(function(p) { _foItems.push({ id: p.id, sale: 0 }); });
  }
  _foUpdateCount();
  _foRenderList(q);
}
// Toolbar button — same as ticking the header checkbox.
function foSelectAllVisible() {
  foToggleSelectAll();
}

// ── BULK SALE (applies to whatever the search/category/brand filters + your
// selection currently show — search for a group, Select All, then set one
// Sale % for all of them here instead of typing it into every row) ───────────
function foApplyBulkSale() {
  var pct = Math.max(0, Math.min(95, parseInt(document.getElementById('foBulkSale').value, 10) || 0));
  var q = document.getElementById('foSearch').value;
  var visibleIds = new Set(_foFilteredList(q).map(function(p) { return p.id; }));
  var matches = _foItems.filter(function(item) { return visibleIds.has(item.id); });
  if (!matches.length) { showToast('No selected products match the current search/filters'); return; }
  _foPushUndo();
  matches.forEach(function(item) { item.sale = pct; });
  _foRenderList(q);
  showToast('Applied ' + pct + '% sale to ' + matches.length + ' product' + (matches.length === 1 ? '' : 's'));
}
function foClearBulkSale() {
  var q = document.getElementById('foSearch').value;
  var visibleIds = new Set(_foFilteredList(q).map(function(p) { return p.id; }));
  var matches = _foItems.filter(function(item) { return visibleIds.has(item.id) && item.sale > 0; });
  if (matches.length) {
    _foPushUndo();
    matches.forEach(function(item) { item.sale = 0; });
  }
  document.getElementById('foBulkSale').value = '';
  _foRenderList(q);
  showToast(matches.length ? ('Cleared sale from ' + matches.length + ' product' + (matches.length === 1 ? '' : 's')) : 'Nothing to clear');
}

// ── CATEGORY + BRAND FILTER DROPDOWNS (Featured tab) ──────────────────────────
// Parallel to Inventory's fcToggle/fcRenderList/fcPick (js/10-csv-import.js)
// but scoped to this tab's own combo ids so the two tabs' filters don't clash;
// fcCloseAll() there is generic (any open .fc-panel) so it still closes these.
var _foFcOptions = { cat: [], brand: [] };
var _foFcVisible = { cat: [], brand: [] };
function _foFcIds(kind) {
  var cap = kind === 'cat' ? 'Cat' : 'Brand';
  return { combo: 'fo' + cap + 'Combo', panel: 'fo' + cap + 'ComboPanel', search: 'fo' + cap + 'ComboSearch', list: 'fo' + cap + 'ComboList', label: 'fo' + cap + 'ComboLabel', hidden: kind === 'cat' ? 'foCatFilter' : 'foBrandFilter' };
}
function _foFcRebuild(kind) {
  if (kind === 'cat') {
    _foFcOptions.cat = [{ value: 'all', label: 'All Categories' }].concat(
      getAllCats().map(function(c) { return { value: c.slug, label: c.label }; }));
  } else {
    var brands = {};
    getAllAdminProducts().forEach(function(p) { var b = getBrand(p.id); if (b) brands[b] = true; });
    _foFcOptions.brand = [{ value: 'all', label: 'All Brands' }].concat(
      Object.keys(brands).sort(function(a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); })
        .map(function(b) { return { value: b, label: b }; }));
  }
}
function foFcToggle(kind) {
  var ids = _foFcIds(kind);
  var panel = document.getElementById(ids.panel);
  var wasOpen = panel.classList.contains('open');
  fcCloseAll();
  if (wasOpen) return;
  _foFcRebuild(kind);
  document.getElementById(ids.search).value = '';
  foFcRenderList(kind, '');
  panel.classList.add('open');
  setTimeout(function() { document.getElementById(ids.search).focus(); }, 60);
}
function foFcRenderList(kind, q) {
  q = (q || '').toLowerCase();
  var ids = _foFcIds(kind);
  var cur = document.getElementById(ids.hidden).value;
  _foFcVisible[kind] = _foFcOptions[kind].filter(function(o) { return !q || o.label.toLowerCase().includes(q); });
  document.getElementById(ids.list).innerHTML = _foFcVisible[kind].length
    ? _foFcVisible[kind].map(function(o, i) {
        return '<div class="fc-opt' + (o.value === cur ? ' sel' : '') + '" onclick="foFcPick(\'' + kind + '\',' + i + ')">' +
          encodeHtml(o.label) + (o.value === cur ? ' <i class="fa fa-check"></i>' : '') + '</div>';
      }).join('')
    : '<div class="fc-empty">No matches</div>';
}
function foFcFilterList(kind) { foFcRenderList(kind, document.getElementById(_foFcIds(kind).search).value); }
function foFcPick(kind, i) {
  var o = _foFcVisible[kind][i];
  if (o) foFcSet(kind, o.value, o.label);
}
function foFcSet(kind, value, label) {
  var ids = _foFcIds(kind);
  document.getElementById(ids.hidden).value = value;
  document.getElementById(ids.label).textContent = value === 'all' ? (kind === 'cat' ? 'All Categories' : 'All Brands') : (label || value);
  fcCloseAll();
  foFilter();
}
function foToggle(row, id) {
  _foPushUndo();
  var idx = _foItems.findIndex(function(x) { return x.id === id; });
  if (idx === -1) {
    _foItems.push({ id: id, sale: 0 });
  } else {
    _foItems.splice(idx, 1);
  }
  _foUpdateCount();
  _foRenderList(document.getElementById('foSearch').value);
}
// Setting a sale % on a product that isn't featured yet features it first —
// a sale price only means anything if it's actually shown in the strip.
function foSetSale(id, rawVal) {
  _foPushUndo();
  var pct = Math.max(0, Math.min(95, parseInt(rawVal, 10) || 0));
  var item = _foFind(id);
  if (!item) {
    item = { id: id, sale: 0 };
    _foItems.push(item);
  }
  item.sale = pct;
  _foUpdateCount();
  _foRenderList(document.getElementById('foSearch').value);
}
async function saveFeaturedOffers() {
  var r = await sbFetch(SB_URL + '/rest/v1/expert_settings', {
    method: 'POST',
    headers: Object.assign({}, SB_HDRS, { 'Prefer': 'resolution=merge-duplicates' }),
    body: JSON.stringify([{ key: 'featured_offers', value: JSON.stringify(_foItems) }])
  });
  if (r.error) { showToast('Failed to save — check Supabase expert_settings table'); return; }
  showToast('Featured products saved!');
}

