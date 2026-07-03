// ── MULTI-CATEGORY HELPER (storefront) ────────────────────────────────────
// Returns array of extra category slugs assigned to a product via the admin
// multi-category picker (stored in bahar_multi_cats in localStorage).
function getMultiCats(id) {
  try {
    var map = JSON.parse(localStorage.getItem('bahar_multi_cats') || '{}');
    return Array.isArray(map[String(id)]) ? map[String(id)] : [];
  } catch(e) { return []; }
}

// Moved up from js/06-features.js: renderProducts() (below) calls isWishlisted()
// on every product card, and renderProducts() runs at page load from
// js/03-product-cart-checkout.js — before js/06-features.js has loaded. Keeping
// these two small localStorage helpers here (loaded before 03) avoids a
// ReferenceError on first render.
function getWishlist() {
  try { return JSON.parse(localStorage.getItem('jain_wishlist') || '[]'); } catch(e) { return []; }
}
function isWishlisted(id) { return getWishlist().includes(id); }

function imgError(el) {
  // Step 1: try the local Bahar-Products fallback path if we haven't yet
  const local = el.dataset.local;
  if (!el.dataset.triedLocal && local && el.src !== local && !el.src.includes('Bahar-Products')) {
    el.dataset.triedLocal = '1';
    el.src = local;
    return;
  }
  // Step 2: retry once after 4 seconds
  if (!el.dataset.retry) {
    el.dataset.retry = '1';
    const src = el.src;
    setTimeout(() => { el.src = ''; el.src = src; }, 4000);
  } else {
    // Step 3: give up, show placeholder icon
    el.style.display = 'none';
    if (el.nextElementSibling) el.nextElementSibling.style.display = 'flex';
  }
}

// ── ANALYTICS TRACKING ────────────────────────────────────────────────────
function trackView(id) {
  const v = JSON.parse(localStorage.getItem('bahar_views') || '{}');
  v[id] = (v[id] || 0) + 1;
  localStorage.setItem('bahar_views', JSON.stringify(v));
  // Sync to Supabase so admin analytics tab can see live data
  sbFetch(SB_URL + '/rest/v1/rpc/increment_expert_analytics', {
    method: 'POST',
    headers: { ...SB_H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_id: id, p_views: 1, p_searches: 0 })
  });
}
function trackSearchText(query) {
  if (!query || query.length < 2) return;
  var terms = JSON.parse(localStorage.getItem('jain_search_terms') || '{}');
  var key = query.toLowerCase().trim();
  terms[key] = (terms[key] || 0) + 1;
  localStorage.setItem('jain_search_terms', JSON.stringify(terms));
}
function trackSearch(ids) {
  if (!ids || !ids.length) return;
  const s = JSON.parse(localStorage.getItem('bahar_searches') || '{}');
  ids.forEach(function(id) { s[id] = (s[id] || 0) + 1; });
  localStorage.setItem('bahar_searches', JSON.stringify(s));
  // Sync to Supabase so admin analytics tab can see live data
  ids.forEach(function(id) {
    sbFetch(SB_URL + '/rest/v1/rpc/increment_expert_analytics', {
      method: 'POST',
      headers: { ...SB_H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_id: id, p_views: 0, p_searches: 1 })
    });
  });
}

// ── CATEGORY NAV STRIP ────────────────────────────────────────────────────
function syncCatNav(cat) {
  document.querySelectorAll('.cn-item').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  document.querySelectorAll('.pill').forEach(p => p.classList.toggle('active', p.dataset.filter === cat));
}
// Scroll the products into view BELOW the fixed header + sticky category strip,
// so a single click reliably reveals the filtered products (they were being hidden
// behind the sticky bars before, which made it feel like you had to click twice).
function scrollToProducts() {
  const prods = document.getElementById('products');
  if (!prods) return;
  const header = document.getElementById('header');
  const nav    = document.getElementById('cat-nav');
  const offset = (header ? header.offsetHeight : 0) + (nav ? nav.offsetHeight : 0) + 10;
  const y = prods.getBoundingClientRect().top + window.scrollY - offset;
  // instant jump (no scroll animation) — category clicks should feel like
  // switching a page, not scrolling down it
  window.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
}

// ── OFFERS CAROUSEL ───────────────────────────────────────────────────────
// Moving row of offer cards; the image fills the whole card frame (like products).
function initOffersTicker() {
  const track = document.getElementById('offersTrack');
  if (!track) return;
  const offers = [
    { img:'cat-images/tools.jpg',        tag:'UP TO 20% OFF', name:'DCK Power Tools',        sub:'Drills · Grinders · Saws',    cat:'tools' },
    { img:'cat-images/hand-tools.png',   tag:'BEST PRICE',    name:'Hand Tools',             sub:'Hammers · Spanners · Pliers', cat:'hand-tools' },
    { img:'cat-images/safety.jpg',       tag:'STAY SAFE',     name:'Safety Gear',            sub:'Helmets · Gloves · Boots',    cat:'safety' },
    { img:'cat-images/fastener.png',     tag:'BULK DEALS',    name:'Fasteners',              sub:'Screws · Bolts · Anchors',    cat:'fastener' },
    { img:'cat-images/tape.png',         tag:'10% OFF',       name:'Tapes',                  sub:'Clear · Duct · Masking',      cat:'tape' },
    { img:'cat-images/disc.jpg',         tag:'HOT DEAL',      name:'Discs',                  sub:'Cutting · Grinding Discs',    cat:'disc' },
    { img:'cat-images/door-handle.png',  tag:'COMBO OFFER',   name:'Door Handles',           sub:'Handles · Locks · Knobs',     cat:'door-handle' },
    { img:'cat-images/gardening.png',    tag:'NEW ARRIVAL',   name:'Garden Tools',           sub:'Hoses · Trimmers · More',     cat:'gardening' }
  ];
  const cards = offers.map(o => `
    <div class="offer-card" onclick="filterProducts('${o.cat}')">
      <div class="offer-card-img">
        <span class="offer-tag">${o.tag}</span>
        <img src="${o.img}" alt="${o.name}" loading="lazy" onerror="imgError(this)"/>
      </div>
      <div class="offer-card-info">
        <div class="offer-title">${o.name}</div>
        <div class="offer-sub">${o.sub}</div>
      </div>
    </div>`).join('');
  // Repeat the card set enough times to comfortably exceed the viewport width
  // (same technique as fillMarquee() in js/04-i18n-order.js) — with only one
  // duplicate, wide screens could show the whole loop at once, making the
  // restart visible/jarring instead of a seamless scroll.
  track.innerHTML = cards;
  const singleW = track.scrollWidth;
  if (!singleW) { track.innerHTML = cards + cards; return; }
  const vw     = window.innerWidth || 1280;
  const copies = Math.max(2, Math.ceil(vw / singleW) + 1);
  let half = '';
  for (let i = 0; i < copies; i++) half += cards;
  track.innerHTML = half + half;
  track.style.animationDuration = Math.round((singleW * copies) / 70) + 's';
}
initOffersTicker();

// ── SIDE BANNERS ──────────────────────────────────────────────────────────
// Default set used until (or unless) the admin adds banners in Supabase —
// see admin/js/05-categories.js. Images live in the Banners/ folder.
const DEFAULT_BANNERS = [
  { brand: 'DCK',    img: 'Banners/dck1.jpg' },
  { brand: 'DCK',    img: 'Banners/dck2.jpg' },
  { brand: 'Covax',  img: 'Banners/covax1.jpg' },
  { brand: 'Covax',  img: 'Banners/covax2.jpg' },
  { brand: 'iTrust', img: 'Banners/itrust1.jpg' },
  { brand: 'iTrust', img: 'Banners/itrust2.jpg' },
  { brand: 'iTrust', img: 'Banners/itrust3.jpg' },
  { brand: 'iTrust', img: 'Banners/itrust4.jpg' }
];

// Groups banners by brand and interleaves them (one per brand per pass) so no
// single brand's images sit consecutively — this is what lets _splitBanners()
// spread brands evenly and mostly avoid showing the same brand on both
// banners at once.
function _interleaveByBrand(list) {
  const byBrand = {}, order = [];
  list.forEach(function(b) {
    if (!byBrand[b.brand]) { byBrand[b.brand] = []; order.push(b.brand); }
    byBrand[b.brand].push(b);
  });
  const result = [];
  let more = true;
  while (more) {
    more = false;
    order.forEach(function(brand) {
      if (byBrand[brand].length) { result.push(byBrand[brand].shift()); more = true; }
    });
  }
  return result;
}
function _splitBanners(list) {
  const seq = _interleaveByBrand(list);
  const left = [], right = [];
  seq.forEach(function(b, i) { (i % 2 === 0 ? left : right).push(b); });
  return { left: left, right: right };
}

function _renderBannerSlides(container, slides) {
  if (!container) return;
  container.innerHTML = slides.map(function(b, i) {
    return '<div class="banner-slide' + (i === 0 ? ' active' : '') + '" onclick="scrollToProducts()" style="background-image:url(\'' + b.img + '\')">' +
      '<div class="banner-overlay"><span class="banner-tag">' + b.brand + '</span></div>' +
    '</div>';
  }).join('') +
  // Up arrow sits centred in the letterbox area above the image, down arrow
  // in the area below it (instead of both stacked in a corner)
  '<button class="banner-nav-btn banner-nav-up" onclick="event.stopPropagation();bannerNext()" title="Next"><i class="fa fa-chevron-up"></i></button>' +
  '<button class="banner-nav-btn banner-nav-down" onclick="event.stopPropagation();bannerPrevious()" title="Previous"><i class="fa fa-chevron-down"></i></button>';
}

// Both vertical banners share one index so their slides always change
// together, one at a time. The up arrow moves to the next banner, the down
// arrow goes back — either one restarts the 3-second auto-rotate timer.
let _bannerIdx   = 0;
let _bannerTimer = null;
function _applyBannerIdx() {
  document.querySelectorAll('.side-banner').forEach(function(banner) {
    const slides = banner.querySelectorAll('.banner-slide');
    if (!slides.length) return;
    slides.forEach(function(s) { s.classList.remove('active'); });
    const i = ((_bannerIdx % slides.length) + slides.length) % slides.length;
    slides[i].classList.add('active');
  });
}
function bannerNext()     { _bannerIdx++; _applyBannerIdx(); _restartBannerTimer(); }
function bannerPrevious() { _bannerIdx--; _applyBannerIdx(); _restartBannerTimer(); }
function _restartBannerTimer() {
  clearInterval(_bannerTimer);
  _bannerTimer = setInterval(bannerNext, 3000);
}

// Measures the actual empty space beside the centered category grid and
// resizes/shows or hides the banners to fit it — adapts to whatever the
// visitor's screen actually is, instead of a fixed pixel breakpoint that goes
// stale (and can hide the banners entirely) every time the banner width changes.
function _sizeSideBanners() {
  const container = document.querySelector('#categories > .container');
  const slots = document.querySelectorAll('.side-banner-slot');
  if (!container || !slots.length) return;
  // Measure the natural gutter first (reset any shrink from a previous run)
  container.style.maxWidth = '';
  const naturalW  = container.offsetWidth;
  let available = (window.innerWidth - naturalW) / 2 - 24 - 12; // edge offset + breathing room
  const TARGET = 560; // wanted banner width
  // If the free gutter is too narrow, narrow the category grid a little
  // (up to 150px per side) to give the banners more room
  if (available < TARGET) {
    const steal = Math.min(TARGET - available, 150);
    const shrunkW = naturalW - steal * 2;
    if (shrunkW >= 760) {
      container.style.maxWidth = shrunkW + 'px';
      available += steal;
    }
  }
  if (available < 150) {
    container.style.maxWidth = '';
    slots.forEach(function(s) { s.style.display = 'none'; });
    return;
  }
  const width = Math.min(TARGET, Math.round(available));
  slots.forEach(function(s) { s.style.display = 'block'; s.style.width = width + 'px'; });
}
window.addEventListener('resize', function() {
  clearTimeout(window._bannerResizeT);
  window._bannerResizeT = setTimeout(_sizeSideBanners, 200);
});

function initSideBanners() {
  const leftEl  = document.getElementById('bannerLeft');
  const rightEl = document.getElementById('bannerRight');
  if (!leftEl || !rightEl) return;
  const source = (_sbBanners && _sbBanners.length)
    ? _sbBanners.map(function(b) { return { brand: b.brand, img: b.img_url }; })
    : DEFAULT_BANNERS;
  const split = _splitBanners(source);
  _bannerIdx = 0;
  _renderBannerSlides(leftEl,  split.left.length  ? split.left  : DEFAULT_BANNERS);
  _renderBannerSlides(rightEl, split.right.length ? split.right : DEFAULT_BANNERS);
  _applyBannerIdx();
  _restartBannerTimer();
  _sizeSideBanners();
}
initSideBanners();

function jumpCat(cat) {
  activeFilter = cat;
  syncCatNav(cat);
  document.getElementById('searchInput').value = '';
  renderProducts();
  scrollToProducts();
}

function filterProducts(category) {
  activeFilter = category;
  syncCatNav(category);
  document.getElementById('searchInput').value = '';
  renderProducts();
  scrollToProducts();
}
// ── STOCK HELPERS ─────────────────────────────────────────────────────────
function getLiveStock(productId) {
  const qty = _sbStock[productId];
  if (qty === undefined) return null;
  return qty === 0 ? 'out-of-stock' : qty <= 10 ? 'low-stock' : 'in-stock';
}
function getLiveQty(productId) {
  return _sbStock[productId] !== undefined ? _sbStock[productId] : null;
}
async function deductStock(cartItems) {
  // Update local cache first so UI reflects immediately
  cartItems.forEach(item => {
    const cur = _sbStock[item.id] !== undefined ? _sbStock[item.id] : 50;
    _sbStock[item.id] = Math.max(0, cur - item.qty);
  });
  // Push to Supabase so admin sees real numbers
  const rows = cartItems.map(item => ({ product_id: item.id, qty: _sbStock[item.id] }));
  const { error } = await sbFetch(SB_URL + '/rest/v1/expert_stock', {
    method: 'POST',
    headers: { ...SB_H, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(rows)
  });
  if (error) localStorage.setItem('jain_stock', JSON.stringify(_sbStock));
}

// ── SMART SEARCH ─────────────────────────────────────────────────────────────
// Arabic names for all products so searching in Arabic works
const ARABIC_NAMES = {
  // Shataffa / شطافة
  1:'شطافة ستانلس ستيل', 2:'طقم شطافة جداري', 3:'بيديه سبراي ثنائي',
  4:'مقعد بيديه', 5:'خرطوم شطافة مضفر', 6:'زاوية مع قاطع تي',
  7:'شطافة نيكل مصقول', 8:'حامل شطافة كروم', 9:'طقم خلاط بيديه',
  10:'صمام عدم رجوع',
  // Toilet Seats / مقعد المرحاض
  11:'مقعد مرحاض أبيض', 12:'مقعد مرحاض ناعم', 13:'مقعد مرحاض رفيع',
  14:'مقعد دي شيب ناعم', 15:'مقعد تدريب أطفال', 16:'مقعد سريع الفك',
  17:'مقعد مرحاض ممتد', 18:'مقعد مضاد للبكتيريا',
  // Lighting / إضاءة
  19:'لمبة ليد دافئة', 20:'لمبة ليد نهارية', 21:'لمبة ليد صغيرة',
  22:'سبوت ليد', 23:'داون لايت ليد', 24:'شريط ليد',
  25:'لوح ليد', 26:'أنبوب ليد', 27:'لمبة ليد ذكية', 28:'لمبة خارجية',
  // Taps / صنبور وخلاط
  29:'خلاط حوض كروم', 30:'خلاط مطبخ', 31:'صنبور سحب',
  32:'خلاط حمام وشاور', 33:'صنبور ساخن وبارد', 34:'خلاط حوض جداري',
  35:'شاور ثيرموستاتي', 36:'فلتر صنبور', 37:'صمام إيقاف',
  38:'خلاط أحادي طويل',
  // Plumbing / سباكة
  39:'أنبوب ضغط', 40:'أنبوب ماء ساخن', 41:'خرطوم مرن 40',
  42:'خرطوم مرن 60', 43:'تفلون', 44:'كوع 90',
  45:'صمام كروي نحاس', 46:'سيفون', 47:'سيليكون صحي', 48:'سلك تسليك',
  // Bathroom / حمام
  49:'حلقة مناشف', 50:'حامل ورق تواليت', 51:'بار مناشف مزدوج',
  52:'موزع صابون جداري', 53:'مرآة حمام', 54:'ستارة حمام',
  55:'رف زاوية شاور', 56:'خطاف معطف مزدوج',
  // Sanitaryware / أدوات صحية
  57:'حوض معلق', 58:'حوض بيدستال', 59:'طقم مرحاض', 60:'إطار سيسترن مخفي'
};

// normalizeQ — cleans up a search string so small differences don't block results:
//   • lowercases everything
//   • removes hyphens / punctuation (so "d-cup" = "d cup")
//   • collapses repeated letters (so "shattaffa" = "shatafa")
//   • collapses whitespace
function normalizeQ(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[-_''".،,،؛;:!؟?/\\()\[\]]/g, ' ') // punctuation → space
    .replace(/(.)\1+/gi, '$1')                    // "tt" → "t", "aa" → "a"
    .replace(/\s+/g, ' ')
    .trim();
}

// matchesSearch — returns true if a product matches the search query
// Splits the query into words and checks that EVERY word appears somewhere
// in the product name, description, category, or Arabic name.
function matchesSearch(query, p) {
  if (!query) return true;
  const normQ    = normalizeQ(query);
  const words    = normQ.split(' ').filter(w => w.length > 0);
  const haystack = normalizeQ(p.name) + ' ' +
                   normalizeQ(p.desc || '') + ' ' +
                   normalizeQ(p.category || '') + ' ' +
                   (ARABIC_NAMES[p.id] || '');
  return words.every(w => haystack.includes(w));
}

// ── RENDER PRODUCTS ───────────────────────────────────────────────────────
function renderProducts() {
  const query = document.getElementById('searchInput').value.trim();
  const grid  = document.getElementById('productsGrid');
  const empty = document.getElementById('productsEmpty');
  const filtered = getAllProducts().filter(p => {
    const matchCat    = activeFilter === 'all' || p.category === activeFilter || getMultiCats(p.id).includes(activeFilter);
    const matchSearch = matchesSearch(query, p);
    return matchCat && matchSearch;
  });
  if (!filtered.length) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  // Best Sellers always first, then other badged items, then the rest
  const badgeOrder = { 'Best Seller': 0, 'Popular': 1, 'Pro': 2, 'New': 3, 'Sale': 4 };
  filtered.sort((a, b) => {
    const aRank = a.badge !== null && a.badge !== undefined ? (badgeOrder[a.badge] !== undefined ? badgeOrder[a.badge] : 5) : 99;
    const bRank = b.badge !== null && b.badge !== undefined ? (badgeOrder[b.badge] !== undefined ? badgeOrder[b.badge] : 5) : 99;
    return aRank - bRank;
  });
  // Track search appearances (debounced so only fires when user stops typing)
  if (query && filtered.length) {
    clearTimeout(window._searchTimer);
    window._searchTimer = setTimeout(function() {
      trackSearch(filtered.map(function(p) { return p.id; }));
      trackSearchText(query);
    }, 700);
  }

  // custom photos set by admin (loaded from Supabase)
  const customPhotos = _sbPhotos;

  const isAr = _lang === 'ar';
  grid.innerHTML = filtered.map(p => {
    const liveStatus = getLiveStock(p.id) || p.stock;
    const liveQty    = getLiveQty(p.id);
    const isOut      = liveStatus === 'out-of-stock';
    const isLow      = liveStatus === 'low-stock';
    // Use custom admin photo only if it's a valid http/https URL or data URL — not a broken local path
    const rawCustom  = customPhotos[p.id];
    const photo      = (rawCustom && (rawCustom.startsWith('http') || rawCustom.startsWith('data:'))) ? rawCustom : p.img;
    // Arabic product name/desc
    const arP = isAr && _AR_PRODUCTS[p.id];
    const pName = arP ? arP.name : p.name;
    const pDesc = arP ? arP.desc : p.desc;
    const pCat  = isAr ? (_AR_CATS[p.category] || p.category.replace('-',' ')) : p.category.replace('-',' ');
    let stockLabel, stockClass;
    if (isOut)      { stockLabel = isAr ? '&#10006; غير متوفر'  : '&#10006; Out of Stock';  stockClass = 'out-of-stock'; }
    else if (isLow) { stockLabel = (isAr ? '&#9888; كمية محدودة' : '&#9888; Low Stock') + (liveQty !== null ? ' (' + liveQty + (isAr ? ' متبقي)' : ' left)') : ''); stockClass = 'low-stock'; }
    else            { stockLabel = (isAr ? '&#10003; متوفر'      : '&#10003; In Stock')  + (liveQty !== null ? ' (' + liveQty + ')' : ''); stockClass = 'in-stock'; }
    const addBtn   = isAr ? 'أضف' : 'Add';
    const unavail  = isAr ? 'غير متاح' : 'Unavailable';
    return `
      <div class="product-card ${isOut ? 'card-out' : ''}" onclick="openProduct(${p.id})">
        <div class="product-img-wrap">
          ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}
          ${isOut ? `<span class="out-badge">${isAr ? 'نفد المخزون' : 'OUT OF STOCK'}</span>` : ''}
          <button class="card-wl-btn ${isWishlisted(p.id)?'wishlisted':''}" onclick="toggleWishlist(${p.id}, event)" title="${isWishlisted(p.id)?'Remove from wishlist':'Save to wishlist'}"><i class="fa fa-heart"></i></button>
          <img src="${photo}" data-local="${p.img}" alt="${pName}" loading="lazy" onerror="imgError(this)" />
          <div class="product-img-fallback" style="display:none"><i class="fa fa-tools"></i></div>
        </div>
        <div class="product-info">
          <div class="product-cat">${pCat}</div>
          <div style="font-size:10px;font-weight:700;color:#aaa;letter-spacing:0.5px;margin-bottom:3px">${getProductSku(p.id)}</div>
          <h3>${pName}</h3>
          <p>${pDesc}</p>
          <div class="product-footer">
            <div>
              <div class="product-price">${p.price.toFixed(3)} <small>KWD</small></div>
              <div class="stock-badge ${stockClass}">${stockLabel}</div>
            </div>
            ${isOut
              ? `<button class="btn-add btn-disabled" disabled onclick="event.stopPropagation()">${unavail}</button>`
              : `<button class="btn-add" onclick="event.stopPropagation();addToCart(${p.id}, this)"><i class="fa fa-plus"></i> ${addBtn}</button>`}
          </div>
        </div>
      </div>`;
  }).join('');
}

