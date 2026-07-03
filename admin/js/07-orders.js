// ── ORDERS ─────────────────────────────────────────────────────────────────────
// Handles the Orders tab — loads orders from Supabase, displays them, and lets
// you change their status (pending → confirmed → delivered → cancelled).
// loadOrders(forceRefresh)  — fetches orders from Supabase, shows badge count for new ones
// renderOrdersTab()         — draws the orders table with filtering and search
// updateOrderStatus(id, newStatus) — changes an order's status in Supabase
// deleteOrder(id)           — moves an order to the Deleted Orders list
// exportOrdersExcel()       — downloads all orders as an Excel file
var _allOrders       = [];
var _ordFileHandle   = null;

async function loadOrders(showToastMsg) {
  if (showToastMsg) showToast('Loading orders…');
  var res = await sbFetch(SB_URL + '/rest/v1/expert_orders?select=*&order=created_at.desc', { headers: SB_HDRS });
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
      '<tr><td colspan="8"><div class="ord-empty"><i class="fa fa-receipt"></i><p>No orders found</p><small>'+(total?'Try changing the filter':'No orders yet — they appear here once customers checkout')+'</small></div></td></tr>';
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
      '<td><button class="del-btn" onclick="deleteOrder('+o.id+')" title="Delete order"><i class="fa fa-trash"></i></button></td>'+
    '</tr>';
  }).join('');
}

async function updateOrderStatus(id, newStatus, selectEl) {
  selectEl.className = 'ord-status ' + newStatus;
  var _ord = _allOrders ? _allOrders.find(function(o){return o.id===id;}) : null;
  logAction('status_change', { id:id, oldStatus:_ord?_ord.status:'unknown', newStatus:newStatus });
  if (_ord) _ord.status = newStatus;
  var res = await sbFetch(SB_URL + '/rest/v1/expert_orders?id=eq.'+id, {
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
  XLSX.writeFile(wb, 'Jain_Orders_'+date+'.xlsx');
  showToast('Orders Excel downloaded ✅');
}

async function connectOrdersFile() {
  if (!window.showSaveFilePicker) { showToast('Use Chrome or Edge for auto-connect'); return; }
  try {
    var handle = await window.showSaveFilePicker({
      suggestedName: 'Jain_Orders.xlsx',
      startIn: 'documents',
      types: [{ description: 'Excel File', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }]
    });
    _ordFileHandle = handle;
    await _saveFsHandle('ord', handle);
    _updateConnectUI();
    showToast('✅ Orders file connected — use Download to save data');
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
      return '<div class="alert-chip">' +
        '<span><i class="fa fa-warning"></i> '+p.name+' &mdash; '+(stockData[p.id]||0)+' left</span>' +
        '<button class="alert-chip-btn" onclick="jumpToProduct('+p.id+')" title="Go to this product"><i class="fa fa-arrow-right"></i> View</button>' +
        '<button class="alert-chip-btn add5k" onclick="addStockAmt('+p.id+',5000)" title="Add 5000 to stock"><i class="fa fa-plus"></i> 5000</button>' +
      '</div>';
    }).join('');
  } else { box.classList.remove('show'); }
}
function card(icon, cls, label, val, sub) {
  return '<div class="stat-card"><div class="stat-icon '+cls+'"><i class="fa '+icon+'"></i></div>' +
    '<div class="stat-info"><label>'+label+'</label><strong>'+val+'</strong><small>'+sub+'</small></div></div>';
}

// â”€â”€ TABLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderTable() {
  const photos   = JSON.parse(localStorage.getItem('jain_photos')||'{}');
  const views    = JSON.parse(localStorage.getItem('bahar_views')||'{}');
  const searches = JSON.parse(localStorage.getItem('bahar_searches')||'{}');
  const q   = document.getElementById('adminSearch').value.toLowerCase();
  const cat = document.getElementById('catFilter').value;
  const brandF = (document.getElementById('brandFilter') || { value:'all' }).value;
  const list = getAllAdminProducts().filter(function(p) {
    return (cat==='all'||p.cat===cat) && (brandF==='all'||getBrand(p.id)===brandF) &&
      (!q||p.name.toLowerCase().includes(q)||getBrand(p.id).toLowerCase().includes(q)||getProductSku(p.id).toLowerCase().includes(q));
  });
  const rows = list.map(function(p) {
    const qty    = stockData[p.id]||0;
    const cls    = qty===0?'out':qty<=10?'low':'';
    const dotCls = qty===0?'dot-red':qty<=10?'dot-yellow':'dot-green';
    const status = qty===0?'Out of Stock':qty<=10?'Low Stock':'In Stock';
    const val    = (p.price*qty).toFixed(3);
    const rawPh  = photos[p.id];
    const thumb  = (rawPh && (rawPh.startsWith('http') || rawPh.startsWith('data:'))) ? rawPh : (p.img || ('https://picsum.photos/seed/dhow'+p.id+'/80/80'));
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
      '<td><div class="brand-cell"><input class="brand-input" id="bi'+p.id+'" value="'+encodeHtml(getBrand(p.id))+'" placeholder="Brand" oninput="onBrandEdit('+p.id+')" /><button class="brand-menu-btn" title="Brand actions" onclick="openBrandMenu('+p.id+',event)"><i class="fa fa-ellipsis-v"></i></button></div></td>' +
      '<td><input class="price-input" id="pi'+p.id+'" type="number" step="0.001" min="0" value="'+((_prodOverrides[p.id]||{}).price!==undefined?(_prodOverrides[p.id].price).toFixed(3):p.price.toFixed(3))+'" oninput="onPriceEdit('+p.id+')" /></td>' +
      '<td>' + (window._hideStockNumbers
        ? '<span class="status-dot"><span class="dot '+dotCls+'"></span>'+status+'</span>'
        : '<input type="number" class="stock-input '+cls+'" id="si'+p.id+'" value="'+qty+'" min="0" oninput="onStock('+p.id+')" />') + '</td>' +
      '<td><span class="status-dot"><span class="dot '+dotCls+'"></span>'+status+'</span></td>' +
      '<td class="val-cell">'+val+'</td>' +
      '<td>' +
        '<button class="vis-btn '+visCls+'" onclick="toggleVisibility('+p.id+','+p.isBase+')">'+visLbl+'</button>' +
        '<button class="act-btn" onclick="setStock('+p.id+',0)"><i class="fa fa-times"></i> Clear</button>' +
        '<button class="act-btn" onclick="addStock('+p.id+')"><i class="fa fa-plus"></i> +50</button>' +
        '<button class="act-btn" onclick="addStock5000('+p.id+')"><i class="fa fa-plus"></i> +5000</button>' +
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
    '<tr class="tfoot-row"><td colspan="6">TOTAL ('+list.length+' shown, '+list.filter(function(p){return p.hidden;}).length+' hidden)</td>' +
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
function getBrand(id){ return ((_prodOverrides[id]||{}).brand)||BASE_BRANDS[id]||''; }
function onBrandEdit(id){
  var el=document.getElementById('bi'+id); if(!el) return;
  if(!_prodOverrides[id]) _prodOverrides[id]={};
  _prodOverrides[id].brand=el.value;
  localStorage.setItem('bahar_overrides', JSON.stringify(_prodOverrides));
}
function setStock(id, qty) { _pushUndo(); stockData[id]=qty; renderTable(); renderStats(); }
function addStock(id) { _pushUndo(); const cur=stockData[id]||0; const nq=Math.ceil((cur+1)/50)*50; logAction('stock_change',{id:id,name:(getAllAdminProducts().find(function(p){return p.id===id;})||{}).name||'#'+id,oldQty:cur,newQty:nq}); stockData[id]=nq; renderTable(); renderStats(); }
function addStock5000(id) { _pushUndo(); const cur=stockData[id]||0; const nq=cur+5000; logAction('stock_change',{id:id,name:(getAllAdminProducts().find(function(p){return p.id===id;})||{}).name||'#'+id,oldQty:cur,newQty:nq}); stockData[id]=nq; renderTable(); renderStats(); }
// Add an exact amount of stock (used by the +5000 button in the low/out-of-stock alerts)
function addStockAmt(id, amt) {
  _pushUndo();
  const cur = stockData[id]||0;
  const nq  = cur + amt;
  logAction('stock_change',{id:id,name:(getAllAdminProducts().find(function(p){return p.id===id;})||{}).name||('#'+id),oldQty:cur,newQty:nq});
  stockData[id] = nq;
  renderTable(); renderStats();
  showToast('Added '+amt+' to stock');
}
// Jump from an alert chip to that product's row in the inventory table, then highlight it
function jumpToProduct(id) {
  switchTab('inventory');
  const search = document.getElementById('adminSearch'); if (search) search.value = '';
  if (typeof fcReset === 'function') fcReset();   // clear category + brand dropdowns
  renderTable();
  setTimeout(function() {
    const thumb = document.getElementById('thumb'+id);
    const row = thumb ? thumb.closest('tr') : null;
    if (row) {
      row.scrollIntoView({ behavior:'smooth', block:'center' });
      row.classList.add('row-flash');
      setTimeout(function(){ row.classList.remove('row-flash'); }, 2000);
    }
  }, 120);
}
async function saveAll() {
  _pushUndo();
  // collect name + price edits
  getAllAdminProducts().forEach(function(p) {
    var ni = document.getElementById('ni'+p.id);
    var pi = document.getElementById('pi'+p.id);
    if (ni) { if (!_prodOverrides[p.id]) _prodOverrides[p.id]={}; _prodOverrides[p.id].name = ni.value; }
    if (pi) { var pv=parseFloat(pi.value); if (!isNaN(pv)) { if (!_prodOverrides[p.id]) _prodOverrides[p.id]={}; _prodOverrides[p.id].price=pv; } }
  });
  localStorage.setItem('bahar_overrides', JSON.stringify(_prodOverrides));

  PRODUCTS.forEach(function(p) { const el=document.getElementById('si'+p.id); if(el) stockData[p.id]=Math.max(0,parseInt(el.value)||0); });
  localStorage.setItem('jain_stock', JSON.stringify(stockData));
  const rows = PRODUCTS.map(function(p) { return { product_id: p.id, qty: stockData[p.id]||0 }; });
  const { error } = await sbFetch(SB_URL + '/rest/v1/expert_stock', {
    method: 'POST',
    headers: Object.assign({}, SB_HDRS, { 'Prefer': 'resolution=merge-duplicates' }),
    body: JSON.stringify(rows)
  });
  showToast(error ? 'Saved locally (cloud error)' : 'Saved to cloud â˜ï¸');
  renderStats();
}

// â”€â”€ ANALYTICS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function renderAnalytics() {
  // Show loading state
  document.getElementById('analyticsStats').innerHTML = '<div style=”color:#aaa;font-size:13px;padding:16px”>Loading analytics...</div>';
  document.getElementById('viewsTable').innerHTML = '';
  document.getElementById('searchesTable').innerHTML = '';

  // Read from Supabase (works regardless of which origin admin is opened from)
  const result = await sbFetch(SB_URL + '/rest/v1/expert_analytics?select=*', { headers: SB_HDRS });

  var views = {}, searches = {};
  if (!result.error && Array.isArray(result.data) && result.data.length > 0) {
    result.data.forEach(function(row) {
      views[row.product_id]    = row.views    || 0;
      searches[row.product_id] = row.searches || 0;
    });
  } else {
    // Fallback: localStorage (only works if admin is on same origin as storefront)
    try { views    = JSON.parse(localStorage.getItem('bahar_views')    || '{}'); } catch(e) {}
    try { searches = JSON.parse(localStorage.getItem('bahar_searches') || '{}'); } catch(e) {}
  }

  const photos = JSON.parse(localStorage.getItem('jain_photos') || '{}');
  const totalViews    = Object.values(views).reduce(function(a,b){return a+b;}, 0);
  const totalSearches = Object.values(searches).reduce(function(a,b){return a+b;}, 0);

  const topV = PRODUCTS.slice().sort(function(a,b){ return (views[b.id]||0)-(views[a.id]||0); })[0];
  const topS = PRODUCTS.slice().sort(function(a,b){ return (searches[b.id]||0)-(searches[a.id]||0); })[0];

  document.getElementById('analyticsStats').innerHTML =
    aCard('fa-eye','ic-orange','Total Views', totalViews, 'Add-to-cart clicks') +
    aCard('fa-search','ic-purple','Total Searches', totalSearches, 'Search appearances') +
    aCard('fa-fire','ic-orange','Most Viewed', topV ? (views[topV.id]||0)+' views' : '—', topV ? topV.name : 'No data yet') +
    aCard('fa-trophy','ic-purple','Most Searched', topS ? (searches[topS.id]||0)+' times' : '—', topS ? topS.name : 'No data yet');

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
    const rawPh2 = photos[p.id];
    const thumb = (rawPh2 && (rawPh2.startsWith('http') || rawPh2.startsWith('data:'))) ? rawPh2 : (p.img || ('https://picsum.photos/seed/dhow'+p.id+'/80/80'));
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
async function resetViews() {
  if (!confirm('Reset all view data?')) return;
  localStorage.removeItem('bahar_views');
  // Zero out views in Supabase
  await sbFetch(SB_URL + '/rest/v1/expert_analytics?select=product_id', { headers: SB_HDRS })
    .then(function(r) {
      if (!r.error && Array.isArray(r.data)) {
        return sbFetch(SB_URL + '/rest/v1/expert_analytics?product_id=gte.0', {
          method: 'PATCH',
          headers: Object.assign({}, SB_HDRS, { 'Prefer': 'return=minimal' }),
          body: JSON.stringify({ views: 0 })
        });
      }
    });
  renderAnalytics(); renderTable();
  showToast('View data reset');
}
async function resetSearches() {
  if (!confirm('Reset all search data?')) return;
  localStorage.removeItem('bahar_searches');
  // Zero out searches in Supabase
  await sbFetch(SB_URL + '/rest/v1/expert_analytics?product_id=gte.0', {
    method: 'PATCH',
    headers: Object.assign({}, SB_HDRS, { 'Prefer': 'return=minimal' }),
    body: JSON.stringify({ searches: 0 })
  });
  renderAnalytics(); renderTable();
  showToast('Search data reset');
}

// â”€â”€ PRODUCT STATS MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openStats(id) {
  const p = PRODUCTS.find(function(x) { return x.id===id; });
  const views   = JSON.parse(localStorage.getItem('bahar_views')||'{}');
  const searches= JSON.parse(localStorage.getItem('bahar_searches')||'{}');
  const photos  = JSON.parse(localStorage.getItem('jain_photos')||'{}');
  const vCount  = views[id]||0;
  const sCount  = searches[id]||0;

  // Compute ranks
  const sortedV = PRODUCTS.slice().sort(function(a,b){ return (views[b.id]||0)-(views[a.id]||0); });
  const sortedS = PRODUCTS.slice().sort(function(a,b){ return (searches[b.id]||0)-(searches[a.id]||0); });
  const vRank   = sortedV.findIndex(function(x){ return x.id===id; })+1;
  const sRank   = sortedS.findIndex(function(x){ return x.id===id; })+1;
  const rawPhS  = photos[id];
  const thumb   = (rawPhS && (rawPhS.startsWith('http') || rawPhS.startsWith('data:'))) ? rawPhS : (p.img || ('https://picsum.photos/seed/dhow'+id+'/80/80'));

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
      ({ error: err } = await sbFetch(SB_URL + '/rest/v1/expert_hidden?product_id=eq.' + id, { method:'DELETE', headers:SB_HDRS }));
      if (!err) _hiddenBaseIds.delete(id);
    } else {
      ({ error: err } = await sbFetch(SB_URL + '/rest/v1/expert_hidden', {
        method:'POST', headers:Object.assign({},SB_HDRS,{'Prefer':'resolution=merge-duplicates'}),
        body:JSON.stringify([{product_id:id, hidden:true}])
      }));
      if (!err) _hiddenBaseIds.add(id);
    }
  } else {
    const row = _customProductRows.find(function(p){ return p.id===id; });
    if (!row) return;
    const newHidden = !row.hidden;
    ({ error: err } = await sbFetch(SB_URL + '/rest/v1/expert_products?id=eq.' + id, {
      method:'PATCH', headers:SB_HDRS, body:JSON.stringify({hidden:newHidden})
    }));
    if (!err) row.hidden = newHidden;
  }
  if (err) { showToast('Error updating visibility'); return; }
  const isNowHidden = isBase ? _hiddenBaseIds.has(id) : !!(_customProductRows.find(function(p){return p.id===id;})?.hidden);
  showToast(isNowHidden ? 'Product hidden from store' : 'Product now visible');
  renderTable();
}

