// ── SKU HELPERS ────────────────────────────────────────────────────────────────
// SKU = Stock Keeping Unit — a unique number for each product (e.g. SKU-0001)
// nextSku()    — finds the next available SKU number when adding a new product
// formatSku()  — formats a number as "SKU-0001" style string
// SKU is a display label; product ID is always sequential (count-based).
// If user sets a custom SKU different from the product ID, it's stored here.
// Real SKUs live in Supabase (expert_settings key 'sku_map', loaded by
// loadFromSupabase into window._sbSkuMap) so the storefront shows them to
// every visitor. localStorage keeps a copy as an offline fallback.
function getProductSku(id) {
  var val = (window._sbSkuMap || {})[String(id)];
  if (val === undefined) {
    try { val = JSON.parse(localStorage.getItem('jain_sku_map') || '{}')[String(id)]; } catch(e) {}
  }
  if (val === undefined || val === null || val === '') return 'SKU-' + String(id).padStart(4, '0');
  return /^\d{1,4}$/.test(String(val)) ? 'SKU-' + String(val).padStart(4, '0') : 'SKU: ' + val;
}
function setProductSku(id, sku) {
  if (!window._sbSkuMap) window._sbSkuMap = {};
  window._sbSkuMap[String(id)] = sku;
  try { localStorage.setItem('jain_sku_map', JSON.stringify(window._sbSkuMap)); } catch(e) {}
  _pushSkuMap();
}
function removeProductSku(id) {
  if (window._sbSkuMap) delete window._sbSkuMap[String(id)];
  try { localStorage.setItem('jain_sku_map', JSON.stringify(window._sbSkuMap || {})); } catch(e) {}
  _pushSkuMap();
}
// Debounced upsert of the whole SKU map to Supabase
function _pushSkuMap() {
  clearTimeout(window._skuPushT);
  window._skuPushT = setTimeout(function() {
    sbFetch(SB_URL + '/rest/v1/expert_settings', {
      method: 'POST',
      headers: Object.assign({}, SB_HDRS, { 'Prefer': 'resolution=merge-duplicates' }),
      body: JSON.stringify([{ key: 'sku_map', value: JSON.stringify(window._sbSkuMap || {}) }])
    });
  }, 400);
}

// ── ADD PRODUCT ────────────────────────────────────────────────────────────────
// openAddProduct() — opens the "Add New Product" modal popup
// saveNewProduct() — validates the form and saves the new product to Supabase
// apUrlPreview()   — shows a live preview of the image URL you typed
// apFileChosen()   — handles when you upload an image from your computer (with crop support)
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

  // If user typed a different SKU than the auto-filled sequential number, save it
  // as display label. Text SKUs like "P-43561" are allowed, not just numbers.
  var skuRaw = (document.getElementById('apSku').value || '').trim();
  if (skuRaw && skuRaw !== String(safeId)) {
    setProductSku(safeId, /^\d+$/.test(skuRaw) ? parseInt(skuRaw) : skuRaw);
  }

  var { data: rows, error } = await sbFetch(SB_URL + '/rest/v1/expert_products', {
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
    await sbFetch(SB_URL + '/rest/v1/expert_stock', {
      method:'POST', headers:Object.assign({},SB_HDRS,{'Prefer':'resolution=merge-duplicates'}),
      body:JSON.stringify([{product_id:newId, qty}])
    });
    // If temp storage path, rename to proper product ID
    if (_apPendingFile && imgUrl) {
      try {
        var ext2 = (_apPendingFile.name.split('.').pop()||'jpg').toLowerCase();
        var blob = await fetch(imgUrl).then(r=>r.blob());
        var finalUrl = await uploadToStorage(blob, newId, ext2);
        var photos = JSON.parse(localStorage.getItem('jain_photos')||'{}');
        photos[newId] = finalUrl;
        localStorage.setItem('jain_photos', JSON.stringify(photos));
        await sbFetch(SB_URL + '/rest/v1/expert_photos', {
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
