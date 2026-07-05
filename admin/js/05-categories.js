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

