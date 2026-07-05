// ── DELETE & TRASH SYSTEM ──────────────────────────────────────────────────────
// Deleted products are NOT permanently removed — they're stored in localStorage
// (jain_deleted) for 60 days so you can restore them any time.
// deleteProduct(id)       — moves a product to the deleted list, removes from Supabase
// getDeletedProducts()    — reads the deleted list from localStorage
// saveDeletedProducts()   — writes the deleted list back to localStorage
// renderDeletedTab()      — draws the Deleted Products table
// restoreProduct(id)      — puts a deleted product back (re-inserts to Supabase)
// permanentDelete(id)     — removes a product completely with no recovery possible
const _DELETED_TTL = 60 * 24 * 60 * 60 * 1000; // 60 days

function getDeletedProducts() {
  try {
    const raw = JSON.parse(localStorage.getItem('jain_deleted') || '[]');
    const cutoff = Date.now() - _DELETED_TTL;
    const valid = raw.filter(function(d){ return d.deletedAt > cutoff; });
    if (valid.length !== raw.length) localStorage.setItem('jain_deleted', JSON.stringify(valid));
    return valid;
  } catch(e) { return []; }
}
function saveDeletedProducts(list) { localStorage.setItem('jain_deleted', JSON.stringify(list)); }

async function deleteProduct(id, isBase) {
  if (!confirm('Delete this product? It moves to the Deleted tab for 60 days — you can restore it any time.')) return;
  const prod = getAllAdminProducts().find(function(p){ return p.id===id; });
  if (!prod) return;
  // Save snapshot to deleted list
  const deleted = getDeletedProducts().filter(function(d){ return d.id!==id; });
  deleted.push({ id:prod.id, name:prod.name, cat:prod.cat, price:prod.price, img:prod.img, isBase:prod.isBase, deletedAt:Date.now() });
  saveDeletedProducts(deleted);
  logAction('delete_product', { id:prod.id, name:prod.name, isBase:prod.isBase });
  if (isBase) {
    const { error } = await sbFetch(SB_URL + '/rest/v1/expert_hidden', {
      method:'POST', headers: Object.assign({},SB_HDRS,{'Prefer':'resolution=ignore-duplicates'}),
      body:JSON.stringify({ product_id: id })
    });
    if (error) console.warn('Hide on delete failed:', error);
    _hiddenBaseIds.add(id);
  } else {
    await Promise.all([
      sbFetch(SB_URL + '/rest/v1/expert_products?id=eq.' + id,       { method:'DELETE', headers:SB_HDRS }),
      sbFetch(SB_URL + '/rest/v1/expert_stock?product_id=eq.' + id,  { method:'DELETE', headers:SB_HDRS }),
      sbFetch(SB_URL + '/rest/v1/expert_photos?product_id=eq.' + id, { method:'DELETE', headers:SB_HDRS })
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
    const { error } = await sbFetch(SB_URL + '/rest/v1/expert_hidden?product_id=eq.' + id, { method:'DELETE', headers:SB_HDRS });
    if (error) { showToast('Restore failed: ' + error); return; }
    _hiddenBaseIds.delete(id);
  } else {
    const { error } = await sbFetch(SB_URL + '/rest/v1/expert_products', {
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
  // Also remove from audit log so it no longer appears in Owner Controls
  saveAuditLog(getAuditLog().filter(function(e){
    return !(e.data && e.data.id === id && (e.action === 'delete_product' || e.action === 'add_product'));
  }));
  renderDeletedTab();
  renderSuperAdmin();
  showToast('Permanently removed');
}

// ── DELETED SUB-TABS ───────────────────────────────────────────────────────────
// The Deleted tab has two sub-tabs: "Deleted Products" and "Deleted Orders"
// switchDeletedSubTab(tab) — switches between the two panes
var _deletedSubTab = 'products';
function switchDeletedSubTab(tab) {
  _deletedSubTab = tab;
  document.getElementById('delProductsPane').style.display = tab === 'products' ? 'block' : 'none';
  document.getElementById('delOrdersPane').style.display   = tab === 'orders'   ? 'block' : 'none';
  var pBtn = document.getElementById('delTabProducts');
  var oBtn = document.getElementById('delTabOrders');
  pBtn.style.borderBottomColor = tab === 'products' ? 'var(--orange)' : 'transparent';
  pBtn.style.color             = tab === 'products' ? 'var(--orange)' : 'var(--gray)';
  oBtn.style.borderBottomColor = tab === 'orders'   ? 'var(--orange)' : 'transparent';
  oBtn.style.color             = tab === 'orders'   ? 'var(--orange)' : 'var(--gray)';
  if (tab === 'products') renderDeletedTab();
  if (tab === 'orders')   renderDeletedOrdersTab();
}

// ── DELETED ORDERS ─────────────────────────────────────────────────────────────
// Same concept as deleted products — deleted orders go to localStorage (jain_deleted_orders).
// deleteOrder(id)             — moves an order to deleted list, removes from Supabase
// getDeletedOrders()          — reads deleted orders from localStorage
// saveDeletedOrders()         — writes back to localStorage
// renderDeletedOrdersTab()    — draws the Deleted Orders table
// restoreOrder(id)            — puts a deleted order back into Supabase
// permanentDeleteOrder(id)    — removes an order with no recovery
function getDeletedOrders() {
  try {
    var raw    = JSON.parse(localStorage.getItem('jain_deleted_orders') || '[]');
    var cutoff = Date.now() - _DELETED_TTL;
    var valid  = raw.filter(function(d){ return d.deletedAt > cutoff; });
    if (valid.length !== raw.length) localStorage.setItem('jain_deleted_orders', JSON.stringify(valid));
    return valid;
  } catch(e) { return []; }
}
function saveDeletedOrders(list) { localStorage.setItem('jain_deleted_orders', JSON.stringify(list)); }

async function deleteOrder(id) {
  if (!confirm('Delete this order? It moves to the Deleted tab for 60 days — you can restore it any time.')) return;
  var order = _allOrders.find(function(o){ return o.id === id; });
  if (!order) return;
  // Save snapshot to local deleted list
  var snap = JSON.parse(JSON.stringify(order));
  snap.deletedAt = Date.now();
  var del = getDeletedOrders().filter(function(d){ return d.id !== id; });
  del.push(snap);
  saveDeletedOrders(del);
  logAction('delete_order', { id:order.id, customer_name:order.customer_name });
  // Remove from Supabase
  var res = await sbFetch(SB_URL + '/rest/v1/expert_orders?id=eq.' + id, { method: 'DELETE', headers: SB_HDRS });
  if (res.error) { showToast('Delete failed: ' + res.error); return; }
  // Remove from local list and re-render
  _allOrders = _allOrders.filter(function(o){ return o.id !== id; });
  renderOrdersTab();
  var pending = _allOrders.filter(function(o){ return o.status === 'pending'; }).length;
  var badge = document.getElementById('ordBadge');
  if (badge) { badge.textContent = pending; badge.style.display = pending ? 'inline' : 'none'; }
  showToast('Order moved to Deleted tab');
}

async function restoreOrder(id) {
  if (!confirm('Restore this order back to Orders?')) return;
  var deleted = getDeletedOrders();
  var entry   = deleted.find(function(d){ return d.id === id; });
  if (!entry) { showToast('Order not found in deleted list'); return; }
  var payload = {
    customer_name:  entry.customer_name,
    customer_phone: entry.customer_phone,
    address:        entry.address,
    notes:          entry.notes || '',
    items:          entry.items,
    total:          parseFloat(entry.total || 0),
    status:         entry.status || 'pending'
  };
  var res = await sbFetch(SB_URL + '/rest/v1/expert_orders', {
    method: 'POST',
    headers: Object.assign({}, SB_HDRS, {'Prefer':'return=representation'}),
    body: JSON.stringify([payload])
  });
  if (res.error) { showToast('Restore failed: ' + res.error); return; }
  saveDeletedOrders(deleted.filter(function(d){ return d.id !== id; }));
  showToast('Order restored!');
  await loadOrders(false);
  renderDeletedOrdersTab();
}

function permanentDeleteOrder(id) {
  if (!confirm('Permanently remove this order? This CANNOT be undone.')) return;
  saveDeletedOrders(getDeletedOrders().filter(function(d){ return d.id !== id; }));
  // Also remove from audit log so it no longer appears in Owner Controls
  saveAuditLog(getAuditLog().filter(function(e){
    return !(e.data && e.data.id === id && (e.action === 'delete_order' || e.action === 'status_change'));
  }));
  renderDeletedOrdersTab();
  renderSuperAdmin();
  showToast('Order permanently removed');
}

function renderDeletedOrdersTab() {
  var body = document.getElementById('deletedOrdersBody');
  if (!body) return;
  var deleted = getDeletedOrders().slice().sort(function(a,b){ return b.deletedAt - a.deletedAt; });
  if (!deleted.length) {
    body.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:48px;color:#aaa">' +
      '<i class="fa fa-receipt" style="font-size:36px;display:block;margin-bottom:12px;color:#ddd"></i>' +
      '<div style="font-size:14px;font-weight:700;margin-bottom:4px">No deleted orders</div>' +
      '<div style="font-size:12px">Deleted orders appear here for 60 days and can be restored.</div></td></tr>';
    return;
  }
  body.innerHTML = deleted.map(function(o) {
    var dt = o.created_at ? new Date(o.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
    var delDateStr = new Date(o.deletedAt).toLocaleDateString('en-KW',{day:'numeric',month:'short',year:'numeric'});
    var daysLeft   = 60 - Math.floor((Date.now() - o.deletedAt) / (24*60*60*1000));
    var urgency    = daysLeft <= 7 ? 'var(--red)' : daysLeft <= 14 ? 'var(--yellow)' : 'var(--gray)';
    var items = '';
    try {
      var arr = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []);
      items = arr.map(function(it){ return '<span style="display:block;opacity:0.65">• '+encodeHtml(it.name)+' ×'+it.qty+'</span>'; }).join('');
    } catch(e) { items = encodeHtml(String(o.items || '')); }
    return '<tr>' +
      '<td style="color:#aaa;font-size:11px;font-weight:700">#'+o.id+'</td>' +
      '<td class="ord-date" style="opacity:0.6;white-space:nowrap">'+dt+'</td>' +
      '<td><div class="ord-name" style="color:#888">'+encodeHtml(o.customer_name||'—')+'</div>' +
          '<div class="ord-phone" style="opacity:0.6"><i class="fab fa-whatsapp" style="color:var(--green)"></i> '+encodeHtml(o.customer_phone||'—')+'</div></td>' +
      '<td><div class="ord-addr" style="opacity:0.6">'+encodeHtml(o.address||'—')+'</div></td>' +
      '<td><div class="ord-items">'+items+'</div></td>' +
      '<td style="font-weight:900;color:#aaa">'+parseFloat(o.total||0).toFixed(3)+'</td>' +
      '<td><div style="font-size:12px;font-weight:700;color:#666">'+delDateStr+'</div>' +
          '<div style="font-size:10px;font-weight:700;color:'+urgency+'">'+daysLeft+' day'+(daysLeft!==1?'s':'')+' left</div></td>' +
      '<td style="white-space:nowrap">' +
        '<button class="act-btn" style="color:var(--green);border-color:var(--green);margin-right:4px" onclick="restoreOrder('+o.id+')"><i class="fa fa-undo"></i> Restore</button>' +
        '<button class="del-btn" onclick="permanentDeleteOrder('+o.id+')" title="Delete permanently"><i class="fa fa-times"></i></button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

function renderDeletedTab() {
  const body = document.getElementById('deletedBody');
  if (!body) return;
  const deleted = getDeletedProducts().slice().sort(function(a,b){ return b.deletedAt-a.deletedAt; });
  const photos  = JSON.parse(localStorage.getItem('jain_photos')||'{}');
  if (!deleted.length) {
    body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:48px;color:#aaa">' +
      '<i class="fa fa-trash" style="font-size:36px;display:block;margin-bottom:12px;color:#ddd"></i>' +
      '<div style="font-size:14px;font-weight:700;margin-bottom:4px">No deleted products</div>' +
      '<div style="font-size:12px">Products deleted in the last 60 days appear here and can be restored.</div></td></tr>';
    return;
  }
  body.innerHTML = deleted.map(function(d) {
    const rawPhD   = photos[d.id];
    const thumb    = (rawPhD && (rawPhD.startsWith('http') || rawPhD.startsWith('data:'))) ? rawPhD : (d.img || NO_IMG);
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

