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

  // Never store the base64 image itself in expert_products.img_url — that
  // column gets fetched on every visitor's page load (select=*), so a base64
  // blob per row bloats and slows down every single page load. A file upload
  // gets properly saved into expert_photos a few lines down instead; only a
  // plain http(s) link (pasted URL) is cheap enough to also keep here.
  var cheapImgUrl = imgUrl.startsWith('data:') ? '' : imgUrl;

  var { data: rows, error } = await sbFetch(SB_URL + '/rest/v1/expert_products', {
    method:'POST',
    headers:Object.assign({},SB_HDRS,{'Prefer':'return=representation'}),
    body:JSON.stringify([{
      id: safeId,
      name, category:cat, price, hidden:false,
      description: document.getElementById('apDesc').value.trim(),
      badge:  document.getElementById('apBadge').value || null,
      img_url: cheapImgUrl
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
          body:JSON.stringify([{product_id:newId, img_url:finalUrl}])
        });
      } catch(e) { console.warn('Image rename failed:', e); }
    }
    showToast('Product added successfully!');
    closeAddProduct();
    await loadFromSupabase();
  }
  btn.disabled = false; btn.innerHTML = '<i class="fa fa-plus"></i>&nbsp; Add Product';
}

// ── PER-PRODUCT MIN / MAX ORDER QUANTITY ──────────────────────────────────────
// Stored in Supabase (expert_settings key 'qty_limits') as {id: {min, max}} —
// same key-value pattern as sku_map/brand_map/hidden_prices. 0 means "no
// limit" for either field. Read by the storefront's add-to-cart and quantity
// selector logic (see js/03-product-cart-checkout.js).
var _qlProdId = null;
function getQtyLimits(id) {
  return (window._sbQtyLimits || {})[id] || { min: 0, max: 0 };
}
function openQtyLimits(id) {
  var p = getAllAdminProducts().find(function(x){ return x.id === id; });
  if (!p) return;
  _qlProdId = id;
  var lim = getQtyLimits(id);
  document.getElementById('qtyLimitsProdName').textContent = '#' + id + ' — ' + p.name;
  document.getElementById('qtyLimitsMin').value = lim.min || 0;
  document.getElementById('qtyLimitsMax').value = lim.max || 0;
  document.getElementById('qtyLimitsOverlay').classList.add('open');
}
function closeQtyLimits() {
  document.getElementById('qtyLimitsOverlay').classList.remove('open');
  _qlProdId = null;
}
function saveQtyLimits() {
  if (!_qlProdId) return;
  var min = Math.max(0, parseInt(document.getElementById('qtyLimitsMin').value, 10) || 0);
  var max = Math.max(0, parseInt(document.getElementById('qtyLimitsMax').value, 10) || 0);
  if (max > 0 && min > max) { showToast('Minimum can\'t be greater than maximum'); return; }
  if (!window._sbQtyLimits) window._sbQtyLimits = {};
  window._sbQtyLimits[_qlProdId] = { min: min, max: max };
  sbFetch(SB_URL + '/rest/v1/expert_settings', {
    method: 'POST',
    headers: Object.assign({}, SB_HDRS, { 'Prefer': 'resolution=merge-duplicates' }),
    body: JSON.stringify([{ key: 'qty_limits', value: JSON.stringify(window._sbQtyLimits) }])
  });
  showToast('Quantity limits saved ✅');
  closeQtyLimits();
}

// ── PER-PRODUCT SIZE/PACK OPTIONS ─────────────────────────────────────────────
// Stored in Supabase (expert_settings key 'product_variants') as
// {id: [{label, price, sku, image, description}]} — same key-value pattern
// as qty_limits. The storefront shows them as a dropdown on the product;
// each option becomes its own cart line, and swaps in its own SKU/image/
// description on the product page when it has one (see js/03-product-cart-checkout.js).
// price 0 = sell at the product's own price; empty sku/image/description =
// use the product's own. New rows start as a "duplicate" of the product's own
// image/description so admin only has to change what's different for that
// option, not re-enter everything.
var _vrProdId = null;
function openVariants(id) {
  var p = getAllAdminProducts().find(function(x){ return x.id === id; });
  if (!p) return;
  _vrProdId = id;
  document.getElementById('variantsProdName').textContent = '#' + id + ' — ' + p.name;
  var rows = (window._sbVariants || {})[id] || [];
  document.getElementById('variantRows').innerHTML = '';
  rows.forEach(function(v) { addVariantRow(v.label, v.price, v.image, v.description, v.sku); });
  if (!rows.length) addVariantRow();
  document.getElementById('variantsOverlay').classList.add('open');
}
function closeVariants() {
  document.getElementById('variantsOverlay').classList.remove('open');
  _vrProdId = null;
}
// The product's own current image (admin's local photo cache first, falling
// back to its base image) and description — what a new option duplicates.
function _variantProductDefaults() {
  var p = getAllAdminProducts().find(function(x){ return x.id === _vrProdId; }) || {};
  var photos = {};
  try { photos = JSON.parse(localStorage.getItem('jain_photos') || '{}'); } catch(e) {}
  var ph = photos[_vrProdId];
  var image = (ph && (ph.indexOf('http') === 0 || ph.indexOf('data:') === 0)) ? ph : (p.img || '');
  return { image: image, description: p.desc || '' };
}
function addVariantRow(label, price, image, description, sku) {
  var isDuplicate = image === undefined && description === undefined;
  var defaults = isDuplicate ? _variantProductDefaults() : { image: '', description: '' };
  var row = document.createElement('div');
  row.className = 'variant-row';
  row.style.cssText = 'display:flex;gap:10px;margin-bottom:10px;padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--light)';
  row.innerHTML =
    '<div style="display:flex;flex-direction:column;gap:2px;justify-content:center">' +
      '<button type="button" class="vr-move" onclick="moveVariantRow(this,-1)" title="Move up"><i class="fa fa-chevron-up"></i></button>' +
      '<button type="button" class="vr-move" onclick="moveVariantRow(this,1)" title="Move down"><i class="fa fa-chevron-down"></i></button>' +
    '</div>' +
    '<img class="vr-thumb" style="width:52px;height:52px;object-fit:cover;border-radius:7px;border:1px solid var(--border);background:#fff;flex-shrink:0" onerror="this.style.opacity=0.3" />' +
    '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">' +
      '<div style="display:flex;gap:8px">' +
        '<input type="text" class="vr-label" placeholder="e.g. 2&quot; (50 box/ctn)" style="flex:1;min-width:0;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px" />' +
        '<input type="number" class="vr-price" min="0" step="0.001" placeholder="0.000" title="Price (KWD) — leave empty to use the product price" style="width:90px;padding:9px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px" />' +
        '<button type="button" class="del-btn" onclick="this.closest(\'.variant-row\').remove()" title="Remove option"><i class="fa fa-trash"></i></button>' +
      '</div>' +
      '<input type="text" class="vr-sku" placeholder="SKU for this option — defaults to the product\'s own" style="padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:12px" />' +
      '<div style="display:flex;gap:6px">' +
        '<input type="text" class="vr-image" placeholder="Image URL — defaults to the product\'s own photo" style="flex:1;min-width:0;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:12px" oninput="this.closest(\'.variant-row\').querySelector(\'.vr-thumb\').src=this.value" />' +
        '<label style="display:flex;align-items:center;gap:5px;padding:8px 10px;border:1px dashed var(--border);border-radius:8px;font-size:11px;font-weight:700;color:var(--gray);cursor:pointer;white-space:nowrap" title="Upload a photo from your computer for this option">' +
          '<i class="fa fa-upload"></i> Upload' +
          '<input type="file" accept="image/*" style="display:none" onchange="_vrFileChosen(this)" />' +
        '</label>' +
      '</div>' +
      '<textarea class="vr-desc" rows="2" placeholder="Description — defaults to the product\'s own" style="padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:12px;font-family:inherit;resize:vertical"></textarea>' +
    '</div>';
  // Values set via the DOM (not baked into the HTML string) so labels with
  // quotes — 2" nails etc. — can never truncate the attribute
  row.querySelector('.vr-label').value = label || '';
  row.querySelector('.vr-price').value = price > 0 ? price : '';
  row.querySelector('.vr-sku').value   = sku || '';
  row.querySelector('.vr-image').value = image !== undefined ? (image || '') : defaults.image;
  row.querySelector('.vr-desc').value  = description !== undefined ? (description || '') : defaults.description;
  row.querySelector('.vr-thumb').src   = row.querySelector('.vr-image').value;
  document.getElementById('variantRows').appendChild(row);
}
// No cropping here (unlike the main product Photo editor) — option thumbnails
// are small, and a modal-based crop tool is built as a single global instance
// that can't run once per row. Read straight to a data URL and drop it in
// the same URL field, so the rest of the row (thumbnail preview, save) just
// works without knowing whether the string came from typing or uploading.
function _vrFileChosen(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  var row = input.closest('.variant-row');
  var reader = new FileReader();
  reader.onload = function(ev) {
    var urlField = row.querySelector('.vr-image');
    urlField.value = ev.target.result;
    row.querySelector('.vr-thumb').src = ev.target.result;
  };
  reader.readAsDataURL(file);
}
// Swaps a row with its neighbor — the order here is exactly the order the
// dropdown shows on the storefront, so "put this option first" just means
// moving its row to the top of this list.
function moveVariantRow(btn, dir) {
  var row = btn.closest('.variant-row');
  var sibling = dir < 0 ? row.previousElementSibling : row.nextElementSibling;
  if (!sibling) return;
  if (dir < 0) row.parentNode.insertBefore(row, sibling);
  else row.parentNode.insertBefore(sibling, row);
}
function saveVariants() {
  if (!_vrProdId) return;
  var opts = [];
  document.querySelectorAll('#variantRows .variant-row').forEach(function(row) {
    var label = row.querySelector('.vr-label').value.trim();
    if (!label) return;
    var price = parseFloat(row.querySelector('.vr-price').value) || 0;
    var sku = row.querySelector('.vr-sku').value.trim();
    var image = row.querySelector('.vr-image').value.trim();
    var description = row.querySelector('.vr-desc').value.trim();
    opts.push({ label: label, price: price > 0 ? price : 0, sku: sku || undefined, image: image || undefined, description: description || undefined });
  });
  if (!window._sbVariants) window._sbVariants = {};
  if (opts.length) { window._sbVariants[_vrProdId] = opts; }
  else { delete window._sbVariants[_vrProdId]; }
  sbFetch(SB_URL + '/rest/v1/expert_settings', {
    method: 'POST',
    headers: Object.assign({}, SB_HDRS, { 'Prefer': 'resolution=merge-duplicates' }),
    body: JSON.stringify([{ key: 'product_variants', value: JSON.stringify(window._sbVariants) }])
  });
  showToast(opts.length ? 'Options saved ✅' : 'Options removed');
  closeVariants();
  renderTable();
}
