// ═══════════════════════════════════════════════════════════════════════════════
//   SUBSCRIBE TO OFFERS — inserts a marketing-consent record into Supabase
// ═══════════════════════════════════════════════════════════════════════════════
// Writes to the `offer_subscribers` table (see expert-hardware-offers.sql).
// Consent is REQUIRED (unchecked by default in the UI) and we record the exact
// moment it was given. Duplicate emails are handled gracefully: if the address
// already exists we resubscribe it rather than erroring.

function _subMsg(msgElId, text, ok) {
  const el = document.getElementById(msgElId);
  if (!el) return;
  el.textContent = text;
  el.className = 'subscribe-msg ' + (ok ? 'ok' : 'err') + ' show';
}

// Shared by the footer subscribe form and the offers nudge popup — same
// Supabase call, just parameterized by which set of form element ids to
// read from/report into, so there's one source of truth for the logic.
async function _submitSubscribe(ids, onSuccess) {
  const emailEl   = document.getElementById(ids.email);
  const consentEl = document.getElementById(ids.consent);
  const btn       = document.getElementById(ids.btn);
  const email = (emailEl && emailEl.value || '').trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    _subMsg(ids.msg, 'Please enter a valid email address.', false);
    return;
  }
  if (consentEl && !consentEl.checked) {
    _subMsg(ids.msg, 'Please tick the box to accept the Terms & Conditions and marketing consent.', false);
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
      _subMsg(ids.msg, '🎉 You’re subscribed! Watch your inbox for our next offers.', true);
      if (emailEl) emailEl.value = '';
      if (consentEl) consentEl.checked = false;
      if (onSuccess) onSuccess();
    } else {
      let detail = '';
      try { const j = await res.json(); detail = j.message || j.error || ''; } catch (_) {}
      console.error('[subscribe] failed', res.status, detail);
      _subMsg(ids.msg, 'Sorry, something went wrong. Please try again later.', false);
    }
  } catch (e) {
    console.error('[subscribe] network error', e);
    _subMsg(ids.msg, 'Network error — please check your connection and try again.', false);
  } finally {
    if (btn) { btn.disabled = false; if (btn.dataset._html) btn.innerHTML = btn.dataset._html; }
  }
}

// Fire-and-forget subscribe used where there's no dedicated form on screen —
// the signup modal's "Send me offers & updates" checkbox (email already
// captured by the signup fields) and the post-Google-signup prompt (email
// comes from the Google account). Same table/insert as _submitSubscribe,
// just without any DOM ids to read from or report into.
async function subscribeEmailToOffers(email) {
  email = (email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  try {
    await fetch(SB_URL + '/rest/v1/offer_subscribers?on_conflict=email', {
      method: 'POST',
      headers: {
        'apikey': SB_KEY,
        'Authorization': 'Bearer ' + SB_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=ignore-duplicates,return=minimal'
      },
      body: JSON.stringify({ email: email, consent: true, consent_at: new Date().toISOString(), unsubscribed: false })
    });
  } catch (e) {
    console.error('[subscribe] network error', e);
  }
}

function doSubscribe(ev) {
  if (ev && ev.preventDefault) ev.preventDefault();
  _submitSubscribe({ email: 'subEmail', consent: 'subConsent', btn: 'subBtn', msg: 'subMsg' });
}

function doNudgeSubscribe(ev) {
  if (ev && ev.preventDefault) ev.preventDefault();
  _submitSubscribe(
    { email: 'nudgeSubEmail', consent: 'nudgeSubConsent', btn: 'nudgeSubBtn', msg: 'nudgeSubMsg' },
    function() {
      // Subscribed — no need to nag again, and auto-close the nudge shortly
      // after so the success message is still readable for a moment first.
      localStorage.setItem('jain_offers_nudge_dismissed', '1');
      setTimeout(function() {
        var el = document.getElementById('offersNudge');
        if (el) el.style.display = 'none';
      }, 2200);
    }
  );
}
