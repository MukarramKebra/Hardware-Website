// ── CSV / EXCEL IMPORT ─────────────────────────────────────────────────────────
// Lets you bulk-import products from a CSV or Excel file instead of adding one by one.
// openCSV()          — opens the CSV import modal
// handleCSVFile()    — reads the chosen file and previews the rows
// handleCSVImages()  — lets you upload images for products in the CSV
// importCSVProducts()— saves all the CSV rows as new products in Supabase
// downloadTemplate() — downloads a sample CSV file so you know the correct format
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
  // Proper CSV field split: quoted fields may contain commas and "" (an
  // escaped quote — e.g. product names with inch marks like 6"-1). The old
  // regex stopped at the first quote it saw, shifting every later column and
  // silently dropping those rows on import.
  function splitCSVLine(line) {
    const vals = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"') {
          if (line[i+1] === '"') { cur += '"'; i++; }
          else inQ = false;
        } else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ',') { vals.push(cur); cur = ''; }
      else cur += ch;
    }
    vals.push(cur);
    return vals;
  }
  const headers = splitCSVLine(lines[0]).map(function(h){return h.trim().toLowerCase().replace(/['"]/g,'').replace(/\s+/g,'_');});
  return lines.slice(1).map(function(line) {
    const vals = splitCSVLine(line);
    const obj  = {};
    headers.forEach(function(h,i){ obj[h] = (vals[i]||'').trim(); });
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
    '<table class="csv-prev-tbl"><thead><tr>'+(showImgCol?'<th>Image</th>':'')+'<th>Name</th><th>Category</th><th>Brand</th><th>Price KWD</th><th>Stock</th></tr></thead><tbody>' +
    show.map(function(r, i){
      var imgCell = '';
      if (showImgCol) {
        var src = _rowImageMap[i] || (_csvImageMap[(r.image||r.img||'').trim().toLowerCase()]) || '';
        imgCell = src
          ? '<td><img src="'+src+'" style="width:36px;height:36px;border-radius:5px;object-fit:cover;border:1px solid #e9d5ff" /></td>'
          : '<td style="color:#ccc;font-size:11px">—</td>';
      }
      return '<tr>'+imgCell+'<td>'+r.name+'</td><td>'+r.category+'</td><td>'+(r.brand||'—')+'</td><td>'+parseFloat(r.price).toFixed(3)+'</td><td>'+(r.stock||'50')+'</td></tr>';
    }).join('') +
    (_csvParsedRows.length>5 ? '<tr><td colspan="'+(showImgCol?6:5)+'" style="text-align:center;color:#aaa;font-style:italic">… and '+(_csvParsedRows.length-5)+' more</td></tr>' : '') +
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
  try { localPhotos = JSON.parse(localStorage.getItem('jain_photos') || '{}'); } catch(_) {}

  for (let i = 0; i < _csvParsedRows.length; i++) {
    const r = _csvParsedRows[i];
    // Resolve image: 1) Excel embedded image (by row index), 2) manually uploaded file (by filename), 3) URL column
    const embeddedImg = _rowImageMap[i] || '';
    const imgFilename = (r.image || r.img || '').trim().toLowerCase();
    const namedImg    = imgFilename && _csvImageMap[imgFilename] ? _csvImageMap[imgFilename] : '';
    const imgDataUrl  = embeddedImg || namedImg;
    const imgUrl      = imgDataUrl || r.image_url || r.img_url || '';

    const { data: rows, error } = await sbFetch(SB_URL + '/rest/v1/expert_products', {
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
      // Real SKU: explicit "sku" column wins, else derive it from the image
      // filename (our export names images after the product's SKU)
      const rawImgName = (r.image || r.img || '').trim();
      const skuVal = (r.sku && r.sku.trim()) || rawImgName.replace(/\.(png|jpe?g|webp|gif)$/i, '');
      if (skuVal && skuVal !== rawImgName) {
        if (!window._sbSkuMap) window._sbSkuMap = {};
        window._sbSkuMap[String(newId)] = skuVal;
      }
      if (r.brand && r.brand.trim()) {
        if (!_prodOverrides[newId]) _prodOverrides[newId] = {};
        _prodOverrides[newId].brand = r.brand.trim();
        if (!window._sbBrandMap) window._sbBrandMap = {};
        window._sbBrandMap[String(newId)] = r.brand.trim();
      }
      const qty   = parseInt(r.stock)||50;
      stockData[newId] = qty;
      await sbFetch(SB_URL + '/rest/v1/expert_stock', {
        method:'POST', headers:Object.assign({},SB_HDRS,{'Prefer':'resolution=merge-duplicates'}),
        body:JSON.stringify([{product_id:newId, qty}])
      });
      // Save image to localStorage photos store (so storefront picks it up offline too)
      if (imgDataUrl) {
        localPhotos[String(newId)] = imgDataUrl;
        // Also save to Supabase photos table
        sbFetch(SB_URL + '/rest/v1/expert_photos', {
          method:'POST', headers:Object.assign({},SB_HDRS,{'Prefer':'resolution=merge-duplicates'}),
          body:JSON.stringify([{product_id:newId, url:imgDataUrl}])
        });
      }
      count++;
    }
  }
  // Persist photos to localStorage
  localStorage.setItem('jain_photos', JSON.stringify(localPhotos));
  // Persist imported brands (stored like inline brand edits)
  localStorage.setItem('bahar_overrides', JSON.stringify(_prodOverrides));
  // Persist real SKUs + brands to Supabase so the storefront shows them
  if (window._sbSkuMap) {
    localStorage.setItem('jain_sku_map', JSON.stringify(window._sbSkuMap));
    if (typeof _pushSkuMap === 'function') _pushSkuMap();
  }
  if (window._sbBrandMap && typeof _pushBrandMap === 'function') _pushBrandMap();
  const imgCount = Object.keys(_rowImageMap).length || Object.keys(_csvImageMap).length;
  showToast(count + ' product'+(count!==1?'s':'')+' imported' + (imgCount ? ' with '+imgCount+' image'+(imgCount!==1?'s':'') : '') + '! ✅');
  closeCSV();
  await loadFromSupabase();
  btn.disabled = false; btn.innerHTML = '<i class="fa fa-download"></i> Import All Products';
}
function downloadTemplate() {
  const csv = [
    'name,category,price,stock,description,badge,brand,image',
    'Cordless Drill 20V,tools,18.500,50,20V drill with keyless chuck and LED light,Best Seller,DCK,drill.jpg',
    'Heavy Duty Hammer,hand-tools,3.200,100,16oz forged steel claw hammer,,Stanley,hammer.jpg',
    'Wood Screws 200pc,fastener,1.500,200,Self-tapping wood screws assorted sizes,Popular,TOLSEN,screws.jpg'
  ].join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'expert_import_template.csv';
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
  return JSON.parse(localStorage.getItem('bahar_categories') || '[]');
}
function getAllCats() {
  return [...DEFAULT_CATS, ...getCustomCats()];
}
function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function refreshCategorySelects() {
  const cats = getAllCats();
  const prodOpts = cats.map(c => '<option value="'+c.slug+'">'+c.label+'</option>').join('');
  const apCat = document.getElementById('apCat');
  if (apCat) apCat.innerHTML = prodOpts;
}

// ── SEARCHABLE FILTER DROPDOWNS (category + brand) ────────────────────────────
// The toolbar's Category and Brand filters are custom dropdowns with a search
// box inside. The chosen value lives in hidden inputs #catFilter/#brandFilter
// so renderTable() reads them exactly like the old <select> it replaced.
var _fcOptions = { cat: [], brand: [] };
var _fcVisible = { cat: [], brand: [] };

function _fcRebuild(kind) {
  if (kind === 'cat') {
    _fcOptions.cat = [{ value:'all', label:'All Categories' }].concat(
      getAllCats().map(function(c){ return { value:c.slug, label:c.label }; }));
  } else {
    var brands = {};
    getAllAdminProducts().forEach(function(p){ var b = getBrand(p.id); if (b) brands[b] = true; });
    _fcOptions.brand = [{ value:'all', label:'All Brands' }].concat(
      Object.keys(brands).sort(function(a,b){ return a.toLowerCase().localeCompare(b.toLowerCase()); })
        .map(function(b){ return { value:b, label:b }; }));
  }
}
function fcToggle(kind) {
  var panel = document.getElementById(kind + 'ComboPanel');
  var wasOpen = panel.classList.contains('open');
  fcCloseAll();
  if (wasOpen) return;
  _fcRebuild(kind);
  document.getElementById(kind + 'ComboSearch').value = '';
  fcRenderList(kind, '');
  panel.classList.add('open');
  setTimeout(function(){ document.getElementById(kind + 'ComboSearch').focus(); }, 60);
}
function fcCloseAll() {
  document.querySelectorAll('.fc-panel.open').forEach(function(p){ p.classList.remove('open'); });
}
document.addEventListener('click', function(e) {
  if (!e.target.closest('.filter-combo')) fcCloseAll();
});
function fcRenderList(kind, q) {
  q = (q || '').toLowerCase();
  var cur = document.getElementById(kind === 'cat' ? 'catFilter' : 'brandFilter').value;
  _fcVisible[kind] = _fcOptions[kind].filter(function(o){ return !q || o.label.toLowerCase().includes(q); });
  document.getElementById(kind + 'ComboList').innerHTML = _fcVisible[kind].length
    ? _fcVisible[kind].map(function(o, i) {
        return '<div class="fc-opt' + (o.value === cur ? ' sel' : '') + '" onclick="fcPick(\'' + kind + '\',' + i + ')">' +
          encodeHtml(o.label) + (o.value === cur ? ' <i class="fa fa-check"></i>' : '') + '</div>';
      }).join('')
    : '<div class="fc-empty">No matches</div>';
}
function fcFilterList(kind) { fcRenderList(kind, document.getElementById(kind + 'ComboSearch').value); }
function fcPick(kind, i) {
  var o = _fcVisible[kind][i];
  if (o) fcSet(kind, o.value, o.label);
}
function fcSet(kind, value, label) {
  document.getElementById(kind === 'cat' ? 'catFilter' : 'brandFilter').value = value;
  document.getElementById(kind + 'ComboLabel').textContent =
    value === 'all' ? (kind === 'cat' ? 'All Categories' : 'All Brands') : (label || value);
  fcCloseAll();
  renderTable();
}
function fcReset() {
  fcSetSilent('cat', 'all');
  fcSetSilent('brand', 'all');
}
function fcSetSilent(kind, value) {
  var hid = document.getElementById(kind === 'cat' ? 'catFilter' : 'brandFilter');
  if (hid) hid.value = value;
  var lbl = document.getElementById(kind + 'ComboLabel');
  if (lbl) lbl.textContent = kind === 'cat' ? 'All Categories' : 'All Brands';
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
  localStorage.setItem('bahar_categories', JSON.stringify(custom));
  document.getElementById('newCatInput').value = '';
  document.getElementById('newCatSlug').textContent = 'â€”';
  renderCatChips();
  refreshCategorySelects();
  showToast('Category "' + name + '" added!');
}
function deleteCustomCat(slug) {
  if (!confirm('Delete this category? Products using it won\'t be affected.')) return;
  const custom = getCustomCats().filter(c => c.slug !== slug);
  localStorage.setItem('bahar_categories', JSON.stringify(custom));
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
  const photos = JSON.parse(localStorage.getItem('jain_photos')||'{}');
  const rawPhO = photos[id];
  const src = (rawPhO && (rawPhO.startsWith('http') || rawPhO.startsWith('data:'))) ? rawPhO : (p.img || '');
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

