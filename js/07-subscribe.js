// ═══════════════════════════════════════════════════════════════════════════════
//   SUBSCRIBE TO OFFERS — inserts a marketing-consent record into Supabase
// ═══════════════════════════════════════════════════════════════════════════════
// Writes to the `offer_subscribers` table (see expert-hardware-offers.sql).
// Consent is REQUIRED (unchecked by default in the UI) and we record the exact
// moment it was given. Duplicate emails are handled gracefully: if the address
// already exists we resubscribe it rather than erroring.

function _subMsg(text, ok) {
  const el = document.getElementById('subMsg');
  if (!el) return;
  el.textContent = text;
  el.className = 'subscribe-msg ' + (ok ? 'ok' : 'err') + ' show';
}

async function doSubscribe(ev) {
  if (ev && ev.preventDefault) ev.preventDefault();
  const emailEl   = document.getElementById('subEmail');
  const consentEl = document.getElementById('subConsent');
  const btn       = document.getElementById('subBtn');
  const email = (emailEl && emailEl.value || '').trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    _subMsg('Please enter a valid email address.', false);
    return;
  }
  if (consentEl && !consentEl.checked) {
    _subMsg('Please tick the box to accept the Terms & Conditions and marketing consent.', false);
    return;
  }

  const nowIso = new Date().toISOString();
  const payload = {
    email: email,
    consent: true,
    consent_at: nowIso,
    unsubscribed: false
  };

  if (btn) { btn.disabled = true; btn.dataset._html = btn.innerHTML; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Subscribing…'; }

  try {
    // INSERT with ON CONFLICT DO NOTHING (ignore-duplicates). The public anon
    // key is granted INSERT only — never UPDATE/SELECT — so a duplicate email
    // is silently ignored (still a 2xx) rather than erroring. This keeps the
    // subscribers table unreadable/unwritable to the public beyond adding a row.
    const res = await fetch(SB_URL + '/rest/v1/offer_subscribers?on_conflict=email', {
      method: 'POST',
      headers: {
        'apikey': SB_KEY,
        'Authorization': 'Bearer ' + SB_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=ignore-duplicates,return=minimal'
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      _subMsg('🎉 You’re subscribed! Watch your inbox for our next offers.', true);
      if (emailEl) emailEl.value = '';
      if (consentEl) consentEl.checked = false;
    } else {
      let detail = '';
      try { const j = await res.json(); detail = j.message || j.error || ''; } catch (_) {}
      console.error('[subscribe] failed', res.status, detail);
      _subMsg('Sorry, something went wrong. Please try again later.', false);
    }
  } catch (e) {
    console.error('[subscribe] network error', e);
    _subMsg('Network error — please check your connection and try again.', false);
  } finally {
    if (btn) { btn.disabled = false; if (btn.dataset._html) btn.innerHTML = btn.dataset._html; }
  }
}
