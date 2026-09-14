// ═══════════════════════════════════════════════════════════════════════════════
//   OFFERS TAB — compose + send/schedule marketing campaigns
// ═══════════════════════════════════════════════════════════════════════════════
// All sending happens in the `send-offers` Edge Function (the Resend key lives
// there, never in the browser). Authenticated the same way every other admin
// write is: SB_HDRS.Authorization carries the logged-in admin's real Supabase
// Auth session token, checked server-side against is_admin(auth.uid()) — see
// CLAUDE.md's Admin auth note. Previously this tab used a separate shared
// ADMIN_SEND_TOKEN that the operator pasted in and that sat in this browser's
// localStorage indefinitely with no expiry; that's gone now.

var OFFERS_FN_URL = SB_URL + '/functions/v1/send-offers';

function initOffersTab() {
  offToggleMode();
  offLoadSubscribers();
  offLoadCampaigns();
}

function offToggleMode() {
  var mode = _offMode();
  document.getElementById('offSchedule').style.display = mode === 'schedule' ? '' : 'none';
  document.getElementById('offSendLabel').textContent = mode === 'schedule' ? 'Schedule' : 'Send Now';
}
function _offMode() {
  var r = document.querySelector('input[name="offMode"]:checked');
  return r ? r.value : 'now';
}

function _offStatus(msg, ok) {
  var el = document.getElementById('offStatus');
  if (!el) return;
  el.textContent = msg;
  el.style.color = ok ? '#16a34a' : '#dc2626';
}

// Core call to the Edge Function.
async function _offCall(payload) {
  var res = await fetch(OFFERS_FN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': SB_HDRS.Authorization },
    body: JSON.stringify(payload)
  });
  var data = {};
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) {
    var msg = data.error || ('HTTP ' + res.status);
    if (res.status === 401) msg = 'Unauthorized — please log in again.';
    throw new Error(msg);
  }
  return data;
}

function _offCompose() {
  var subject = (document.getElementById('offSubject').value || '').trim();
  var html    = (document.getElementById('offBody').value || '').trim();
  return { subject: subject, html: html };
}

async function offSendTest() {
  var c = _offCompose();
  var to = (document.getElementById('offTestTo').value || '').trim();
  if (!c.subject || !c.html) { _offStatus('Add a subject and body first.', false); return; }
  if (!to) { _offStatus('Enter a test recipient email.', false); return; }
  _offStatus('Sending test…', true);
  try {
    await _offCall({ action: 'test', subject: c.subject, html: c.html, to: to });
    _offStatus('✅ Test sent to ' + to, true);
  } catch (e) { _offStatus('Test failed: ' + e.message, false); }
}

async function offSubmit() {
  var c = _offCompose();
  if (!c.subject || !c.html) { _offStatus('Add a subject and body first.', false); return; }
  var mode = _offMode();
  var btn = document.getElementById('offSendBtn');
  var createdBy = '';
  try { createdBy = localStorage.getItem('jain_custom_name') || localStorage.getItem('jain_auth') || ''; } catch (_) {}

  if (mode === 'schedule') {
    var when = document.getElementById('offSchedule').value;
    if (!when) { _offStatus('Pick a date & time to schedule.', false); return; }
    var iso = new Date(when).toISOString();
    if (!confirm('Schedule this campaign for ' + new Date(when).toLocaleString() + '?')) return;
    btn.disabled = true; _offStatus('Scheduling…', true);
    try {
      await _offCall({ action: 'schedule', subject: c.subject, html: c.html, scheduled_at: iso, created_by: createdBy });
      _offStatus('🗓️ Scheduled. It will send automatically at the set time.', true);
      offLoadCampaigns();
    } catch (e) { _offStatus('Schedule failed: ' + e.message, false); }
    finally { btn.disabled = false; }
    return;
  }

  // Send now
  if (!confirm('Send this offer to ALL active subscribers now?')) return;
  btn.disabled = true; _offStatus('Sending to subscribers…', true);
  try {
    var r = await _offCall({ action: 'send_now', subject: c.subject, html: c.html, created_by: createdBy });
    _offStatus('✅ Sent to ' + r.sent + ' of ' + r.total + (r.failed ? (' (' + r.failed + ' failed)') : '') + '.', true);
    offLoadCampaigns();
  } catch (e) { _offStatus('Send failed: ' + e.message, false); }
  finally { btn.disabled = false; }
}

async function offLoadSubscribers() {
  var box = document.getElementById('offSubList');
  var cnt = document.getElementById('offSubCount');
  box.innerHTML = '<div style="color:#888;padding:8px">Loading…</div>';
  try {
    var r = await _offCall({ action: 'list_subscribers' });
    var subs = r.subscribers || [];
    var active = subs.filter(function (s) { return !s.unsubscribed; });
    cnt.textContent = '(' + active.length + ' active / ' + subs.length + ' total)';
    if (!subs.length) { box.innerHTML = '<div style="color:#888;padding:8px">No subscribers yet.</div>'; return; }
    box.innerHTML = subs.map(function (s) {
      return '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 4px;border-bottom:1px solid #f2f2f2">' +
        '<span style="' + (s.unsubscribed ? 'color:#aaa;text-decoration:line-through' : '') + '">' + _offEsc(s.email) + '</span>' +
        '<span style="color:#aaa;white-space:nowrap;font-size:11px">' + (s.unsubscribed ? 'unsubscribed' : (s.consent_at ? new Date(s.consent_at).toLocaleDateString() : '')) + '</span>' +
        '</div>';
    }).join('');
  } catch (e) { box.innerHTML = '<div style="color:#dc2626;padding:8px">' + _offEsc(e.message) + '</div>'; }
}

async function offLoadCampaigns() {
  var box = document.getElementById('offCampList');
  box.innerHTML = '<div style="color:#888;padding:8px">Loading…</div>';
  try {
    var r = await _offCall({ action: 'list_campaigns' });
    var rows = r.campaigns || [];
    if (!rows.length) { box.innerHTML = '<div style="color:#888;padding:8px">No campaigns yet.</div>'; return; }
    var colors = { sent: '#16a34a', sending: '#d97706', scheduled: '#2563eb', failed: '#dc2626', draft: '#888' };
    box.innerHTML = rows.map(function (c) {
      var when = c.status === 'scheduled' ? ('for ' + new Date(c.scheduled_at).toLocaleString())
        : (c.sent_at ? new Date(c.sent_at).toLocaleString() : new Date(c.created_at).toLocaleString());
      return '<div style="padding:8px 4px;border-bottom:1px solid #f2f2f2">' +
        '<div style="display:flex;justify-content:space-between;gap:8px"><b style="font-size:12.5px">' + _offEsc(c.subject) + '</b>' +
        '<span style="font-size:11px;font-weight:800;color:' + (colors[c.status] || '#888') + '">' + c.status.toUpperCase() + '</span></div>' +
        '<div style="color:#999;font-size:11px;margin-top:2px">' + when + (c.status === 'sent' ? (' · ' + c.sent_count + ' sent') : '') + '</div>' +
        (c.error ? '<div style="color:#dc2626;font-size:11px;margin-top:2px">' + _offEsc(c.error).slice(0, 160) + '</div>' : '') +
        '</div>';
    }).join('');
  } catch (e) { box.innerHTML = '<div style="color:#dc2626;padding:8px">' + _offEsc(e.message) + '</div>'; }
}

function _offEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
