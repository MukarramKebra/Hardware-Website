// ── LOGIN ──────────────────────────────────────────────────────────────────────
// doLogin()    — runs when the login form is submitted
// showAdmin()  — hides login screen, shows the main admin panel
// logout()     — clears the session and returns to login screen
// Populate forgot-password overlay with current credentials
var _fpu = document.getElementById('fpUser'); if (_fpu) _fpu.textContent = ADMIN_USER;
var _fpp = document.getElementById('fpPass'); if (_fpp) _fpp.textContent = ADMIN_PASS;
// Also ensure owner-only rows are visible by default (will be hidden if bahar15 logs in)
document.querySelectorAll('.owner-only-row').forEach(function(el){ el.style.display = ''; });

function doLogin(e) {
  if (e) e.preventDefault();
  const u   = document.getElementById('loginUser').value.trim();
  const p   = document.getElementById('loginPass').value;
  const err = document.getElementById('loginError');
  err.style.display = 'none';

  // ── Owner (ultimate15) ────────────────────────────────────────────────────
  if (u === SUPER_USER && p === SUPER_PASS) {
    localStorage.setItem('jain_auth', 'super');
    showSuperAdmin();
    return;
  }

  // ── Manager (bahar15) — all owner powers except disabling ultimate/site ──
  if (u === MANAGER_USER && p === MANAGER_PASS) {
    if (localStorage.getItem('jain15_user_disabled') === '1') {
      err.textContent = 'This account has been disabled by the owner.';
      err.style.display = 'block';
      return;
    }
    localStorage.setItem('jain_auth', 'bahar15');
    showManager();
    return;
  }

  // ── Regular admin (bahar) ─────────────────────────────────────────────────
  if (u === ADMIN_USER && p === ADMIN_PASS) {
    if (localStorage.getItem('jain_user_disabled') === '1') {
      err.textContent = 'This account has been disabled by the owner.';
      err.style.display = 'block';
      return;
    }
    localStorage.setItem('jain_auth', '1');
    if (window.PasswordCredential) {
      const cred = new PasswordCredential({ id: u, password: p, name: 'Bahar Admin' });
      navigator.credentials.store(cred);
    }
    showAdmin();
    return;
  }

  // ── Wrong credentials ─────────────────────────────────────────────────────
  err.textContent = 'Wrong username or password.';
  err.style.display = 'block';
  setTimeout(function() { err.style.display = 'none'; }, 3000);
}
function showAdmin() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminPanel').style.display = 'block';
  switchTab('inventory');
  loadFromSupabase();
  _loadSavedHandles();
  loadOrders(false);
}
function logout() {
  localStorage.removeItem('jain_auth');
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('adminPanel').style.display = 'none';
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
}

// ── SUPER ADMIN (ultimate15) ───────────────────────────────────────────────────
// showSuperAdmin()     — opens the full admin panel + shows the Owner Controls tab
// logoutSuper()        — logs out and resets the panel back to normal
// toggleBaharAccount() — enables or disables the "bahar" login account
// renderSuperAdmin()   — draws the audit log and status of bahar's account
function showSuperAdmin() {
  // Show the full admin panel + reveal the Owner Controls tab
  document.getElementById('loginScreen').style.display  = 'none';
  document.getElementById('adminPanel').style.display   = 'block';
  document.getElementById('tabOwner').style.display     = 'flex';
  // Ensure owner-only rows are visible (may have been hidden if bahar15 was logged in)
  document.querySelectorAll('.owner-only-row').forEach(function(el){ el.style.display = ''; });
  // Restore owner section heading
  var title = document.getElementById('ownerSectionTitle');
  if (title) title.innerHTML = '<i class="fa fa-crown" style="color:#7c3aed;margin-right:8px"></i>Owner Control Panel';
  var sub = document.getElementById('ownerSectionSub');
  if (sub) sub.innerHTML = 'Exclusive controls for <strong style="color:#7c3aed">ultimate15</strong>';
  // Mark the top bar as owner mode
  var badge = document.querySelector('.admin-badge');
  if (badge) { badge.innerHTML = '<i class="fa fa-crown"></i> Owner'; badge.style.background = '#7c3aed'; }
  // Change logout button to call logoutSuper instead
  var logoutBtn = document.querySelector('.top-right .logout-btn:last-child');
  if (logoutBtn) { logoutBtn.setAttribute('onclick', 'logoutSuper()'); }
  switchTab('owner');
  loadFromSupabase();
  _loadSavedHandles();
  loadOrders(false);
  renderSuperAdmin();
}
function logoutSuper() {
  localStorage.removeItem('jain_auth');
  document.getElementById('adminPanel').style.display  = 'none';
  document.getElementById('tabOwner').style.display    = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  // Restore badge & logout button for next login
  var badge = document.querySelector('.admin-badge');
  if (badge) { badge.innerHTML = '<i class="fa fa-shield-alt"></i> Admin'; badge.style.background = ''; }
  var logoutBtn = document.querySelector('.top-right .logout-btn:last-child');
  if (logoutBtn) { logoutBtn.setAttribute('onclick', 'logout()'); }
}

// ── MANAGER (bahar15) ─────────────────────────────────────────────────────────
// bahar15 has all owner powers except:
//   • Cannot disable/enable ultimate15
//   • Cannot disable/enable the public website
//   • Cannot disable/enable themselves (bahar15 row hidden)
// ultimate15 can disable bahar15 via the Owner Controls panel.
function showManager() {
  // Show full admin panel + reveal Owner Controls tab
  document.getElementById('loginScreen').style.display  = 'none';
  document.getElementById('adminPanel').style.display   = 'block';
  document.getElementById('tabOwner').style.display     = 'flex';
  // Style the badge as "Manager" in teal
  var badge = document.querySelector('.admin-badge');
  if (badge) { badge.innerHTML = '<i class="fa fa-user-shield"></i> Manager'; badge.style.background = '#c8151b'; }
  // Change logout button
  var logoutBtn = document.querySelector('.top-right .logout-btn:last-child');
  if (logoutBtn) { logoutBtn.setAttribute('onclick', 'logoutManager()'); }
  // Hide ultimate15-only rows in Owner Controls
  document.querySelectorAll('.owner-only-row').forEach(function(el){ el.style.display='none'; });
  // Update owner section heading
  var title = document.getElementById('ownerSectionTitle');
  if (title) title.innerHTML = '<i class="fa fa-user-shield" style="color:#c8151b;margin-right:8px"></i>Manager Control Panel';
  var sub = document.getElementById('ownerSectionSub');
  if (sub) sub.innerHTML = 'Manager controls for <strong style="color:#c8151b">expert15</strong>';
  switchTab('owner');
  loadFromSupabase();
  _loadSavedHandles();
  loadOrders(false);
  renderSuperAdmin();
}
function logoutManager() {
  localStorage.removeItem('jain_auth');
  document.getElementById('adminPanel').style.display  = 'none';
  document.getElementById('tabOwner').style.display    = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  // Restore badge & logout button
  var badge = document.querySelector('.admin-badge');
  if (badge) { badge.innerHTML = '<i class="fa fa-shield-alt"></i> Admin'; badge.style.background = ''; }
  var logoutBtn = document.querySelector('.top-right .logout-btn:last-child');
  if (logoutBtn) { logoutBtn.setAttribute('onclick', 'logout()'); }
  // Re-show owner-only rows for next login
  document.querySelectorAll('.owner-only-row').forEach(function(el){ el.style.display=''; });
}
function toggleBaharAccount() {
  var isDisabled = localStorage.getItem('jain_user_disabled') === '1';
  if (isDisabled) {
    localStorage.removeItem('jain_user_disabled');
    showToast('✅ bahar account enabled');
  } else {
    if (!confirm('Disable the expert account? They will not be able to login until you re-enable it.')) return;
    localStorage.setItem('jain_user_disabled', '1');
    showToast('🚫 bahar account disabled');
  }
  renderSuperAdmin();
}

// toggleBahar15Account() — only ultimate15 can call this (button hidden from bahar15)
function toggleBahar15Account() {
  var isDisabled = localStorage.getItem('jain15_user_disabled') === '1';
  if (isDisabled) {
    localStorage.removeItem('jain15_user_disabled');
    showToast('✅ bahar15 account enabled');
  } else {
    if (!confirm('Disable the expert15 manager account? They will not be able to login until you re-enable it.')) return;
    localStorage.setItem('jain15_user_disabled', '1');
    showToast('🚫 bahar15 account disabled');
  }
  renderSuperAdmin();
}

// toggleSiteDisabled() — only ultimate15 can call this (button hidden from bahar15)
// Stores the flag in Supabase (jain_settings table) so it affects ALL visitors.
// Table needed: jain_settings (key text primary key, value text)
async function toggleSiteDisabled() {
  var btn = document.getElementById('siteToggleBtn');
  var currentlyDisabled = btn && btn.dataset.disabled === '1';
  var newVal = currentlyDisabled ? 'false' : 'true';
  if (!currentlyDisabled) {
    if (!confirm('Disable the public website? Visitors will see a "Site closed" page until you re-enable it.')) return;
  }
  // Save to Supabase jain_settings table
  var r = await sbFetch(SB_URL + '/rest/v1/expert_settings', {
    method: 'POST',
    headers: Object.assign({}, SB_HDRS, { 'Prefer': 'resolution=merge-duplicates' }),
    body: JSON.stringify([{ key: 'site_disabled', value: newVal }])
  });
  if (r.error) {
    showToast('⚠️ Could not save — check Supabase jain_settings table');
    return;
  }
  renderSiteStatus(newVal === 'true');
  showToast(newVal === 'true' ? '🚫 Website disabled for visitors' : '✅ Website re-enabled for visitors');
}

function renderSiteStatus(isDisabled) {
  var statusEl = document.getElementById('siteStatusLabel');
  var btn      = document.getElementById('siteToggleBtn');
  if (!statusEl || !btn) return;
  statusEl.textContent  = isDisabled ? '🔴 Disabled' : '🟢 Live';
  statusEl.style.color  = isDisabled ? 'var(--red)' : 'var(--green)';
  btn.textContent       = isDisabled ? 'Enable' : 'Disable';
  btn.className         = 'su-toggle-btn ' + (isDisabled ? 'enable' : 'disable');
  btn.dataset.disabled  = isDisabled ? '1' : '0';
}

// Load site status from Supabase on panel open
async function loadSiteStatus() {
  var r = await sbFetch(SB_URL + '/rest/v1/expert_settings?key=eq.site_disabled&select=value', { headers: SB_HDRS });
  if (r.data && r.data.length) {
    renderSiteStatus(r.data[0].value === 'true');
  } else {
    renderSiteStatus(false); // not set yet = enabled
  }
}
function renderSuperAdmin() {
  var isDisabled = localStorage.getItem('jain_user_disabled') === '1';
  // Update both the legacy standalone panel and the new inline ownerSection (bahar row)
  ['', '2'].forEach(function(sfx) {
    var statusEl  = document.getElementById('suUserStatus'  + sfx);
    var toggleBtn = document.getElementById('suToggleBtn'   + sfx);
    var undoBtn2  = document.getElementById('suUndoBtn'     + sfx);
    if (statusEl)  { statusEl.textContent = isDisabled ? '🔴 Disabled' : '🟢 Active'; statusEl.style.color = isDisabled ? 'var(--red)' : 'var(--green)'; }
    if (toggleBtn) { toggleBtn.textContent = isDisabled ? 'Enable' : 'Disable'; toggleBtn.className = 'su-toggle-btn ' + (isDisabled ? 'enable' : 'disable'); }
    if (undoBtn2)  undoBtn2.disabled = getWeekLog().length === 0;
  });
  // Update bahar15 row status (shown to ultimate15 only)
  var b15Disabled = localStorage.getItem('jain15_user_disabled') === '1';
  var b15StatusEl = document.getElementById('suBahar15Status');
  var b15Btn      = document.getElementById('suBahar15Btn');
  if (b15StatusEl) { b15StatusEl.textContent = b15Disabled ? '🔴 Disabled' : '🟢 Active'; b15StatusEl.style.color = b15Disabled ? 'var(--red)' : 'var(--green)'; }
  if (b15Btn)      { b15Btn.textContent = b15Disabled ? 'Enable' : 'Disable'; b15Btn.className = 'su-toggle-btn ' + (b15Disabled ? 'enable' : 'disable'); }
  // Load site status from Supabase (for ultimate15)
  if (localStorage.getItem('jain_auth') === 'super') { loadSiteStatus(); }
  var log     = getWeekLog().slice().reverse();
  var logEl   = document.getElementById('suAuditLog');
  var logEl2  = document.getElementById('suAuditLog2');
  var undoBtn = document.getElementById('suUndoBtn');
  if (undoBtn) undoBtn.disabled = log.length === 0;
  if (!logEl && !logEl2) return;
  var html;
  if (!log.length) {
    html = '<div class="su-empty"><i class="fa fa-check-circle" style="color:var(--green)"></i><p style="font-size:14px;font-weight:700;color:var(--green)">No actions this week</p><small>expert has not made any changes in the past 7 days.</small></div>';
    if (logEl)  logEl.innerHTML  = html;
    if (logEl2) logEl2.innerHTML = html;
    return;
  }
  var defs = {
    'delete_product':{ icon:'fa-box',          cls:'su-log-del',    label:'Deleted product' },
    'delete_order':  { icon:'fa-receipt',       cls:'su-log-del',    label:'Deleted order' },
    'stock_change':  { icon:'fa-layer-group',   cls:'su-log-stock',  label:'Changed stock' },
    'status_change': { icon:'fa-exchange-alt',  cls:'su-log-status', label:'Changed order status' },
    'add_product':   { icon:'fa-plus-circle',   cls:'su-log-add',    label:'Added product' }
  };
  html = log.map(function(entry) {
    var def  = defs[entry.action] || { icon:'fa-edit', cls:'su-log-stock', label:entry.action };
    var d    = entry.data || {};
    var detail = '';
    if (entry.action==='delete_product') detail = d.name || 'Product #'+d.id;
    else if (entry.action==='delete_order') detail = 'Order #'+d.id+' — '+(d.customer_name||'Customer');
    else if (entry.action==='stock_change') detail = (d.name||'#'+d.id)+': '+d.oldQty+' → '+d.newQty;
    else if (entry.action==='status_change') detail = 'Order #'+d.id+': '+d.oldStatus+' → '+d.newStatus;
    else if (entry.action==='add_product') detail = d.name || 'New product';
    var timeStr = new Date(entry.ts).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
    return '<div class="su-log-item"><div class="su-log-icon '+def.cls+'"><i class="fa '+def.icon+'"></i></div>' +
      '<div><div class="su-log-text">'+def.label+': '+encodeHtml(String(detail))+'</div>' +
      '<div class="su-log-time">'+timeStr+'</div></div></div>';
  }).join('');
  if (logEl)  logEl.innerHTML  = html;
  if (logEl2) logEl2.innerHTML = html;
}

// ── AUDIT LOG ─────────────────────────────────────────────────────────────────
// Records every action jain makes so ultimate15 can review and undo them.
// logAction(action, data) — saves an entry with a timestamp
// getWeekLog()            — returns only entries from the last 7 days
// undoAllThisWeek()       — loops through the last 7 days and reverses each action
// undoSingleAction(entry) — reverses one specific action (restore product/order, revert stock, etc.)
function getAuditLog() { try { return JSON.parse(localStorage.getItem('jain_audit_log')||'[]'); } catch(e) { return []; } }
function saveAuditLog(log) { localStorage.setItem('jain_audit_log', JSON.stringify(log)); }
function logAction(action, data) {
  var log = getAuditLog();
  log.push({ ts: Date.now(), action: action, data: data });
  var cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  saveAuditLog(log.filter(function(e) { return e.ts > cutoff; }));
}
function getWeekLog() {
  var cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return getAuditLog().filter(function(e) { return e.ts > cutoff; });
}

async function undoAllThisWeek() {
  var log = getWeekLog().slice().reverse();
  if (!log.length) { showToast('Nothing to undo'); return; }
  if (!confirm('Undo all ' + log.length + ' action(s) by bahar from the past 7 days? This cannot be undone.')) return;
  var done = 0, failed = 0;
  for (var i = 0; i < log.length; i++) {
    var ok = await undoSingleAction(log[i]);
    if (ok) done++; else failed++;
  }
  var cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  saveAuditLog(getAuditLog().filter(function(e) { return e.ts <= cutoff; }));
  showToast('↩️ Undone: ' + done + (failed ? ' | ' + failed + ' failed' : ''));
  renderSuperAdmin();
}

async function undoSingleAction(entry) {
  var d = entry.data || {};
  try {
    if (entry.action === 'delete_product') {
      var list  = getDeletedProducts();
      var item  = list.find(function(x) { return x.id === d.id; });
      if (!item) return true;
      if (item.isBase) {
        var r = await sbFetch(SB_URL+'/rest/v1/expert_hidden?product_id=eq.'+d.id, { method:'DELETE', headers:SB_HDRS });
        if (r.error) return false;
        _hiddenBaseIds.delete(d.id);
      } else {
        var r = await sbFetch(SB_URL+'/rest/v1/expert_products', { method:'POST', headers:Object.assign({},SB_HDRS,{'Prefer':'return=representation'}), body:JSON.stringify([{name:item.name,category:item.cat,price:item.price,img_url:item.img||'',hidden:false}]) });
        if (r.error) return false;
      }
      saveDeletedProducts(list.filter(function(x) { return x.id !== d.id; }));
      return true;
    }
    if (entry.action === 'delete_order') {
      var list  = getDeletedOrders();
      var order = list.find(function(x) { return x.id === d.id; });
      if (!order) return true;
      var payload = { customer_name:order.customer_name, customer_phone:order.customer_phone, address:order.address, notes:order.notes||'', items:order.items, total:parseFloat(order.total||0), status:order.status||'pending' };
      var r = await sbFetch(SB_URL+'/rest/v1/expert_orders', { method:'POST', headers:Object.assign({},SB_HDRS,{'Prefer':'return=representation'}), body:JSON.stringify([payload]) });
      if (r.error) return false;
      saveDeletedOrders(list.filter(function(x) { return x.id !== d.id; }));
      return true;
    }
    if (entry.action === 'stock_change') {
      stockData[d.id] = d.oldQty;
      var r = await sbFetch(SB_URL+'/rest/v1/expert_stock', { method:'POST', headers:Object.assign({},SB_HDRS,{'Prefer':'resolution=merge-duplicates'}), body:JSON.stringify([{product_id:d.id,qty:d.oldQty}]) });
      return !r.error;
    }
    if (entry.action === 'status_change') {
      var r = await sbFetch(SB_URL+'/rest/v1/expert_orders?id=eq.'+d.id, { method:'PATCH', headers:Object.assign({},SB_HDRS,{'Prefer':'return=minimal'}), body:JSON.stringify({status:d.oldStatus}) });
      if (!r.error && _allOrders) { var o = _allOrders.find(function(x){return x.id===d.id;}); if (o) o.status = d.oldStatus; }
      return !r.error;
    }
    if (entry.action === 'add_product') {
      var r = await sbFetch(SB_URL+'/rest/v1/expert_products?id=eq.'+d.id, { method:'DELETE', headers:SB_HDRS });
      await sbFetch(SB_URL+'/rest/v1/expert_stock?product_id=eq.'+d.id, { method:'DELETE', headers:SB_HDRS });
      return !r.error;
    }
    return true;
  } catch(e) { return false; }
}

// ── AUTO-LOGIN ON PAGE LOAD ────────────────────────────────────────────────────
// If the browser still has a saved session (from last time), skip the login screen.
// jain_auth = '1'       → regular admin session (bahar)
// jain_auth = 'super'   → owner session (ultimate15)
// jain_auth = 'bahar15' → manager session (bahar15)
if (localStorage.getItem('jain_auth') === '1')       { showAdmin(); }
if (localStorage.getItem('jain_auth') === 'super')   { showSuperAdmin(); }
if (localStorage.getItem('jain_auth') === 'bahar15') { showManager(); }

// ── CLOCK ──────────────────────────────────────────────────────────────────────
// Updates the date/time shown in the top-right corner every second
function tick() {
  const n = new Date();
  document.getElementById('clockEl').textContent =
    n.toLocaleDateString('en-KW',{weekday:'short',day:'numeric',month:'short'}) + ' â€” ' +
    n.toLocaleTimeString('en-KW',{hour:'2-digit',minute:'2-digit'});
}
setInterval(tick, 1000); tick();

