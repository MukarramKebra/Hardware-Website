//   USER ACCOUNTS — Supabase Auth + Profile + My Orders
// ═══════════════════════════════════════════════════════════════════════════════

// Current logged-in user state
let _authUser    = null;   // { id, email } or null
let _authToken   = null;   // JWT access token string
let _userProfile = null;   // { id, name, phone, address } from jain_customers

// ── Session helpers ────────────────────────────────────────────────────────────
function getAuthHeaders() {
  return {
    'apikey':        SB_KEY,
    'Authorization': 'Bearer ' + (_authToken || SB_KEY),
    'Content-Type':  'application/json'
  };
}
function saveAuthSession(data) {
  _authToken = data.access_token;
  _authUser  = { id: data.user.id, email: data.user.email };
  localStorage.setItem('jain_access_token',  data.access_token);
  localStorage.setItem('jain_refresh_token', data.refresh_token);
  localStorage.setItem('jain_user_id',       data.user.id);
  localStorage.setItem('jain_user_email',    data.user.email);
}
function clearAuthSession() {
  _authUser  = null;
  _authToken = null;
  _userProfile = null;
  localStorage.removeItem('jain_access_token');
  localStorage.removeItem('jain_refresh_token');
  localStorage.removeItem('jain_user_id');
  localStorage.removeItem('jain_user_email');
}

// ── Init auth on page load ─────────────────────────────────────────────────────
// Tries to restore session from localStorage, refreshes the token silently.
async function initAuth() {
  const token  = localStorage.getItem('jain_access_token');
  const refresh = localStorage.getItem('jain_refresh_token');
  const uid    = localStorage.getItem('jain_user_id');
  const email  = localStorage.getItem('jain_user_email');
  if (token && uid && email) {
    _authToken = token;
    _authUser  = { id: uid, email: email };
    // Silently refresh token (in background)
    _refreshSession(refresh);
    await loadUserProfile();
    updateHeaderForAuth();
  } else {
    // Show login prompt after 2.5 s, but only if never dismissed
    if (!localStorage.getItem('jain_lp_dismissed')) {
      setTimeout(showLoginPrompt, 2500);
    }
    updateHeaderForAuth();
  }
}

async function _refreshSession(refreshToken) {
  if (!refreshToken) return;
  try {
    const res  = await fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    if (!res.ok) { clearAuthSession(); updateHeaderForAuth(); return; }
    const data = await res.json();
    _authToken = data.access_token;
    localStorage.setItem('jain_access_token',  data.access_token);
    localStorage.setItem('jain_refresh_token', data.refresh_token);
  } catch(e) {}
}

// ── Auth actions ────────────────────────────────────────────────────────────────
async function authSignUp(name, email, password) {
  const res  = await fetch(SB_URL + '/auth/v1/signup', {
    method: 'POST',
    headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error_description || data.msg || 'Sign up failed. Try a different email.' };
  if (data.access_token) {
    // Email confirmations disabled — logged in immediately
    saveAuthSession(data);
    if (name) await saveUserProfile(name, '', '');
    await loadUserProfile();
    updateHeaderForAuth();
    return { error: null, confirmed: true };
  }
  // Email confirmation required
  return { error: null, confirmed: false };
}

async function authSignIn(email, password) {
  const res  = await fetch(SB_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error_description || 'Wrong email or password.' };
  saveAuthSession(data);
  await loadUserProfile();
  updateHeaderForAuth();
  return { error: null };
}

async function authSignOut() {
  if (_authToken) {
    fetch(SB_URL + '/auth/v1/logout', {
      method: 'POST',
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + _authToken }
    }).catch(() => {});
  }
  clearAuthSession();
  updateHeaderForAuth();
}

async function authForgotPassword(email) {
  const res = await fetch(SB_URL + '/auth/v1/recover', {
    method: 'POST',
    headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  return res.ok;
}

// ── Profile ────────────────────────────────────────────────────────────────────
async function loadUserProfile() {
  if (!_authUser) return;
  try {
    const res  = await fetch(SB_URL + '/rest/v1/expert_customers?id=eq.' + _authUser.id + '&select=*', {
      headers: getAuthHeaders()
    });
    if (!res.ok) return;
    const rows = await res.json();
    if (rows && rows.length) _userProfile = rows[0];
  } catch(e) {}
}

async function saveUserProfile(name, phone, address) {
  if (!_authUser) return false;
  const payload = [{ id: _authUser.id, name: name || '', phone: phone || '', address: address || '' }];
  try {
    const res = await fetch(SB_URL + '/rest/v1/expert_customers', {
      method:  'POST',
      headers: Object.assign({}, getAuthHeaders(), { 'Prefer': 'resolution=merge-duplicates' }),
      body:    JSON.stringify(payload)
    });
    if (res.ok) {
      _userProfile = { id: _authUser.id, name, phone, address };
      return true;
    }
  } catch(e) {}
  return false;
}

// ── My Orders ──────────────────────────────────────────────────────────────────
async function loadMyOrders() {
  if (_authUser) {
    // Logged in: fetch from Supabase
    try {
      const res  = await fetch(SB_URL + '/rest/v1/expert_orders?user_id=eq.' + _authUser.id + '&order=created_at.desc&select=*', {
        headers: getAuthHeaders()
      });
      if (res.ok) return await res.json();
    } catch(e) {}
  }
  // Guest: return localStorage orders
  try { return JSON.parse(localStorage.getItem('jain_guest_orders') || '[]'); } catch(e) { return []; }
}

// ── Guest order store ──────────────────────────────────────────────────────────
function saveGuestOrder(order) {
  try {
    const orders = JSON.parse(localStorage.getItem('jain_guest_orders') || '[]');
    orders.unshift(order);
    localStorage.setItem('jain_guest_orders', JSON.stringify(orders.slice(0, 30)));
  } catch(e) {}
}

// ── Header update ──────────────────────────────────────────────────────────────
function updateHeaderForAuth() {
  const btn   = document.getElementById('accountBtn');
  const label = document.getElementById('acctBtnLabel');
  if (btn && label) {
    if (_authUser) {
      const initial = (_userProfile && _userProfile.name)
        ? _userProfile.name.charAt(0).toUpperCase()
        : _authUser.email.charAt(0).toUpperCase();
      btn.classList.add('signed-in');
      label.innerHTML =
        '<span style="background:#fff;color:#c8151b;border-radius:50%;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;flex-shrink:0">' + initial + '</span>' +
        '<span class="acct-txt">&nbsp;My Account</span>';
    } else {
      btn.classList.remove('signed-in');
      label.innerHTML = '<span class="acct-txt">Sign In</span>';
    }
  }
  // Show/hide My Orders & Sign In links in mobile nav
  var navOrders = document.getElementById('navMyOrders');
  var navSignIn = document.getElementById('navSignIn');
  if (navOrders) navOrders.style.display = _authUser ? '' : 'none';
  if (navSignIn) navSignIn.style.display = _authUser ? 'none' : '';
}

// ── Header button click ────────────────────────────────────────────────────────
function onAccountBtnClick() {
  if (_authUser) openAcctModal();
  else openAuthModal('login');
}

// ── Login welcome prompt ───────────────────────────────────────────────────────
function showLoginPrompt() {
  if (_authUser) return; // already logged in
  const el = document.getElementById('loginPrompt');
  if (el) el.style.display = 'block';
}
function dismissLoginPrompt() {
  const el = document.getElementById('loginPrompt');
  if (el) el.style.display = 'none';
  localStorage.setItem('jain_lp_dismissed', '1');
}

// ── Auth Modal ─────────────────────────────────────────────────────────────────
function openAuthModal(tab) {
  document.getElementById('authOverlay').classList.add('open');
  switchAuthTab(tab || 'login');
  _clearAuthMessages();
}
function closeAuthModal() {
  document.getElementById('authOverlay').classList.remove('open');
  _clearAuthMessages();
}
function switchAuthTab(tab) {
  document.getElementById('authLoginForm').style.display  = tab === 'login'  ? '' : 'none';
  document.getElementById('authSignupForm').style.display = tab === 'signup' ? '' : 'none';
  document.getElementById('authForgotForm').style.display = tab === 'forgot' ? '' : 'none';
  document.getElementById('authTabLogin').classList.toggle('active',  tab === 'login');
  document.getElementById('authTabSignup').classList.toggle('active', tab === 'signup');
  // Show/hide tab buttons (hide them on forgot screen)
  document.getElementById('authTabLogin').style.display  = tab === 'forgot' ? 'none' : '';
  document.getElementById('authTabSignup').style.display = tab === 'forgot' ? 'none' : '';
  _clearAuthMessages();
}
function _clearAuthMessages() {
  const err = document.getElementById('authErr');
  const ok  = document.getElementById('authOk');
  if (err) { err.textContent = ''; err.classList.remove('show'); }
  if (ok)  { ok.textContent  = ''; ok.classList.remove('show'); }
}
function _showAuthErr(msg) {
  const el = document.getElementById('authErr');
  if (el) { el.textContent = msg; el.classList.add('show'); }
}
function _showAuthOk(msg) {
  const el = document.getElementById('authOk');
  if (el) { el.textContent = msg; el.classList.add('show'); }
}

async function doAuthLogin() {
  const email = (document.getElementById('authLoginEmail').value || '').trim();
  const pass  = document.getElementById('authLoginPass').value;
  _clearAuthMessages();
  if (!email || !pass) { _showAuthErr('Please enter your email and password.'); return; }
  const btn = document.getElementById('authLoginBtn');
  btn.disabled = true; btn.textContent = 'Signing in…';
  const result = await authSignIn(email, pass);
  btn.disabled = false; btn.innerHTML = '<i class="fa fa-sign-in-alt"></i> Sign In';
  if (result.error) { _showAuthErr(result.error); return; }
  closeAuthModal();
  openAcctModal();
}

async function doAuthSignup() {
  const name  = (document.getElementById('authSignupName').value  || '').trim();
  const email = (document.getElementById('authSignupEmail').value || '').trim();
  const pass  = document.getElementById('authSignupPass').value;
  _clearAuthMessages();
  if (!email || !pass) { _showAuthErr('Please enter your email and password.'); return; }
  if (pass.length < 6)  { _showAuthErr('Password must be at least 6 characters.'); return; }
  const btn = document.getElementById('authSignupBtn');
  btn.disabled = true; btn.textContent = 'Creating account…';
  const result = await authSignUp(name, email, pass);
  btn.disabled = false; btn.innerHTML = '<i class="fa fa-user-plus"></i> Create Account';
  if (result.error) { _showAuthErr(result.error); return; }
  if (result.confirmed) {
    _showAuthOk('✅ Account created! Welcome, ' + (name || email) + '!');
    setTimeout(() => { closeAuthModal(); openAcctModal(); }, 1200);
  } else {
    _showAuthOk('📧 Check your email for a confirmation link, then sign in.');
    setTimeout(() => switchAuthTab('login'), 2500);
  }
}

async function doAuthForgot() {
  const email = (document.getElementById('authForgotEmail').value || '').trim();
  _clearAuthMessages();
  if (!email) { _showAuthErr('Please enter your email address.'); return; }
  const btn = document.getElementById('authForgotBtn');
  btn.disabled = true; btn.textContent = 'Sending…';
  const ok = await authForgotPassword(email);
  btn.disabled = false; btn.innerHTML = '<i class="fa fa-envelope"></i> Send Reset Link';
  if (ok) {
    _showAuthOk('📧 Reset link sent! Check your email inbox (and spam folder).');
  } else {
    _showAuthErr('Could not send reset email. Check the address and try again.');
  }
}

// ── Account Modal (Profile + My Orders) ───────────────────────────────────────
async function openAcctModal() {
  if (!_authUser) { openAuthModal('login'); return; }
  // Fill in header info
  const initial = (_userProfile && _userProfile.name)
    ? _userProfile.name.charAt(0).toUpperCase()
    : _authUser.email.charAt(0).toUpperCase();
  document.getElementById('acctAvatar').textContent = initial;
  document.getElementById('acctUname').textContent  = (_userProfile && _userProfile.name) || 'My Account';
  document.getElementById('acctUemail').textContent = _authUser.email;
  // Fill profile fields
  if (_userProfile) {
    document.getElementById('profName').value    = _userProfile.name    || '';
    document.getElementById('profPhone').value   = _userProfile.phone   || '';
    document.getElementById('profAddress').value = _userProfile.address || '';
  }
  switchAcctTab('profile');
  document.getElementById('acctOverlay').classList.add('open');
}
function closeAcctModal() {
  document.getElementById('acctOverlay').classList.remove('open');
}
function switchAcctTab(tab) {
  document.getElementById('acctProfilePane').style.display = tab === 'profile' ? '' : 'none';
  document.getElementById('acctOrdersPane').style.display  = tab === 'orders'  ? '' : 'none';
  document.getElementById('acctTabProfile').classList.toggle('active', tab === 'profile');
  document.getElementById('acctTabOrders').classList.toggle('active',  tab === 'orders');
  if (tab === 'orders') renderMyOrders();
}

async function doSaveProfile() {
  const name    = document.getElementById('profName').value.trim();
  const phone   = document.getElementById('profPhone').value.trim();
  const address = document.getElementById('profAddress').value.trim();
  const ok = await saveUserProfile(name, phone, address);
  const okEl = document.getElementById('acctOk');
  if (ok) {
    okEl.textContent = '✅ Profile saved!';
    okEl.classList.add('show');
    // Update header initial
    updateHeaderForAuth();
    document.getElementById('acctAvatar').textContent = name ? name.charAt(0).toUpperCase() : _authUser.email.charAt(0).toUpperCase();
    document.getElementById('acctUname').textContent  = name || 'My Account';
    setTimeout(() => okEl.classList.remove('show'), 3000);
  } else {
    okEl.textContent  = '⚠️ Could not save. Please try again.';
    okEl.style.background = 'rgba(239,68,68,.07)';
    okEl.style.borderColor = 'rgba(239,68,68,.25)';
    okEl.style.color = '#dc2626';
    okEl.classList.add('show');
    setTimeout(() => { okEl.classList.remove('show'); okEl.style = ''; }, 3000);
  }
}

async function doSignOut() {
  await authSignOut();
  closeAcctModal();
}

async function renderMyOrders() {
  const container = document.getElementById('myOrdersList');
  container.innerHTML = '<div class="myo-loading"><i class="fa fa-spinner fa-spin"></i> Loading orders…</div>';
  const orders = await loadMyOrders();
  if (!orders || !orders.length) {
    container.innerHTML = `
      <div class="myo-empty">
        <i class="fa fa-receipt"></i>
        <p>No orders yet</p>
        <small>Your order history will appear here after you place an order.</small>
      </div>`;
    return;
  }
  const statusClass = { pending:'myo-pending', confirmed:'myo-confirmed', delivered:'myo-delivered', cancelled:'myo-cancelled' };
  container.innerHTML = orders.map(function(o) {
    const items = Array.isArray(o.items)
      ? o.items.map(i => i.name + ' &times;' + i.qty).join('<br>')
      : (o.items || '');
    const date = o.created_at
      ? new Date(o.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
      : '';
    const status   = (o.status || 'pending').toLowerCase();
    const statusCls = statusClass[status] || 'myo-pending';
    const shortId  = String(o.id || '').slice(-6).toUpperCase();
    return `
      <div class="myo-card">
        <div class="myo-top">
          <div class="myo-meta">
            <span class="myo-id">Order #${shortId}</span>
            <span class="myo-date">${date}</span>
          </div>
          <span class="myo-status ${statusCls}">${status}</span>
        </div>
        <div class="myo-items">${items}</div>
        <div class="myo-footer">
          <span class="myo-total">${parseFloat(o.total || 0).toFixed(3)} KWD</span>
          <span class="myo-addr">${o.address || ''}</span>
        </div>
      </div>`;
  }).join('');
}

// ── Kick off auth on page load ─────────────────────────────────────────────────
initAuth();

// ══════════════════════════════════════════════════════════════════════════════
