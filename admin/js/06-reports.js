// ── REPORTS ────────────────────────────────────────────────────────────────────
// Builds the read-only tables shown in the Reports tab (inventory snapshot, sales, orders).
// renderReports()       — draws the Inventory Report and Sales Report tables
// renderOrdersReport()  — draws the Customer Orders Report table
// exportInventoryExcel() / exportSalesExcel() / exportOrdersExcel()
//   → Download button: creates and downloads an Excel (.xlsx) file immediately
// connectInventoryFile() / connectSalesFile() / connectOrdersFile()
//   → Connect button: picks a save location on your computer (no download yet)
// _autoWriteReports()   — when Reports tab is opened, auto-saves to connected files
function renderReports() {
  const all     = getAllAdminProducts();
  const views   = JSON.parse(localStorage.getItem('bahar_views')   || '{}');
  const searches= JSON.parse(localStorage.getItem('bahar_searches')|| '{}');
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
  XLSX.writeFile(wb, 'Jain_Inventory_'+date+'.xlsx');
  showToast('Inventory Excel downloaded ✅');
}

function exportSalesExcel() {
  if (typeof XLSX === 'undefined') { showToast('Excel library loading — try again'); return; }
  const all     = getAllAdminProducts();
  const views   = JSON.parse(localStorage.getItem('bahar_views')   || '{}');
  const searches= JSON.parse(localStorage.getItem('bahar_searches')|| '{}');
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
  XLSX.writeFile(wb, 'Jain_Sales_'+date+'.xlsx');
  showToast('Sales Excel downloaded ✅');
}

// ── FILE SYSTEM ACCESS API — AUTO-UPDATE EXCEL FILES ──────────────────────────
// Uses the browser's File System Access API (Chrome/Edge only) to write directly
// to Excel files on your computer without a download dialog.
// _invFileHandle / _salesFileHandle / _ordFileHandle  — saved references to connected files
// _loadSavedHandles()  — restores file connections after page refresh
// _saveFsHandle()      — saves a file handle to IndexedDB so it survives refresh
// _writeToHandle()     — actually writes the Excel data into the connected file
// _updateConnectUI()   — updates the "Connect File" button to show "Connected ✓"
// Stores file handles in IndexedDB so they survive page reloads.
// User clicks "Connect File" once → admin panel writes directly on every Reports open.

var _invFileHandle   = null;
var _salesFileHandle = null;

function _openFsDb() {
  return new Promise(function(resolve, reject) {
    var req = indexedDB.open('bahar_fs', 1);
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
  var views   = JSON.parse(localStorage.getItem('bahar_views')   || '{}');
  var searches= JSON.parse(localStorage.getItem('bahar_searches')|| '{}');
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
      suggestedName: 'Jain_Inventory.xlsx',
      startIn: 'documents',
      types: [{ description: 'Excel File', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }]
    });
    _invFileHandle = handle;
    await _saveFsHandle('inv', handle);
    _updateConnectUI();
    showToast('✅ Inventory file connected — use Download to save data');
  } catch(e) { if (e.name !== 'AbortError') showToast('Could not connect file'); }
}

async function connectSalesFile() {
  if (!window.showSaveFilePicker) {
    showToast('Use Chrome or Edge for auto-connect'); return;
  }
  try {
    var handle = await window.showSaveFilePicker({
      suggestedName: 'Jain_Sales.xlsx',
      startIn: 'documents',
      types: [{ description: 'Excel File', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }]
    });
    _salesFileHandle = handle;
    await _saveFsHandle('sales', handle);
    _updateConnectUI();
    showToast('✅ Sales file connected — use Download to save data');
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

