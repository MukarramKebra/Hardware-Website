// ── PRODUCT DETAIL MODAL ──────────────────────────────────────────────────
let _pmQty = 1;
let _pmId  = null;

function openProduct(id) {
  trackView(id);
  trackRecentlyViewed(id);
  _pmId  = id;
  _pmQty = 1;
  const p           = getAllProducts().find(x => x.id === id);
  const liveStatus  = getLiveStock(id) || p.stock;
  const liveQty     = getLiveQty(id);
  const isOut       = liveStatus === 'out-of-stock';
  const isLow       = liveStatus === 'low-stock';
  const customPhotos = _sbPhotos;
  // Only use a stored photo if it's a real URL (http/data:) — otherwise use the local Bahar-Products image
  const rawPhoto = customPhotos[id];
  const bigImg = (rawPhoto && (rawPhoto.startsWith('http') || rawPhoto.startsWith('data:')))
    ? rawPhoto
    : p.img;

  let stockIcon, stockTxt, stockCls;
  if (isOut)      { stockIcon = 'fa-times-circle'; stockTxt = 'Out of Stock'; stockCls = 'out-of-stock'; }
  else if (isLow) { stockIcon = 'fa-exclamation-circle'; stockTxt = 'Low Stock — only ' + (liveQty||'few') + ' left!'; stockCls = 'low-stock'; }
  else            { stockIcon = 'fa-check-circle'; stockTxt = 'In Stock' + (liveQty !== null ? ' — ' + liveQty + ' available' : ''); stockCls = 'in-stock'; }

  document.getElementById('prodModalSku').textContent = getProductSku(id);
  document.getElementById('prodModalBody').innerHTML =
    '<div class="pm-img-col">' +
      (bigImg
        ? '<img src="' + bigImg + '" alt="' + p.name + '" onerror="imgError(this)" />' +
          '<div class="pm-img-fallback" id="pmFallback"><i class="fa fa-tools"></i></div>'
        : '<div class="pm-img-fallback" id="pmFallback" style="display:flex"><i class="fa fa-tools"></i></div>') +
    '</div>' +
    '<div class="pm-info-col">' +
      '<div class="pm-badge-row">' +
        '<span class="pm-badge cat"><i class="fa fa-tag"></i> ' + p.category.replace('-', ' ') + '</span>' +
        (p.badge ? '<span class="pm-badge orange">' + p.badge + '</span>' : '') +
      '</div>' +
      '<h2 class="pm-name">' + p.name + '</h2>' +
      '<p class="pm-desc">' + p.desc + '</p>' +
      (p.price > 0 ? (
      '<div class="pm-price">' + p.price.toFixed(3) + ' <small>KWD</small></div>' +
      '<div class="pm-stock-line ' + stockCls + '"><i class="fa ' + stockIcon + '"></i> ' + stockTxt + '</div>' +
      (!isOut ?
        '<div class="pm-qty-row">' +
          '<span class="pm-qty-lbl">Quantity</span>' +
          '<div class="pm-qty-ctrl">' +
            '<button onclick="pmChangeQty(-1)"><i class="fa fa-minus"></i></button>' +
            '<input type="number" id="pmQtyDisplay" value="1" min="1" autocomplete="off" oninput="pmQtyInput(this)" onblur="pmQtyBlur(this)" />' +
            '<button onclick="pmChangeQty(1)"><i class="fa fa-plus"></i></button>' +
          '</div>' +
        '</div>'
      : '') +
      '<button class="pm-add-btn" id="pmAddBtn" ' + (isOut ? 'disabled' : 'onclick="pmAddToCart()"') + '>' +
        '<i class="fa ' + (isOut ? 'fa-ban' : 'fa-shopping-cart') + '"></i> ' +
        (isOut ? 'Out of Stock' : 'Add to Cart') +
      '</button>'
      ) : (
      '<div class="pm-price" style="font-size:15px;color:var(--gray-600)">Price on request</div>' +
      '<button class="pm-add-btn" id="pmAddBtn" style="background:#25D366" onclick="askPriceOnWhatsApp(' + id + ')">' +
        '<i class="fab fa-whatsapp"></i> Ask Price on WhatsApp' +
      '</button>'
      )) +
      '<div class="pm-action-row">' +
        '<button class="pm-wl-btn '+(isWishlisted(id)?'wishlisted':'')+'" onclick="toggleWishlist('+id+', event)">' +
          '<i class="fa fa-heart"></i> '+(isWishlisted(id)?'Saved':'Save') +
        '</button>' +
        '<button class="pm-share-btn" onclick="shareProduct('+id+')">' +
          '<i class="fab fa-whatsapp"></i> Share' +
        '</button>' +
        '<button class="pm-review-btn" onclick="openReviews('+id+')">' +
          '<i class="fa fa-star"></i> Reviews' +
        '</button>' +
      '</div>' +
      '<div class="pm-divider"></div>' +
      '<div class="pm-features">' +
        '<div class="pm-feat"><i class="fa fa-check-circle"></i> 100% genuine, quality-tested product</div>' +
        '<div class="pm-feat"><i class="fa fa-shipping-fast"></i> Same-day delivery in Kuwait City</div>' +
        '<div class="pm-feat"><i class="fa fa-shield-alt"></i> Easy returns &amp; after-sales support</div>' +
        '<div class="pm-feat"><i class="fa fa-tags"></i> Bulk pricing available for contractors</div>' +
      '</div>' +
    '</div>';

  renderRelatedProducts(id, p.category);
  const overlay = document.getElementById('prodOverlay');
  overlay.classList.add('open');
  overlay.scrollTop = 0;
  document.body.classList.add('product-open');
  document.body.style.overflow = 'hidden';
}

// "Customers Also Bought" — shown below the product info, same-category items
// first, filled out with other products. Reuses the Recently Viewed card style.
function renderRelatedProducts(currentId, category) {
  const section = document.getElementById('pmRelatedSection');
  if (!section) return;
  const all     = getAllProducts().filter(p => p.id !== currentId);
  const sameCat = all.filter(p => p.category === category);
  const others  = all.filter(p => p.category !== category);
  const picks   = sameCat.concat(others).slice(0, 6);
  if (!picks.length) { section.innerHTML = ''; return; }
  const customPhotos = _sbPhotos || {};
  section.innerHTML =
    '<div class="pm-related-head"><i class="fa fa-thumbs-up"></i> Customers Also Bought</div>' +
    '<div class="rv-grid">' +
    picks.map(p => {
      const raw   = customPhotos[p.id];
      const photo = (raw && (raw.startsWith('http') || raw.startsWith('data:'))) ? raw : p.img;
      return '<div class="rv-card" onclick="openProduct(' + p.id + ')">' +
        '<img src="' + photo + '" alt="' + p.name + '" onerror="imgError(this)" />' +
        '<div class="rv-name">' + p.name + '</div>' +
        '<div class="rv-price">' + p.price.toFixed(3) + ' KWD</div>' +
      '</div>';
    }).join('') +
    '</div>';
}

function closeProduct() {
  document.getElementById('prodOverlay').classList.remove('open');
  document.body.style.overflow = '';
  document.body.classList.remove('product-open');
  _pmId = null; _pmQty = 1;
}

function pmChangeQty(delta) {
  const liveQty = getLiveQty(_pmId);
  const max = liveQty !== null ? liveQty : 999;
  _pmQty = Math.max(1, Math.min(max, _pmQty + delta));
  var el = document.getElementById('pmQtyDisplay');
  if (el) el.value = _pmQty;
}

function pmQtyInput(el) {
  const liveQty = getLiveQty(_pmId);
  const max = liveQty !== null ? liveQty : 999;
  var v = parseInt(el.value, 10);
  if (isNaN(v) || v < 1) { _pmQty = 1; return; }
  if (v > max) { v = max; el.value = max; }
  _pmQty = v;
}

function pmQtyBlur(el) {
  // Snap to valid value when user leaves the field
  var v = parseInt(el.value, 10);
  if (isNaN(v) || v < 1) v = 1;
  const liveQty = getLiveQty(_pmId);
  const max = liveQty !== null ? liveQty : 999;
  _pmQty = Math.min(v, max);
  el.value = _pmQty;
}

function pmAddToCart() {
  const product  = getAllProducts().find(p => p.id === _pmId);
  const liveQty  = getLiveQty(_pmId);
  const inCart   = cart.find(c => c.id === _pmId);
  const cartQty  = inCart ? inCart.qty : 0;
  if (liveQty !== null && cartQty + _pmQty > liveQty) {
    alert('Only ' + liveQty + ' units available. You already have ' + cartQty + ' in your cart.');
    return;
  }
  if (inCart) { inCart.qty += _pmQty; } else { cart.push(Object.assign({}, product, { qty: _pmQty })); }
  updateCartUI();
  // Flash the button green — stay on the product page, no cart popup
  const btn = document.getElementById('pmAddBtn');
  const original = btn.innerHTML;
  btn.classList.add('pm-added-flash');
  btn.innerHTML = '<i class="fa fa-check"></i> Added to Cart!';
  showToast('Added to cart');
  setTimeout(function() {
    btn.classList.remove('pm-added-flash');
    btn.innerHTML = original;
  }, 1200);
}

// ESC key closes any open modal
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeProduct();
    document.getElementById('cartModal').classList.remove('open');
    document.getElementById('checkoutOverlay').classList.remove('open');
  }
});

// ── CART ──────────────────────────────────────────────────────────────────
// btn (optional) is the clicked "Add" button — when given, it plays a brief
// loading spinner -> checkmark sequence before the toast pops up.
function addToCart(id, btn) {
  if (btn && btn.dataset.busy === '1') return;
  trackView(id);
  const product  = getAllProducts().find(p => p.id === id);
  const liveQty  = getLiveQty(id);
  const inCart   = cart.find(c => c.id === id);
  const cartQty  = inCart ? inCart.qty : 0;
  if (liveQty !== null && cartQty >= liveQty) {
    alert('Sorry, only ' + liveQty + ' units available in stock!'); return;
  }
  function commit() {
    if (inCart) { inCart.qty++; } else { cart.push({...product, qty:1}); }
    updateCartUI();
  }
  if (!btn) { commit(); showToast('Added to cart'); return; }
  btn.dataset.busy = '1';
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.classList.add('btn-add-loading');
  btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Adding...';
  setTimeout(function() {
    commit();
    btn.classList.remove('btn-add-loading');
    btn.classList.add('btn-add-added');
    btn.innerHTML = '<i class="fa fa-check"></i> Added';
    showToast('Added to cart');
    setTimeout(function() {
      btn.classList.remove('btn-add-added');
      btn.innerHTML = original;
      btn.disabled = false;
      delete btn.dataset.busy;
    }, 1000);
  }, 600);
}
function removeFromCart(id) { cart = cart.filter(c => c.id !== id); updateCartUI(); }
function updateCartUI() {
  const count = cart.reduce((s,c) => s+c.qty, 0);
  // Update any cart count badges safely (header count may not exist)
  const cc = document.getElementById('cartCount');
  if (cc) cc.textContent = count;
  const fab = document.getElementById('mobCartCount');
  if (fab) fab.textContent = count;
  const body  = document.getElementById('cartItems');
  const total = cart.reduce((s,c) => s+c.price*c.qty, 0);
  document.getElementById('cartTotal').textContent = total.toFixed(3) + ' KWD';
  const customPhotos = _sbPhotos;
  if (!cart.length) { body.innerHTML = '<p class="empty-cart">Your cart is empty.</p>'; return; }
  body.innerHTML = cart.map(c => {
    // Only use stored photo if it's a real URL — otherwise fall back to local image
    const rawPh = customPhotos[c.id];
    const imgSrc = (rawPh && (rawPh.startsWith('http') || rawPh.startsWith('data:'))) ? rawPh : c.img;
    return `
    <div class="cart-item">
      <div class="cart-item-icon"><img src="${imgSrc}" alt="${c.name}" onerror="imgError(this)" /></div>
      <div class="cart-item-info">
        <strong>${c.name}</strong>
        <span>Qty: ${c.qty} &times; ${c.price.toFixed(3)} KWD</span>
      </div>
      <div class="cart-item-actions">
        <span class="cart-item-price">${(c.price*c.qty).toFixed(3)} KWD</span>
        <button class="btn-remove" onclick="removeFromCart(${c.id})"><i class="fa fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}
function openCart() { document.getElementById('cartModal').classList.add('open'); }

// ── CHECKOUT ──────────────────────────────────────────────────────────────
function openCheckout() {
  if (!cart.length) return;
  const customPhotos = _sbPhotos;
  document.getElementById('coItems').innerHTML = cart.map(c => `
    <div class="co-item">
      <div><span class="co-item-name">${c.name}</span><br/><span class="co-item-qty">x${c.qty} unit${c.qty>1?'s':''}</span></div>
      <span class="co-item-price">${(c.price*c.qty).toFixed(3)} KWD</span>
    </div>`).join('');
  const total = cart.reduce((s,c) => s+c.price*c.qty, 0);
  document.getElementById('coTotal').textContent = total.toFixed(3) + ' KWD';
  document.getElementById('cartModal').classList.remove('open');
  document.getElementById('checkoutOverlay').classList.add('open');
  // Pre-fill from saved profile if user is logged in
  if (_userProfile) {
    if (_userProfile.name)  document.getElementById('coName').value  = _userProfile.name;
    if (_userProfile.phone) document.getElementById('coPhone').value = _userProfile.phone;
    // Parse saved address back into the area field if possible
    if (_userProfile.address) {
      const addrParts = _userProfile.address.split(',').map(s => s.trim());
      const areaEl = document.getElementById('coArea');
      if (addrParts.length) {
        for (let i = 0; i < areaEl.options.length; i++) {
          if (areaEl.options[i].text === addrParts[0]) { areaEl.value = addrParts[0]; break; }
        }
      }
    }
  }
}

// ── FULFILMENT TOGGLE ─────────────────────────────────────────────────────
let _fulfilment = 'delivery'; // 'delivery' | 'pickup'
function setFulfilment(mode) {
  _fulfilment = mode;
  document.getElementById('ftDelivery').classList.toggle('active', mode === 'delivery');
  document.getElementById('ftPickup').classList.toggle('active', mode === 'pickup');
  document.getElementById('coDeliverySection').style.display = mode === 'delivery' ? '' : 'none';
  document.getElementById('coPickupInfo').style.display = mode === 'pickup' ? '' : 'none';
}

document.getElementById('coSubmitBtn').addEventListener('click', () => {
  const name  = document.getElementById('coName').value.trim();
  const phone = document.getElementById('coPhone').value.trim();
  const isPickup = _fulfilment === 'pickup';

  // Validate required fields
  let valid = true;
  ['coName','coPhone'].forEach(id => {
    const el = document.getElementById(id);
    if (!el.value.trim()) { el.classList.add('err'); valid = false; }
    else el.classList.remove('err');
  });
  if (!isPickup) {
    const areaEl = document.getElementById('coArea');
    if (!areaEl.value) { areaEl.classList.add('err'); valid = false; }
    else areaEl.classList.remove('err');
  }
  if (!valid) { alert('Please fill in your name and WhatsApp number' + (isPickup ? '.' : ', and select your area.')); return; }

  const notes  = document.getElementById('coNotes').value.trim();
  const total  = cart.reduce((s,c) => s+c.price*c.qty, 0);
  const orderLines = cart.map(c => `  • ${c.name} x${c.qty} — ${(c.price*c.qty).toFixed(3)} KWD`).join('\n');

  let address = '';
  if (!isPickup) {
    const area   = document.getElementById('coArea').value;
    const block  = document.getElementById('coBlock').value.trim();
    const street = document.getElementById('coStreet').value.trim();
    const house  = document.getElementById('coHouse').value.trim();
    const floor  = document.getElementById('coFloor').value.trim();
    address = [area, block&&'Block '+block, street&&'Street '+street, house, floor].filter(Boolean).join(', ');
  }

  const msg = [
    '🔧 *Expert Hardware Order* 🔧',
    '',
    '👤 *Name:* ' + name,
    '📞 *WhatsApp:* ' + phone,
    isPickup ? '🏪 *Fulfilment:* Store Pick Up' : '📍 *Delivery Address:* ' + address,
    notes ? '📝 *Notes:* ' + notes : '',
    '',
    '🛒 *Order:*',
    orderLines,
    '',
    '💰 *Total: ' + total.toFixed(3) + ' KWD*',
    '',
    'Please confirm my order. Thank you!'
  ].filter(l => l !== null).join('\n');

  // Deduct stock
  deductStock(cart);

  // Save order to Supabase
  saveOrderToSupabase({ name, phone, address: isPickup ? 'PICK UP' : address, notes, items: cart.map(c=>({name:c.name,sku:getProductSku(c.id),qty:c.qty,price:c.price})), total });

  // Open WhatsApp
  window.open('https://wa.me/96597656372?text=' + encodeURIComponent(msg), '_blank');

  // Show success, clear cart
  cart = [];
  updateCartUI();
  renderProducts();
  const nudgeHtml = !_authUser ? `
    <div class="order-nudge">
      <p><i class="fa fa-info-circle"></i> Create a free account to track this order and view your order history anytime.</p>
      <button onclick="document.getElementById('checkoutOverlay').classList.remove('open');openAuthModal('signup')">Create Account &rarr;</button>
    </div>` : '';
  document.getElementById('coBody').innerHTML = `
    <div class="co-success">
      <i class="fab fa-whatsapp"></i>
      <h3>Order Sent!</h3>
      <p>Your order has been sent to Expert Hardware on WhatsApp.<br/>We will confirm and arrange delivery shortly.<br/><br/><strong>Thank you, ${name}!</strong></p>
      ${nudgeHtml}
      <br/>
      <button class="btn btn-primary" onclick="document.getElementById('checkoutOverlay').classList.remove('open');document.getElementById('coBody').innerHTML=origCoBody">Continue Shopping</button>
    </div>`;
});

// Store original checkout body to reset it
let origCoBody = '';
window.addEventListener('load', () => { origCoBody = document.getElementById('coBody').innerHTML; });

// ── EVENTS ────────────────────────────────────────────────────────────────
function $on(id, evt, fn) { var el = document.getElementById(id); if (el) el.addEventListener(evt, fn); }
window.addEventListener('scroll', () => document.getElementById('header').classList.toggle('scrolled', window.scrollY > 40));
$on('hamburger',       'click', () => document.getElementById('nav').classList.toggle('open'));
$on('cartBtn',         'click', openCart);
$on('mobCartFab',      'click', openCart);
$on('closeCart',       'click', () => document.getElementById('cartModal').classList.remove('open'));
$on('cartModal',       'click', e => { if (e.target === document.getElementById('cartModal')) document.getElementById('cartModal').classList.remove('open'); });
$on('checkoutBtn',     'click', openCheckout);
$on('closeCheckout',   'click', () => document.getElementById('checkoutOverlay').classList.remove('open'));
$on('checkoutOverlay', 'click', e => { if (e.target === document.getElementById('checkoutOverlay')) document.getElementById('checkoutOverlay').classList.remove('open'); });
document.querySelectorAll('.pill').forEach(pill => {
  pill.addEventListener('click', () => {
    activeFilter = pill.dataset.filter;
    syncCatNav(activeFilter);
    renderProducts();
  });
});
document.getElementById('searchInput').addEventListener('input', renderProducts);
document.getElementById('contactForm').addEventListener('submit', e => {
  e.preventDefault();
  document.getElementById('formSuccess').classList.add('show');
  e.target.reset();
  setTimeout(() => document.getElementById('formSuccess').classList.remove('show'), 4000);
});
// Initial renderProducts()/loadSBData() call moved to js/06-features.js (last
// file to load) — renderProducts() depends on _lang and isWishlisted, which
// are declared in files that load after this one.

