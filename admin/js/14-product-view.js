// ── PRODUCT VIEW / EDIT MODAL ─────────────────────────────────────────────────
// Click a product row in Inventory to open this — it's laid out just like the
// storefront's own product popup (openProduct() in js/03-product-cart-checkout.js:
// image left, name/SKU/description/price/badges right), except every field here
// is editable in place instead of read-only. Reuses the exact same save paths
// the Inventory table already uses per field (name/price/stock stay staged
// behind the "Save Changes" button like the table; brand/SKU/badge/description/
// visibility/price-hidden save instantly, same as their table equivalents) so
// nothing about how edits persist changes — only how you get to them does.
var _pvId = null;

function _pvRawSku(id) {
  var val = (window._sbSkuMap || {})[String(id)];
  if (val === undefined) {
    try { val = JSON.parse(localStorage.getItem('jain_sku_map') || '{}')[String(id)]; } catch(e) {}
  }
  return (val === undefined || val === null) ? '' : String(val);
}

function openProductView(id) {
  var p = getAllAdminProducts().find(function(x){ return x.id === id; });
  if (!p) return;
  _pvId = id;
  var raw = _customProductRows.find(function(r){ return r.id === id; }) || {};
  var photos = {};
  try { photos = JSON.parse(localStorage.getItem('jain_photos') || '{}'); } catch(e) {}
  var rawPh = photos[id];
  var img = (rawPh && (rawPh.startsWith('http') || rawPh.startsWith('data:'))) ? rawPh : (p.img || NO_IMG);
  var qty = stockData[id] || 0;
  var priceHidden = isPriceHidden(id);
  var displayName  = (_prodOverrides[id]||{}).name || p.name;
  var displayPrice = (_prodOverrides[id]||{}).price !== undefined ? _prodOverrides[id].price : p.price;
  var badge = raw.badge || '';
  var allCats = getProductCatSlugs(p);
  var catPillsHtml = allCats.map(function(slug){
    var match = getAllCats().find(function(c){ return c.slug === slug; });
    var lbl = match ? match.label : slug.replace(/-/g,' ');
    return '<span class="cat-pill">' + encodeHtml(lbl) + '</span>';
  }).join('');
  var statusCls = qty===0 ? 'dot-red' : qty<=10 ? 'dot-yellow' : 'dot-green';
  var statusTxt = qty===0 ? 'Out of Stock' : qty<=10 ? 'Low Stock' : 'In Stock';
  var badgeOptions = ['', 'Best Seller', 'Popular', 'Pro', 'New', 'Sale'];

  document.getElementById('pvBody').innerHTML =
    '<div class="pv-img-col">' +
      '<img class="pv-main-img" src="' + img + '" alt="' + encodeHtml(displayName) + '" onerror="this.style.opacity=0.3" />' +
      '<button class="pv-photo-btn" onclick="openPhoto(' + id + ')"><i class="fa fa-camera"></i> Change Photo</button>' +
    '</div>' +
    '<div class="pv-info-col">' +
      '<div class="pv-badge-row">' +
        '<div class="cat-pills-wrap">' + catPillsHtml +
          '<button class="pv-edit-cats-btn" onclick="openMC(' + id + ')" title="Edit categories"><i class="fa fa-edit"></i> Categories</button>' +
        '</div>' +
        '<select class="pv-badge-select" id="pvBadge" onchange="pvOnBadgeEdit()">' +
          badgeOptions.map(function(b){ return '<option value="' + b + '"' + (badge===b ? ' selected' : '') + '>' + (b || 'No badge') + '</option>'; }).join('') +
        '</select>' +
      '</div>' +
      '<input class="pv-name-input" id="pvName" value="' + encodeHtml(displayName) + '" oninput="pvOnNameEdit()" title="Product name" />' +
      '<div class="pv-sku-row">' +
        '<span class="pv-sku-lbl">SKU</span>' +
        '<input class="pv-sku-input" id="pvSku" value="' + encodeHtml(_pvRawSku(id)) + '" placeholder="' + getProductSku(id) + '" onblur="pvOnSkuBlur()" />' +
        '<span class="pv-brand-lbl">Brand</span>' +
        '<input class="pv-brand-input" id="pvBrand" value="' + encodeHtml(getBrand(id)) + '" placeholder="Brand" oninput="pvOnBrandEdit()" />' +
      '</div>' +
      '<textarea class="pv-desc-input" id="pvDesc" rows="3" placeholder="Product description..." onblur="pvOnDescBlur()">' + encodeHtml(p.desc || '') + '</textarea>' +
      '<div class="pv-price-row">' +
        '<div class="pv-price-field"><input type="number" step="0.001" min="0" id="pvPrice" value="' + displayPrice.toFixed(3) + '" oninput="pvOnPriceEdit()" /><span>KWD</span></div>' +
        '<button class="pv-toggle-btn" onclick="pvTogglePriceHidden()">' +
          (priceHidden ? '<i class="fa fa-eye"></i> Show Price' : '<i class="fa fa-eye-slash"></i> Hide Price (Ask on WhatsApp)') +
        '</button>' +
      '</div>' +
      (priceHidden ? '<div class="pv-hint"><i class="fa fa-info-circle"></i> Customers see "Price on request" + an Ask Price on WhatsApp button instead.</div>' : '') +
      '<div class="pv-stock-row">' +
        '<span class="status-dot"><span class="dot ' + statusCls + '"></span>' + statusTxt + '</span>' +
        '<input type="number" class="stock-input ' + (qty===0?'out':qty<=10?'low':'') + '" id="pvStock" value="' + qty + '" min="0" oninput="pvOnStockEdit()" />' +
        '<button class="act-btn" onclick="pvQuickStock(\'clear\')"><i class="fa fa-times"></i> Clear</button>' +
        '<button class="act-btn" onclick="pvQuickStock(\'add50\')"><i class="fa fa-plus"></i> +50</button>' +
        '<button class="act-btn" onclick="pvQuickStock(\'add5000\')"><i class="fa fa-plus"></i> +5000</button>' +
        '<button class="vis-btn ' + (p.hidden ? 'hidden-p' : 'visible') + '" onclick="pvToggleVisibility()">' +
          (p.hidden ? '<i class="fa fa-eye-slash"></i> Show on Store' : '<i class="fa fa-eye"></i> Hide from Store') +
        '</button>' +
      '</div>' +
      '<div class="pv-action-row">' +
        '<button class="act-btn" style="background:#fdf4ff;color:#a21caf;border-color:#f5d0fe" onclick="openVariants(' + id + ')"><i class="fa fa-list-ul"></i> Options' + (((window._sbVariants||{})[id]||[]).length ? ' (' + window._sbVariants[id].length + ')' : '') + '</button>' +
        '<button class="act-btn" style="background:#f0fdf4;color:#15803d;border-color:#bbf7d0" onclick="openQtyLimits(' + id + ')"><i class="fa fa-sort-numeric-up"></i> Qty Limits</button>' +
        '<button class="act-btn purple" onclick="openStats(' + id + ')"><i class="fa fa-chart-bar"></i> Stats</button>' +
        '<button class="del-btn" onclick="pvDeleteProduct()"><i class="fa fa-trash"></i> Delete</button>' +
      '</div>' +
      '<div class="pv-divider"></div>' +
      '<div class="pv-features">' +
        '<div class="pv-feat"><i class="fa fa-check-circle"></i> 100% genuine, quality-tested product</div>' +
        '<div class="pv-feat"><i class="fa fa-shipping-fast"></i> Same-day delivery in Kuwait City</div>' +
        '<div class="pv-feat"><i class="fa fa-shield-alt"></i> Easy returns &amp; after-sales support</div>' +
        '<div class="pv-feat"><i class="fa fa-tags"></i> Bulk pricing available for contractors</div>' +
      '</div>' +
      '<div class="pv-save-row">' +
        '<button class="pv-save-btn" onclick="pvSaveChanges()"><i class="fa fa-cloud-upload-alt"></i> Save Changes</button>' +
        '<span class="pv-save-hint">Name, price &amp; stock save to the cloud here — everything else on this page saves instantly.</span>' +
      '</div>' +
    '</div>';

  document.getElementById('pvOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeProductView() {
  document.getElementById('pvOverlay').classList.remove('open');
  document.body.style.overflow = '';
  _pvId = null;
}

// Re-renders the modal from current state if it's open for this product —
// used as a callback by other modals (Photo, Categories) that can be opened
// from inside this one, so their edits show up here immediately after they close.
function pvRefreshIfOpen(id) {
  if (_pvId && _pvId === id && document.getElementById('pvOverlay').classList.contains('open')) openProductView(id);
}

// ── FIELD EDIT HANDLERS ───────────────────────────────────────────────────────
// Name/price/stock mirror onNameEdit/onPriceEdit/onStock in js/07-orders.js —
// staged in the same in-memory state, synced into the table's own inputs (if
// that row is currently rendered) so "Save Changes" never overwrites this
// modal's edit with a stale table value.
function pvOnNameEdit() {
  if (!_pvId) return;
  var val = document.getElementById('pvName').value;
  if (!_prodOverrides[_pvId]) _prodOverrides[_pvId] = {};
  _prodOverrides[_pvId].name = val;
  var ni = document.getElementById('ni' + _pvId); if (ni) ni.value = val;
}
function pvOnPriceEdit() {
  if (!_pvId) return;
  var raw = document.getElementById('pvPrice').value;
  var val = parseFloat(raw);
  if (!_prodOverrides[_pvId]) _prodOverrides[_pvId] = {};
  _prodOverrides[_pvId].price = isNaN(val) ? 0 : val;
  var pi = document.getElementById('pi' + _pvId); if (pi) pi.value = raw;
  renderStats();
}
function pvOnStockEdit() {
  if (!_pvId) return;
  var v = Math.max(0, parseInt(document.getElementById('pvStock').value, 10) || 0);
  if (stockData[_pvId] !== v) _pushUndo();
  stockData[_pvId] = v;
  var si = document.getElementById('si' + _pvId); if (si) si.value = v;
  var el = document.getElementById('pvStock');
  el.className = 'stock-input' + (v===0?' out':v<=10?' low':'');
  renderStats();
}
function pvQuickStock(action) {
  if (!_pvId) return;
  if (action === 'clear') setStock(_pvId, 0);
  else if (action === 'add50') addStock(_pvId);
  else if (action === 'add5000') addStock5000(_pvId);
  openProductView(_pvId);
}
// Brand mirrors onBrandEdit — instant Supabase push (brand_map), same as the table.
function pvOnBrandEdit() {
  if (!_pvId) return;
  var val = document.getElementById('pvBrand').value;
  if (!_prodOverrides[_pvId]) _prodOverrides[_pvId] = {};
  _prodOverrides[_pvId].brand = val;
  localStorage.setItem('bahar_overrides', JSON.stringify(_prodOverrides));
  if (!window._sbBrandMap) window._sbBrandMap = {};
  window._sbBrandMap[_pvId] = val;
  _pushBrandMap();
  var bi = document.getElementById('bi' + _pvId); if (bi) bi.value = val;
}
// SKU mirrors the existing setProductSku/removeProductSku helpers (js/08-inventory.js).
function pvOnSkuBlur() {
  if (!_pvId) return;
  var raw = document.getElementById('pvSku').value.trim();
  if (!raw) removeProductSku(_pvId);
  else setProductSku(_pvId, /^\d+$/.test(raw) ? parseInt(raw, 10) : raw);
  renderTable();
}
// Description: same instant PATCH saveProductSEO() uses (js/12-seo.js), just
// triggered from this view instead of the separate SEO modal.
async function pvOnDescBlur() {
  if (!_pvId) return;
  var desc = document.getElementById('pvDesc').value.trim();
  var res = await sbFetch(SB_URL + '/rest/v1/expert_products?id=eq.' + _pvId, {
    method: 'PATCH', headers: SB_HDRS, body: JSON.stringify({ description: desc })
  });
  if (res.error) { showToast('Failed to save description'); return; }
  var row = _customProductRows.find(function(r){ return r.id === _pvId; });
  if (row) row.description = desc;
  showToast('Description saved');
}
// Badge is a plain expert_products column — same instant-PATCH pattern as
// toggleVisibility/togglePriceHidden use for their own fields.
async function pvOnBadgeEdit() {
  if (!_pvId) return;
  var val = document.getElementById('pvBadge').value;
  var res = await sbFetch(SB_URL + '/rest/v1/expert_products?id=eq.' + _pvId, {
    method: 'PATCH', headers: SB_HDRS, body: JSON.stringify({ badge: val || null })
  });
  if (res.error) { showToast('Failed to save badge'); return; }
  var row = _customProductRows.find(function(r){ return r.id === _pvId; });
  if (row) row.badge = val || null;
  showToast('Badge updated');
}
function pvTogglePriceHidden() {
  if (!_pvId) return;
  togglePriceHidden(_pvId);
  openProductView(_pvId);
}
async function pvToggleVisibility() {
  if (!_pvId) return;
  var p = getAllAdminProducts().find(function(x){ return x.id === _pvId; });
  if (!p) return;
  await toggleVisibility(_pvId, p.isBase);
  openProductView(_pvId);
}
async function pvDeleteProduct() {
  if (!_pvId) return;
  var p = getAllAdminProducts().find(function(x){ return x.id === _pvId; });
  if (!p) return;
  await deleteProduct(_pvId, p.isBase);
  closeProductView();
}
// Same bulk save the Inventory tab's "Save Changes" button runs (js/07-orders.js) —
// commits the staged name/price/stock edits to Supabase/localStorage.
function pvSaveChanges() { saveAll(); }
