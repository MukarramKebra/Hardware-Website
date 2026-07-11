// ── MULTI-SELECT ───────────────────────────────────────────────────────────────
// Lets you tick multiple products in the inventory table and perform bulk actions.
// toggleSelectAll()  — ticks/unticks every product checkbox at once
// clearSelection()   — clears all ticked checkboxes
// bulkShow()         — makes all selected products visible on the store
// bulkHide()         — hides all selected products from the store
// bulkDelete()       — deletes all selected products at once
// bulkClearStock()   — sets stock to 0 for all selected products
// bulkAddStock()     — adds 50 units to all selected products
var _selectedIds = new Set();

function toggleSelectAll(checked) {
  var q = document.getElementById('adminSearch').value.toLowerCase();
  var cat = document.getElementById('catFilter').value;
  var list = getAllAdminProducts().filter(function(p){
    return (cat==='all'||p.cat===cat) && (!q||p.name.toLowerCase().includes(q)||getBrand(p.id).toLowerCase().includes(q));
  });
  list.forEach(function(p){ checked ? _selectedIds.add(p.id) : _selectedIds.delete(p.id); });
  document.querySelectorAll('.row-chk').forEach(function(c){ c.checked = checked; });
  _syncBulkBar();
}
// "Select All" button in the toolbar — same as ticking the header checkbox.
function selectAllProducts() {
  toggleSelectAll(true);
  var headerChk = document.getElementById('selectAll');
  if (headerChk) headerChk.checked = true;
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
      await sbFetch(SB_URL+'/rest/v1/expert_hidden',{method:'POST',headers:Object.assign({},SB_HDRS,{'Prefer':'resolution=merge-duplicates'}),body:JSON.stringify([{product_id:id,hidden:true}])});
      _hiddenBaseIds.add(id);
    } else {
      await sbFetch(SB_URL+'/rest/v1/expert_products?id=eq.'+id,{method:'PATCH',headers:SB_HDRS,body:JSON.stringify({hidden:true})});
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
      await sbFetch(SB_URL+'/rest/v1/expert_hidden?product_id=eq.'+id,{method:'DELETE',headers:SB_HDRS});
      _hiddenBaseIds.delete(id);
    } else {
      await sbFetch(SB_URL+'/rest/v1/expert_products?id=eq.'+id,{method:'PATCH',headers:SB_HDRS,body:JSON.stringify({hidden:false})});
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

// Clear Stock and Delete confirm before touching many products, but Add
// Stock didn't — a "select all [products of a brand]" from the brand menu
// followed by one click here could silently restock dozens of products at
// once. Skip the prompt for a small, deliberate selection (a handful of
// rows ticked by hand); require it once the count is large enough that it
// was almost certainly a "select all"-style action, not individual picks.
function _bulkConfirmIfLarge(action, n) {
  return n <= 5 || confirm(action + ' for ' + n + ' selected products?');
}
function bulkAddStock() {
  if (!_selectedIds.size) return;
  if (!_bulkConfirmIfLarge('Add +50 stock', _selectedIds.size)) return;
  _pushUndo();
  _selectedIds.forEach(function(id){
    var cur=stockData[id]||0; stockData[id]=Math.ceil((cur+1)/50)*50;
  });
  showToast('+50 added to '+_selectedIds.size+' products');
  clearSelection(); renderTable(); renderStats();
}

function bulkAdd5000Stock() {
  if (!_selectedIds.size) return;
  if (!_bulkConfirmIfLarge('Add +5000 stock', _selectedIds.size)) return;
  _pushUndo();
  _selectedIds.forEach(function(id){ stockData[id]=(stockData[id]||0)+5000; });
  showToast('+5000 added to '+_selectedIds.size+' products');
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
      await sbFetch(SB_URL+'/rest/v1/expert_hidden',{method:'POST',headers:Object.assign({},SB_HDRS,{'Prefer':'resolution=ignore-duplicates'}),body:JSON.stringify({product_id:id})});
      _hiddenBaseIds.add(id);
    } else {
      await Promise.all([
        sbFetch(SB_URL+'/rest/v1/expert_products?id=eq.'+id,{method:'DELETE',headers:SB_HDRS}),
        sbFetch(SB_URL+'/rest/v1/expert_stock?product_id=eq.'+id,{method:'DELETE',headers:SB_HDRS})
      ]);
    }
  }
  showToast(_selectedIds.size+' products deleted');
  clearSelection(); await loadFromSupabase();
}

// BRAND ACTIONS: click a product's brand menu to act on EVERY product sharing
// that brand. Reuses the existing bulk-select machinery.
var _brandMenuBrand='';
function closeBrandMenu(){ var m=document.getElementById('brandMenu'); if(m) m.remove(); document.removeEventListener('mousedown',_brandMenuOutside); }
function _brandMenuOutside(e){ var m=document.getElementById('brandMenu'); if(m && !m.contains(e.target)) closeBrandMenu(); }
function openBrandMenu(id,ev){
  if(ev){ ev.stopPropagation(); ev.preventDefault(); }
  var inp=document.getElementById('bi'+id);
  var brand=(inp?inp.value:'').trim();
  closeBrandMenu();
  if(!brand){ showToast('Type a brand in this row first, then click the menu'); if(inp) inp.focus(); return; }
  _brandMenuBrand=brand;
  var n=getAllAdminProducts().filter(function(p){return getBrand(p.id).trim().toLowerCase()===brand.toLowerCase();}).length;
  var m=document.createElement('div'); m.className='brand-menu'; m.id='brandMenu';
  m.innerHTML=
    '<div class="bm-head">'+encodeHtml(brand)+' · '+n+' product'+(n!==1?'s':'')+'</div>'+
    '<button onclick="brandRun(\'select\')"><i class="fa fa-check-square"></i> Select all</button>'+
    '<button onclick="brandRun(\'hide\')"><i class="fa fa-eye-slash"></i> Hide all</button>'+
    '<button onclick="brandRun(\'show\')"><i class="fa fa-eye"></i> Show all</button>'+
    '<button onclick="brandRun(\'clear\')"><i class="fa fa-times-circle"></i> Clear stock (all)</button>'+
    '<button onclick="brandRun(\'add\')"><i class="fa fa-plus"></i> +50 stock (all)</button>'+
    '<button class="bm-del" onclick="brandRun(\'delete\')"><i class="fa fa-trash"></i> Delete all</button>';
  document.body.appendChild(m);
  var r=(ev&&ev.currentTarget?ev.currentTarget:inp).getBoundingClientRect();
  var mw=210;
  m.style.top=(r.bottom+window.scrollY+5)+'px';
  m.style.left=(Math.max(8,Math.min(r.left+window.scrollX, window.scrollX+window.innerWidth-mw-8)))+'px';
  setTimeout(function(){ document.addEventListener('mousedown',_brandMenuOutside); },0);
}
function brandRun(action){
  var brand=(_brandMenuBrand||'').trim(); closeBrandMenu();
  if(!brand) return;
  var ids=getAllAdminProducts().filter(function(p){return getBrand(p.id).trim().toLowerCase()===brand.toLowerCase();}).map(function(p){return p.id;});
  if(!ids.length){ showToast('No products with brand "'+brand+'"'); return; }
  _selectedIds=new Set(ids);
  document.querySelectorAll('.row-chk').forEach(function(c){ c.checked=_selectedIds.has(parseInt(c.getAttribute('data-id'))); });
  _syncBulkBar();
  if(action==='select'){ showToast(ids.length+' "'+brand+'" product'+(ids.length!==1?'s':'')+' selected'); return; }
  if(action==='hide')  return bulkHide();
  if(action==='show')  return bulkShow();
  if(action==='clear') return bulkClearStock();
  if(action==='add')   return bulkAddStock();
  if(action==='delete')return bulkDelete();
}

// ── MULTI-CATEGORY ─────────────────────────────────────────────────────────────
// Lets you assign a product to more than one category (e.g. both Taps and Bathroom).
// openMC(id)   — opens the category picker popup for a product
// saveMC()     — saves the selected categories to Supabase
// closeMC()    — closes the popup without saving
var _mcCurrentId = null;

// Extra-category assignments live in Supabase (expert_settings key
// 'multi_cats', loaded by loadFromSupabase into window._sbMultiCats) so
// visitors and every admin account see them — they used to be localStorage
// only, which meant assignments silently never reached the storefront.
function getExtraCats(id) {
  if (window._sbMultiCats && Array.isArray(window._sbMultiCats[String(id)])) return window._sbMultiCats[String(id)];
  try {
    var map=JSON.parse(localStorage.getItem('bahar_multi_cats')||'{}');
    return Array.isArray(map[String(id)]) ? map[String(id)] : [];
  } catch(e){ return []; }
}
function saveExtraCats(id, cats) {
  if (!window._sbMultiCats) window._sbMultiCats = {};
  window._sbMultiCats[String(id)] = cats;
  try { localStorage.setItem('bahar_multi_cats', JSON.stringify(window._sbMultiCats)); } catch(e){}
  _pushMultiCats();
}
// Debounced upsert of the whole map to Supabase
function _pushMultiCats() {
  clearTimeout(window._mcPushT);
  window._mcPushT = setTimeout(function() {
    sbFetch(SB_URL + '/rest/v1/expert_settings', {
      method: 'POST',
      headers: Object.assign({}, SB_HDRS, { 'Prefer': 'resolution=merge-duplicates' }),
      body: JSON.stringify([{ key: 'multi_cats', value: JSON.stringify(window._sbMultiCats || {}) }])
    });
  }, 400);
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
  const photos = JSON.parse(localStorage.getItem('jain_photos')||'{}');
  photos[currentPhotoId] = finalUrl;
  localStorage.setItem('jain_photos', JSON.stringify(photos));
  const th = document.getElementById('thumb'+currentPhotoId);
  if (th) th.src = finalUrl;

  // Save URL to Supabase jain_photos table
  const { error: dbErr } = await sbFetch(SB_URL + '/rest/v1/expert_photos', {
    method: 'POST',
    headers: Object.assign({}, SB_HDRS, { 'Prefer': 'resolution=merge-duplicates' }),
    body: JSON.stringify([{ product_id: currentPhotoId, img_url: finalUrl }])
  });
  if (dbErr) console.warn('Photo DB save failed:', dbErr);

  _pendingFile = null;
  closePhoto();
  showToast('Photo saved!');
}

// ── AUTO-LOGIN ON PAGE LOAD ────────────────────────────────────────────────────
// If the browser still has a saved session (from last time), skip the login screen.
// jain_auth = '1'       → regular admin session (bahar)
// jain_auth = 'super'   → owner session (ultimate15)
// jain_auth = 'bahar15' → manager session (bahar15)
// jain_auth = 'custom'  → restricted team account (see admin/js/03-auth.js)
if (localStorage.getItem('jain_auth') === '1')       { showAdmin(); }
if (localStorage.getItem('jain_auth') === 'super')   { showSuperAdmin(); }
if (localStorage.getItem('jain_auth') === 'bahar15') { showManager(); }
if (localStorage.getItem('jain_auth') === 'custom')  {
  var _savedPerms = {};
  try { _savedPerms = JSON.parse(localStorage.getItem('jain_custom_perms') || '{}'); } catch(e) {}
  showCustomAdmin(_savedPerms);
}
