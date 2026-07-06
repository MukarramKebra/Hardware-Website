// FEATURE: RECENTLY VIEWED
// ══════════════════════════════════════════════════════════════════════════════
function trackRecentlyViewed(id) {
  var list = JSON.parse(localStorage.getItem('jain_recently_viewed') || '[]');
  list = list.filter(function(x){ return x !== id; });
  list.unshift(id);
  if (list.length > 6) list = list.slice(0, 6);
  localStorage.setItem('jain_recently_viewed', JSON.stringify(list));
  renderRecentlyViewed();
}
function renderRecentlyViewed() {
  var section = document.getElementById('recentlyViewedSection');
  if (!section) return;
  var list = JSON.parse(localStorage.getItem('jain_recently_viewed') || '[]');
  var all = getAllProducts();
  var products = list.map(function(id){ return all.find(function(p){ return p.id === id; }); }).filter(Boolean);
  if (products.length < 2) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  var customPhotos = _sbPhotos || {};
  document.getElementById('recentlyViewedGrid').innerHTML = products.map(function(p) {
    var raw = customPhotos[p.id];
    var photo = (raw && (raw.startsWith('http') || raw.startsWith('data:'))) ? raw : p.img;
    var wishlisted = isWishlisted(p.id);
    return '<div class="rv-card" onclick="openProduct('+p.id+')">' +
      '<img src="'+photo+'" alt="'+p.name+'" onerror="imgError(this)" />' +
      '<div class="rv-name">'+p.name+'</div>' +
      '<div class="rv-price">'+p.price.toFixed(3)+' KWD</div>' +
    '</div>';
  }).join('');
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE: WISHLIST
// ══════════════════════════════════════════════════════════════════════════════
// getWishlist() / isWishlisted() live in js/02-catalog-render.js (loaded earlier —
// see the comment there for why).
function showToast(msg, duration) {
  var el = document.getElementById('toastMsg');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(function(){ el.classList.remove('show'); }, duration || 2500);
}

function toggleWishlist(id, event) {
  if (event) event.stopPropagation();
  var list = getWishlist();
  if (list.includes(id)) {
    list = list.filter(function(x){ return x !== id; });
    showToast('Removed from wishlist');
  } else {
    list.push(id);
    showToast('❤️ Added to wishlist!');
  }
  localStorage.setItem('jain_wishlist', JSON.stringify(list));
  renderWishlistCount();
  renderProducts();
  renderRecentlyViewed();
}
function renderWishlistCount() {
  var count = getWishlist().length;
  var badge = document.getElementById('wishlistBadge');
  var navBadge = document.getElementById('navWishlistBadge');
  if (badge) { badge.textContent = count; badge.style.display = count ? 'flex' : 'none'; }
  if (navBadge) { navBadge.textContent = count; navBadge.style.display = count ? 'inline' : 'none'; }
}
function openWishlist() {
  var list = getWishlist();
  var all = getAllProducts();
  var products = list.map(function(id){ return all.find(function(p){ return p.id===id; }); }).filter(Boolean);
  var overlay = document.getElementById('wishlistOverlay');
  var body = document.getElementById('wishlistBody');
  if (!overlay || !body) return;
  if (!products.length) {
    body.innerHTML = '<div style="text-align:center;padding:40px;color:#999"><i class="fa fa-heart" style="font-size:40px;margin-bottom:12px;display:block;opacity:0.3"></i><p>No saved items yet.<br>Tap the ❤️ on any product to save it.</p></div>';
  } else {
    var customPhotos = _sbPhotos || {};
    body.innerHTML = products.map(function(p) {
      var raw = customPhotos[p.id];
      var photo = (raw && (raw.startsWith('http') || raw.startsWith('data:'))) ? raw : p.img;
      return '<div class="wl-item">' +
        '<img src="'+photo+'" alt="'+p.name+'" onclick="closeWishlist();openProduct('+p.id+')" onerror="imgError(this)" />' +
        '<div class="wl-info" onclick="closeWishlist();openProduct('+p.id+')">' +
          '<div class="wl-name">'+p.name+'</div>' +
          '<div class="wl-price">'+p.price.toFixed(3)+' KWD</div>' +
        '</div>' +
        '<div class="wl-actions">' +
          '<button class="wl-add-btn" onclick="addToCart('+p.id+')"><i class="fa fa-cart-plus"></i> Add to Cart</button>' +
          '<button class="wl-remove-btn" onclick="toggleWishlist('+p.id+', event)"><i class="fa fa-trash"></i></button>' +
        '</div>' +
      '</div>';
    }).join('');
  }
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeWishlist() {
  var overlay = document.getElementById('wishlistOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE: SHARE PRODUCT ON WHATSAPP
// ══════════════════════════════════════════════════════════════════════════════
function shareProduct(id) {
  var p = getAllProducts().find(function(x){ return x.id === id; });
  if (!p) return;
  var url = 'https://mukarramkebra.github.io/Hardware-Website/';
  var msg = '🔧 *' + p.name + '*\n💰 ' + p.price.toFixed(3) + ' KWD\n\nCheck it out at Expert Hardware, Kuwait:\n' + url;
  window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE: ASK PRICE ON WHATSAPP (for price-on-request items, price = 0)
// ══════════════════════════════════════════════════════════════════════════════
function askPriceOnWhatsApp(id) {
  var p = getAllProducts().find(function(x){ return x.id === id; });
  if (!p) return;
  // getProductSku() already returns a "SKU-xxxx" / "SKU: xxxx" formatted
  // string, so it's inserted directly rather than wrapped in another
  // "(SKU: ...)" label, which used to print "SKU: SKU: ..." twice.
  var msg = 'Hi, I want this ' + p.name + ' (' + getProductSku(id) + ') price';
  window.open('https://wa.me/96597656372?text=' + encodeURIComponent(msg), '_blank');
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE: PRODUCT REVIEWS & RATINGS
// ══════════════════════════════════════════════════════════════════════════════
var _currentReviewProductId = null;
var _selectedStars = 0;

function renderStarsDisplay(rating, size) {
  var full = Math.round(rating || 0);
  var out = '';
  for (var i = 1; i <= 5; i++) {
    out += '<i class="fa fa-star" style="color:'+(i<=full?'#f5c518':'#ddd')+';font-size:'+(size||14)+'px"></i>';
  }
  return out;
}
function openReviews(id) {
  _currentReviewProductId = id;
  _selectedStars = 0;
  var p = getAllProducts().find(function(x){ return x.id === id; });
  var overlay = document.getElementById('reviewOverlay');
  if (!overlay) return;
  document.getElementById('reviewProductName').textContent = p ? p.name : '';
  document.getElementById('reviewStarInput').innerHTML = [1,2,3,4,5].map(function(s){
    return '<i class="fa fa-star rev-star-btn" data-star="'+s+'" onclick="selectStar('+s+')" style="font-size:28px;color:#ddd;cursor:pointer;padding:4px"></i>';
  }).join('');
  document.getElementById('reviewNameInput').value = '';
  document.getElementById('reviewCommentInput').value = '';
  document.getElementById('reviewErr').textContent = '';
  loadReviews(id);
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeReviews() {
  var overlay = document.getElementById('reviewOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}
function selectStar(n) {
  _selectedStars = n;
  var stars = document.querySelectorAll('.rev-star-btn');
  stars.forEach(function(s, i) {
    s.style.color = i < n ? '#f5c518' : '#ddd';
  });
}
async function loadReviews(id) {
  var list = document.getElementById('reviewList');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:20px;color:#aaa"><i class="fa fa-spinner fa-spin"></i></div>';
  try {
    var res = await sbFetch(SB_URL + '/rest/v1/expert_reviews?product_id=eq.'+id+'&order=created_at.desc', { headers: SB_H });
    if (res.error || !res.data || !res.data.length) {
      list.innerHTML = '<p style="text-align:center;color:#aaa;font-size:13px;padding:20px 0">No reviews yet. Be the first!</p>';
      return;
    }
    list.innerHTML = res.data.map(function(r) {
      var date = new Date(r.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
      return '<div class="rev-item">' +
        '<div class="rev-item-top">' +
          '<span class="rev-item-name"><i class="fa fa-user-circle"></i> '+encodeHtml(r.reviewer_name||'Anonymous')+'</span>' +
          '<span class="rev-item-date">'+date+'</span>' +
        '</div>' +
        '<div class="rev-item-stars">'+renderStarsDisplay(r.rating, 13)+'</div>' +
        (r.comment ? '<div class="rev-item-comment">'+encodeHtml(r.comment)+'</div>' : '') +
      '</div>';
    }).join('');
  } catch(e) {
    list.innerHTML = '<p style="text-align:center;color:#aaa;font-size:13px">Could not load reviews.</p>';
  }
}
async function submitReview() {
  if (!_selectedStars) { document.getElementById('reviewErr').textContent = 'Please select a star rating.'; return; }
  var name = document.getElementById('reviewNameInput').value.trim() || 'Anonymous';
  var comment = document.getElementById('reviewCommentInput').value.trim();
  var btn = document.getElementById('reviewSubmitBtn');
  btn.disabled = true; btn.textContent = 'Submitting...';
  try {
    var res = await sbFetch(SB_URL + '/rest/v1/expert_reviews', {
      method: 'POST',
      headers: Object.assign({}, SB_H, { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
      body: JSON.stringify({ product_id: _currentReviewProductId, rating: _selectedStars, reviewer_name: name, comment: comment })
    });
    if (res.error) throw new Error('Failed');
    showToast('Review submitted — thank you! ⭐');
    selectStar(0);
    document.getElementById('reviewNameInput').value = '';
    document.getElementById('reviewCommentInput').value = '';
    _selectedStars = 0;
    loadReviews(_currentReviewProductId);
  } catch(e) {
    document.getElementById('reviewErr').textContent = 'Could not submit review. Try again.';
  }
  btn.disabled = false; btn.textContent = 'Submit Review';
}
async function getAvgRating(id) {
  try {
    var res = await sbFetch(SB_URL + '/rest/v1/expert_reviews?product_id=eq.'+id+'&select=rating', { headers: SB_H });
    if (res.error || !res.data || !res.data.length) return null;
    var avg = res.data.reduce(function(s,r){ return s+r.rating; }, 0) / res.data.length;
    return { avg: avg, count: res.data.length };
  } catch(e) { return null; }
}
function encodeHtml(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE: BULK / TRADE QUOTE
// ══════════════════════════════════════════════════════════════════════════════
var _bulkRows = [];
function openBulkQuote() {
  _bulkRows = [{ product: '', qty: 1 }];
  renderBulkRows();
  var overlay = document.getElementById('bulkOverlay');
  if (overlay) { overlay.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeBulkQuote() {
  var overlay = document.getElementById('bulkOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}
function addBulkRow() {
  _bulkRows.push({ product: '', qty: 1 });
  renderBulkRows();
}
function removeBulkRow(i) {
  if (_bulkRows.length <= 1) return;
  _bulkRows.splice(i, 1);
  renderBulkRows();
}
function renderBulkRows() {
  var all = getAllProducts();
  var opts = '<option value="">-- Select Product --</option>' + all.map(function(p){
    return '<option value="'+p.id+'">'+p.name+' ('+p.price.toFixed(3)+' KWD)</option>';
  }).join('');
  document.getElementById('bulkRows').innerHTML = _bulkRows.map(function(r, i) {
    return '<div class="bulk-row">'+
      '<select class="bulk-sel" onchange="_bulkRows['+i+'].product=parseInt(this.value)||this.value">'+opts+'</select>'+
      '<input type="number" class="bulk-qty" value="'+r.qty+'" min="1" placeholder="Qty" autocomplete="off" onchange="_bulkRows['+i+'].qty=parseInt(this.value)||1" />'+
      '<button class="bulk-del-btn" onclick="removeBulkRow('+i+')" '+(i===0&&_bulkRows.length===1?'disabled':'')+'>'+
        '<i class="fa fa-trash"></i>'+
      '</button>'+
    '</div>';
  }).join('');
}
function sendBulkQuote() {
  var name = (document.getElementById('bulkName')||{}).value || '';
  var phone = (document.getElementById('bulkPhone')||{}).value || '';
  var all = getAllProducts();
  var lines = _bulkRows.filter(function(r){ return r.product; }).map(function(r) {
    var p = all.find(function(x){ return x.id == r.product; });
    return p ? '• ' + p.name + ' × ' + r.qty : null;
  }).filter(Boolean);
  if (!lines.length) { showToast('Please select at least one product'); return; }
  var msg = '📋 *Bulk / Trade Quote Request*\n';
  if (name) msg += '👤 Name: ' + name + '\n';
  if (phone) msg += '📞 Phone: ' + phone + '\n';
  msg += '\n*Items Requested:*\n' + lines.join('\n') + '\n\n_From Expert Hardware Website_';
  window.open('https://wa.me/96597656372?text=' + encodeURIComponent(msg), '_blank');
  closeBulkQuote();
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE: ORDER TRACKING
// ══════════════════════════════════════════════════════════════════════════════
function openOrderTracker() {
  var overlay = document.getElementById('trackOverlay');
  if (!overlay) return;
  document.getElementById('trackPhone').value = '';
  document.getElementById('trackResults').innerHTML = '';
  document.getElementById('trackErr').textContent = '';
  switchOrderTab('track');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeOrderTracker() {
  var overlay = document.getElementById('trackOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}
function switchOrderTab(tab) {
  document.getElementById('panelTrack').style.display  = tab === 'track'  ? '' : 'none';
  document.getElementById('panelCancel').style.display = tab === 'cancel' ? '' : 'none';
  document.getElementById('tabTrack').classList.toggle('active',  tab === 'track');
  document.getElementById('tabCancel').classList.toggle('active', tab === 'cancel');
}
async function findCancelOrders() {
  var phone = (document.getElementById('cancelPhone').value || '').trim().replace(/\s+/g,'');
  var errEl = document.getElementById('cancelErr');
  var resultsEl = document.getElementById('cancelResults');
  if (!phone) { errEl.textContent = 'Please enter your WhatsApp number.'; return; }
  errEl.textContent = '';
  resultsEl.innerHTML = '<div style="text-align:center;padding:20px;color:#aaa"><i class="fa fa-spinner fa-spin"></i> Searching...</div>';
  try {
    var res = await sbFetch(SB_URL + '/rest/v1/expert_orders?customer_phone=eq.'+encodeURIComponent(phone)+'&order=created_at.desc', { headers: SB_H });
    if (res.error || !res.data || !res.data.length) {
      resultsEl.innerHTML = '<div style="text-align:center;padding:24px;color:#aaa"><i class="fa fa-search" style="font-size:32px;opacity:0.3;display:block;margin-bottom:10px"></i><p>No orders found for this number.</p></div>';
      return;
    }
    var now = Date.now();
    var html = res.data.map(function(o) {
      var created = new Date(o.created_at).getTime();
      var ageMs = now - created;
      var canCancel = ageMs < 3600000 && o.status !== 'cancelled' && o.status !== 'delivered';
      var minsAgo = Math.floor(ageMs / 60000);
      var dt = new Date(o.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
      var items = '';
      try { var arr = typeof o.items==='string' ? JSON.parse(o.items) : (o.items||[]); items = arr.map(function(it){ return it.name+' ×'+it.qty; }).join(', '); } catch(e){}
      var statusColor = {pending:'#f59e0b',confirmed:'#3b82f6',delivered:'#16a34a',cancelled:'#dc2626'}[o.status]||'#aaa';
      var st = o.status||'pending';
      return '<div class="track-order-card">'+
        '<div class="track-status-row">'+
          '<div><div class="track-status-label" style="color:'+statusColor+'">'+st.charAt(0).toUpperCase()+st.slice(1)+'</div>'+
          '<div class="track-date">'+dt+' &nbsp;·&nbsp; '+minsAgo+' min ago</div></div>'+
          '<div class="track-total">'+parseFloat(o.total||0).toFixed(3)+' KWD</div>'+
        '</div>'+
        '<div class="track-items">'+items+'</div>'+
        (canCancel
          ? '<button class="cancel-order-btn" onclick="cancelOrder(\''+o.id+'\',this)"><i class="fa fa-times-circle"></i> Cancel This Order</button>'
          : (o.status==='cancelled'
            ? '<div class="cancel-status-msg cancelled">Order already cancelled</div>'
            : ageMs >= 3600000
            ? '<div class="cancel-status-msg expired"><i class="fa fa-lock"></i> Cannot cancel — over 1 hour old</div>'
            : '<div class="cancel-status-msg delivered">Order '+st+' — cannot cancel</div>')
        )+
      '</div>';
    }).join('');
    resultsEl.innerHTML = '<p style="font-size:12px;color:#888;margin-bottom:12px">Found '+res.data.length+' order(s)</p>' + html;
  } catch(e) {
    resultsEl.innerHTML = '<p style="color:#dc2626;text-align:center">Could not load orders. Try again.</p>';
  }
}
async function cancelOrder(orderId, btn) {
  if (!confirm('Are you sure you want to cancel this order?')) return;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Cancelling...';
  var res = await sbFetch(SB_URL + '/rest/v1/expert_orders?id=eq.'+orderId, {
    method: 'PATCH',
    headers: Object.assign({}, SB_H, { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
    body: JSON.stringify({ status: 'cancelled' })
  });
  if (res.error) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa fa-times-circle"></i> Cancel This Order';
    showToast('Could not cancel. Please try again.');
  } else {
    btn.closest('.track-order-card').querySelector('.cancel-order-btn').outerHTML = '<div class="cancel-status-msg cancelled"><i class="fa fa-check-circle"></i> Order cancelled successfully</div>';
    showToast('✅ Order cancelled.');
  }
}
async function trackOrder() {
  var phone = (document.getElementById('trackPhone').value || '').trim().replace(/\s+/g,'');
  var errEl = document.getElementById('trackErr');
  var resultsEl = document.getElementById('trackResults');
  if (!phone) { errEl.textContent = 'Please enter your WhatsApp number.'; return; }
  errEl.textContent = '';
  resultsEl.innerHTML = '<div style="text-align:center;padding:20px;color:#aaa"><i class="fa fa-spinner fa-spin"></i> Searching...</div>';
  try {
    var res = await sbFetch(SB_URL + '/rest/v1/expert_orders?customer_phone=eq.'+encodeURIComponent(phone)+'&order=created_at.desc', { headers: SB_H });
    if (res.error || !res.data || !res.data.length) {
      resultsEl.innerHTML = '<div style="text-align:center;padding:24px;color:#aaa"><i class="fa fa-search" style="font-size:32px;opacity:0.3;display:block;margin-bottom:10px"></i><p>No orders found for this number.<br><small>Make sure you enter the number used during checkout.</small></p></div>';
      return;
    }
    var statusIcon = { pending:'fa-clock', confirmed:'fa-check-circle', delivered:'fa-truck', cancelled:'fa-times-circle' };
    var statusColor = { pending:'#f59e0b', confirmed:'#3b82f6', delivered:'#16a34a', cancelled:'#dc2626' };
    resultsEl.innerHTML = '<p style="font-size:12px;color:#888;margin-bottom:12px">Found '+res.data.length+' order(s)</p>' +
      res.data.map(function(o) {
        var dt = o.created_at ? new Date(o.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
        var items = '';
        try { var arr = typeof o.items==='string' ? JSON.parse(o.items) : (o.items||[]); items = arr.map(function(it){ return it.name+' ×'+it.qty; }).join(', '); } catch(e){}
        var st = o.status || 'pending';
        var icon = statusIcon[st] || 'fa-circle';
        var color = statusColor[st] || '#aaa';
        return '<div class="track-order-card">'+
          '<div class="track-status-row">'+
            '<i class="fa '+icon+'" style="color:'+color+';font-size:20px"></i>'+
            '<div>'+
              '<div class="track-status-label" style="color:'+color+'">'+st.charAt(0).toUpperCase()+st.slice(1)+'</div>'+
              '<div class="track-date">'+dt+'</div>'+
            '</div>'+
            '<div class="track-total">'+parseFloat(o.total||0).toFixed(3)+' KWD</div>'+
          '</div>'+
          '<div class="track-items">'+items+'</div>'+
          (o.address ? '<div class="track-addr"><i class="fa fa-map-marker-alt"></i> '+o.address+'</div>' : '')+
        '</div>';
      }).join('');
  } catch(e) {
    resultsEl.innerHTML = '<p style="color:#dc2626;text-align:center">Could not load orders. Try again.</p>';
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE: WHATSAPP CHAT FAB
// ══════════════════════════════════════════════════════════════════════════════
function openWAChat() {
  window.open('https://wa.me/96597656372?text=' + encodeURIComponent('Hi! I\'d like to ask about your products at Expert Hardware 🔧'), '_blank');
}

// Call on page load to restore recently viewed and wishlist state
(function initExtras() {
  setTimeout(function() {
    renderRecentlyViewed();
    renderWishlistCount();
  }, 500);
})();

// Render products immediately from hardcoded array (instant display), then
// load live stock/photos/hidden status from Supabase and re-render. This runs
// here (last script to load) so every helper renderProducts() needs is defined.
renderProducts();
loadSBData();
