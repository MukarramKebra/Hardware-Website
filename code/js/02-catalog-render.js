// ── MULTI-CATEGORY HELPER (storefront) ────────────────────────────────────
// Returns array of extra category slugs assigned to a product via the admin
// multi-category picker. Loaded from Supabase (expert_settings 'multi_cats',
// see loadSBData) so every visitor sees the assignments; localStorage is only
// a fallback for assignments made before the cloud sync existed.
function getMultiCats(id) {
  if (window._sbMultiCats && Array.isArray(window._sbMultiCats[String(id)])) return window._sbMultiCats[String(id)];
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
    // Step 3: give up, show placeholder icon. Also stop the skeleton shimmer
    // (see css/02-sections.css) — nothing's ever going to load now, and the
    // opaque fallback icon covers it visually anyway, but no reason to leave
    // a CSS animation running forever on a card that gave up.
    el.style.display = 'none';
    if (el.nextElementSibling) el.nextElementSibling.style.display = 'flex';
    if (el.parentElement) el.parentElement.classList.add('img-ready');
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

// ── SEO PRODUCT-PAGE SLUGS ────────────────────────────────────────────────
// Mirrors slugify()/productSlug() in scripts/generate-product-pages.js EXACTLY
// so each card links to the static file that script writes at
// /product/<slug>.html. Keep the two in sync if either changes.
function seoSlugify(s) {
  return String(s == null ? '' : s)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80)
    .replace(/-+$/, '');
}
function productSlug(p) {
  return (seoSlugify(p.name) || 'product') + '-' + p.id;
}

// ── CATEGORY RENAMES (from admin's category editor) ────────────────────────
// Patches the static category pill/tile text already in the page instead of
// generating that markup from JS — the labels only change when an admin
// actually renames something, so a page-load patch is simpler than making
// the whole category nav data-driven for a rename that may never happen.
function applyCatLabelOverrides(labels) {
  window._sbCatLabels = labels || {};
  if (!labels) return;
  Object.keys(labels).forEach(function(slug) {
    var label = labels[slug];
    var pill = document.querySelector('.pill[data-filter="' + slug + '"]');
    if (pill) pill.textContent = label;
    var card = document.querySelector('.cat-card[data-cat="' + slug + '"] h3');
    if (card) card.textContent = label;
  });
}
// Display name for a category slug — the admin's custom rename (e.g.
// "marhaba" -> "Generators") if one's been set, else the slug title-cased.
// Anywhere a category name is shown outside the pill/tile nav itself (which
// applyCatLabelOverrides patches directly) needs to go through this instead
// of stringifying the raw slug, or a rename never reaches it.
function catLabel(slug) {
  if (window._sbCatLabels && window._sbCatLabels[slug]) return window._sbCatLabels[slug];
  return (slug || '').replace(/-/g, ' ');
}

// Per-category Hide/Show toggle from the admin's category editor — same
// idea as applyCatLabelOverrides above, just hiding the pill/tile instead
// of relabeling it. If someone's mid-browse on a category that gets hidden
// out from under them (rare — this only changes on a page load), fall back
// to "all" rather than leaving them on a dead filter with no way back to it.
function applyCatVisibilityOverrides(hidden) {
  if (!hidden) return;
  var fellBackFromActive = false;
  // hidden[slug] is true (nav pill/tile only) or 'all' (nav + every product
  // in it — see _catFullyHiddenSlugs, checked by getAllProducts() in
  // code/js/01-config-data.js).
  _catFullyHiddenSlugs = new Set(Object.keys(hidden).filter(function(slug) { return hidden[slug] === 'all'; }));
  if (_catFullyHiddenSlugs.size) _invalidateAllProductsCache();
  Object.keys(hidden).forEach(function(slug) {
    if (!hidden[slug]) return;
    var pill = document.querySelector('.pill[data-filter="' + slug + '"]');
    if (pill) pill.style.display = 'none';
    var card = document.querySelector('.cat-card[data-cat="' + slug + '"]');
    if (card) card.style.display = 'none';
    if (activeFilter === slug) fellBackFromActive = true;
  });
  if (fellBackFromActive) { activeFilter = 'all'; syncCatNav('all'); renderProducts(); }
}

// Drag-reordering in the admin's category editor only ever touched that
// admin grid's own markup — the storefront pill row / category grid are
// static HTML, so a reorder saved there never actually moved anything a
// customer sees. Reorders the real DOM nodes here to match the saved
// order; anything not in the saved list (a brand-new category, or "all"
// if it was never part of the drag-and-drop set) keeps its current
// position relative to the others rather than jumping somewhere unexpected.
function applyCatOrderOverride(order) {
  if (!order || !order.length) return;
  function reorder(container, selector, attr) {
    if (!container) return;
    var els = Array.from(container.children);
    var bySlug = {};
    els.forEach(function(el) { bySlug[el.getAttribute(attr)] = el; });
    var ordered = order.map(function(slug) { return bySlug[slug]; }).filter(Boolean);
    var leftover = els.filter(function(el) { return order.indexOf(el.getAttribute(attr)) === -1; });
    ordered.concat(leftover).forEach(function(el) { container.appendChild(el); });
  }
  reorder(document.getElementById('categoriesGrid'), '.cat-card', 'data-cat');
  reorder(document.querySelector('.filter-pills'), '.pill', 'data-filter');
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
  // 'auto' isn't actually instant here — html has scroll-behavior:smooth in
  // CSS, and per spec 'auto' just defers to that. 'instant' is the only
  // value that bypasses CSS and truly snaps with zero animation.
  window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
}

// ── OFFERS CAROUSEL ───────────────────────────────────────────────────────
// Moving row of real featured products (admin-picked, see admin's Featured
// tab — expert_settings key 'featured_offers', a JSON array of
// { id, sale } (no limit) in display order; 'sale' is an optional % off
// shown only in this strip — the product's real price elsewhere is
// untouched). Called from loadSBData() once product/photo data is
// available; hides the whole section if the admin hasn't picked anything.
function initOffersTicker() {
  const track   = document.getElementById('offersTrack');
  const section = document.getElementById('offers');
  if (!track || !section) return;
  const items = Array.isArray(window._sbFeaturedOffers) ? window._sbFeaturedOffers : [];
  const all   = getAllProducts();
  const offers = items.map(item => {
    const p = all.find(x => x.id === item.id);
    // Can't Find Products is unverified/unconfirmed catalog data — never
    // belongs in the homepage strip even if it's still sitting in a saved
    // featured_offers list from before this category existed (the admin
    // picker itself excludes it now too, see _foFilteredList).
    return (p && p.category !== 'cant-find-products') ? { p, sale: item.sale || 0 } : null;
  }).filter(Boolean);
  if (!offers.length) { section.style.display = 'none'; return; }
  section.style.display = '';
  // Products with an active sale show first — Array.sort is stable, so
  // otherwise ties keep the admin's original picked order within each group.
  offers.sort((a, b) => {
    const aSale = a.sale > 0 && a.p.price > 0 && !window._sbPriceHidden[a.p.id];
    const bSale = b.sale > 0 && b.p.price > 0 && !window._sbPriceHidden[b.p.id];
    return (bSale ? 1 : 0) - (aSale ? 1 : 0);
  });
  // Hard cap on how many cards the ticker ever builds. `featured_offers`
  // currently holds hundreds of products (see admin's Featured tab), and
  // this strip gets duplicated several times over for the seamless CSS
  // loop below — without a cap that was rendering 2000+ <img> tags into
  // the DOM (up to 4x every "featured" product), which is what made the
  // homepage so slow to load, especially on mobile. 40 is already far more
  // variety than anyone scrolls a marquee to see.
  const TICKER_MAX = 40;
  if (offers.length > TICKER_MAX) offers.length = TICKER_MAX;
  const customPhotos = _sbPhotos || {};
  const cards = offers.map(({ p, sale }) => {
    const raw   = customPhotos[p.id];
    const photo = (raw && (raw.startsWith('http') || raw.startsWith('data:'))) ? raw : p.img;
    const priceHidden = !!window._sbPriceHidden[p.id];
    const hasSale = sale > 0 && p.price > 0 && !priceHidden;
    const offerPrice = hasSale ? p.price * (1 - sale / 100) : p.price;
    const sub = (p.price > 0 && !priceHidden)
      ? (hasSale
          ? `<span class="offer-price-now">${offerPrice.toFixed(3)} KWD</span> <span class="offer-price-was">${p.price.toFixed(3)} KWD</span>`
          : `${p.price.toFixed(3)} KWD`)
      : catLabel(p.category);
    const tag = hasSale ? `-${sale}%` : p.badge;
    return `
    <div class="offer-card" onclick="openProduct(${p.id})">
      <div class="offer-card-img">
        ${tag ? `<span class="offer-tag${hasSale ? ' offer-tag-sale' : ''}">${tag}</span>` : ''}
        <img src="${photo}" alt="${p.name}" loading="lazy" onerror="imgError(this)" onload="this.parentElement.classList.add('img-ready')"/>
      </div>
      <div class="offer-card-info">
        <div class="offer-title">${p.name}</div>
        <div class="offer-sub">${sub}</div>
      </div>
    </div>`;
  }).join('');
  // Cached (un-duplicated, one copy) so the very first paint on the NEXT
  // visit can fill the ticker synchronously — see the inline script right
  // after #offersTrack in index.html — instead of waiting on even the fast
  // targeted fetch this function is normally reached through. Still real
  // network-dependent data underneath; this just means a returning visitor
  // never sees the ticker load in at all, only ever already there.
  try { localStorage.setItem('offers_ticker_cache', cards); } catch (e) {}
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
  { brand: 'iTrust', img: 'Banners/itrust4.jpg' },
  { brand: 'BIG RED', img: 'Banners/bigred1.jpg' },
  { brand: 'BIG RED', img: 'Banners/bigred2.jpg' }
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
// Banners pinned to a side in the admin's Banners editor (window._sbBannerSides,
// id -> 'left'|'right') go straight to that side; everything else still runs
// through the automatic brand-interleave split below, same as before pins
// existed.
function _splitBanners(list) {
  const sides = window._sbBannerSides || {};
  const pinnedLeft = [], pinnedRight = [], unpinned = [];
  list.forEach(function(b) {
    const s = b.id != null ? sides[b.id] : null;
    if (s === 'left') pinnedLeft.push(b);
    else if (s === 'right') pinnedRight.push(b);
    else unpinned.push(b);
  });
  const seq = _interleaveByBrand(unpinned);
  const autoLeft = [], autoRight = [];
  seq.forEach(function(b, i) { (i % 2 === 0 ? autoLeft : autoRight).push(b); });
  return { left: pinnedLeft.concat(autoLeft), right: pinnedRight.concat(autoRight) };
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
  '<button class="banner-nav-btn banner-nav-up" onclick="event.stopPropagation();bannerNext()" title="Next" aria-label="Next banner"><i class="fa fa-chevron-up"></i></button>' +
  '<button class="banner-nav-btn banner-nav-down" onclick="event.stopPropagation();bannerPrevious()" title="Previous" aria-label="Previous banner"><i class="fa fa-chevron-down"></i></button>';
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
  // Banner images are all ~9:16 portrait (measured across the actual files).
  // Size the box to that ratio (instead of stretching it to the section's
  // full height) so it hugs the image with no leftover space, capped to the
  // section's own height so it can never overflow past it.
  const IMG_RATIO  = 1024 / 572; // height / width
  const maxHeight  = document.getElementById('categories').offsetHeight;
  const height     = Math.min(Math.round(width * IMG_RATIO), maxHeight);
  slots.forEach(function(s) {
    s.style.display    = 'block';
    s.style.width      = width + 'px';
    s.style.height     = height + 'px';
    s.style.marginTop  = -(height / 2) + 'px';
  });
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
    ? _sbBanners.map(function(b) { return { id: b.id, brand: b.brand, img: b.img_url }; })
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
  activeSubFilter = 'all';
  syncCatNav(cat);
  document.getElementById('searchInput').value = '';
  _switchCategoryWithLoading();
}

function filterProducts(category) {
  activeFilter = category;
  activeSubFilter = 'all';
  syncCatNav(category);
  document.getElementById('searchInput').value = '';
  _switchCategoryWithLoading();
}

// Header logo click. #header is position:fixed, so a plain href="#header"
// anchor jump does nothing reliable — a fixed element has no real position
// in document flow for the browser to scroll to, so clicking the logo
// looked broken (URL changed to #header, page didn't move) rather than
// acting like a "go home" link. Resets to the All-products view (same as
// clicking the "All Products" tile) and scrolls to the very top, timed to
// run after _switchCategoryWithLoading()'s own scrollToProducts() so this
// wins instead of landing back in the products grid.
function goHome(e) {
  if (e) e.preventDefault();
  filterProducts('all');
  setTimeout(function() { window.scrollTo({ top: 0, behavior: 'instant' }); }, 60);
}

// subcatLabel — display name for a subcategory slug. Falls back to a
// title-cased version of the slug so a new subcategory shows up sensibly
// in the UI even before someone adds it to _SUBCAT_LABELS/_AR_SUBCATS.
function subcatLabel(slug) {
  var map = (_lang === 'ar') ? _AR_SUBCATS : _SUBCAT_LABELS;
  if (map[slug]) return map[slug];
  return slug.replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
}

function selectSubFilter(sub) {
  // Clicking the already-active tile deselects it (back to "all" within
  // this category) — there's no separate "All" tile in the grid itself.
  activeSubFilter = (activeSubFilter === sub) ? 'all' : sub;
  renderProducts();
  scrollToProducts();
}

// renderSubFilters — builds the subcategory picker (image tile per
// subcategory, like expertshardware.com's own "Nails / Tarpaulin & Meshes /
// Wires & Electrodes / Safety Gloves" grid) for whichever subcategories exist
// within the active main category. Fully data-driven off
// expert_products.subcategory, so tagging more products/categories later
// (see admin) makes the row appear automatically, no UI code changes needed.
// Each tile's photo is a real product from that subcategory — the first one
// that actually has a photo uploaded — not a stock/generic image; a tile
// falls back to the same neutral tools icon the product grid uses when none
// of its products have a photo yet.
function renderSubFilters() {
  const container = document.getElementById('subFilterPills');
  if (!container) return;
  if (activeFilter === 'all') {
    container.classList.remove('show');
    container.innerHTML = '';
    return;
  }
  const inCat = getAllProducts().filter(p => p.category === activeFilter && p.subcategory);
  // Require at least 3 products before a subcategory earns its own tile —
  // a handful of odd stragglers tagged into the "wrong" main category
  // (this catalog was assembled from several import batches, not one
  // consistent taxonomy) would otherwise show up as near-empty tiles.
  const counts = {};
  inCat.forEach(function(p) { counts[p.subcategory] = (counts[p.subcategory] || 0) + 1; });
  const subs = Object.keys(counts).filter(function(s) { return counts[s] >= 3; }).sort();
  if (!subs.length) {
    container.classList.remove('show');
    container.innerHTML = '';
    return;
  }
  const customPhotos = _sbPhotos;
  function tilePhoto(sub) {
    const withPhoto = inCat.find(function(p) {
      if (p.subcategory !== sub) return false;
      const rawCustom = customPhotos[p.id];
      const photo = (rawCustom && (rawCustom.startsWith('http') || rawCustom.startsWith('data:'))) ? rawCustom : p.img;
      return !!photo;
    });
    if (!withPhoto) return null;
    const rawCustom = customPhotos[withPhoto.id];
    return (rawCustom && (rawCustom.startsWith('http') || rawCustom.startsWith('data:'))) ? rawCustom : withPhoto.img;
  }
  container.classList.add('show');
  container.innerHTML =
    '<div class="subcat-label"><i class="fa fa-chevron-down"></i>' + (_lang === 'ar' ? 'الفئة' : 'Category') + '</div>' +
    '<div class="subcat-tiles">' +
    subs.map(function(s) {
      const photo = tilePhoto(s);
      const img = photo
        ? '<img src="' + photo + '" alt="' + subcatLabel(s) + '" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" /><i class="fa fa-tools" style="display:none"></i>'
        : '<i class="fa fa-tools"></i>';
      return '<button class="subcat-tile' + (activeSubFilter === s ? ' active' : '') + '" onclick="selectSubFilter(\'' + s + '\')">' +
        '<div class="subcat-tile-img">' + img + '</div>' +
        '<div class="subcat-tile-label">' + subcatLabel(s) + '</div>' +
      '</button>';
    }).join('') +
    '</div>';
}

// Covers the screen with a brief loading flash BEFORE touching the grid or
// scroll position — the products render and the jump to #products both
// happen while hidden behind the overlay, so what the visitor sees is
// "click → brief load → already looking at the right section", never a
// visible scroll or a flash of the old category's products.
// The 500ms wait here used to be doing real work — getAllProducts()
// rebuilt the entire 1577+ product catalog from scratch on every category
// click (see getAllProducts() in js/01-config-data.js), which could
// genuinely take a while on a phone. Now that it's cached, renderProducts()
// below finishes in a few milliseconds, so holding the overlay up for a
// fixed 500ms was pure wasted waiting, not disguising anything — that's
// what made every category feel slow to open. 50ms is just enough for the
// overlay's own .18s opacity transition to visibly start (avoiding a hard
// instant cut), not an artificial delay on top of real work.
let _catLoadTimer = null;
function _switchCategoryWithLoading() {
  clearTimeout(_catLoadTimer);
  const overlay = document.getElementById('catLoadOverlay');
  if (overlay) overlay.classList.add('show');
  _catLoadTimer = setTimeout(function() {
    renderProducts();
    scrollToProducts();
    if (overlay) overlay.classList.remove('show');
  }, 50);
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
  // Push to Supabase via decrement_stock — a narrow RPC that only ever
  // subtracts (never sets an arbitrary value), so a checkout from a real
  // customer can stay callable with just the public key even once direct
  // writes to expert_stock are locked down to admins. Server-side
  // subtraction also avoids a race between two simultaneous buyers that a
  // client-computed absolute value would be vulnerable to.
  const results = await Promise.all(cartItems.map(item => sbFetch(SB_URL + '/rest/v1/rpc/decrement_stock', {
    method: 'POST',
    headers: { ...SB_H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_product_id: item.id, p_qty: item.qty })
  })));
  if (results.some(r => r.error)) localStorage.setItem('jain_stock', JSON.stringify(_sbStock));
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
                   normalizeQ(p.subcategory || '') + ' ' +
                   normalizeQ(p.brand || '') + ' ' +
                   normalizeQ(_sbProductKeywords[p.id] || '') + ' ' +
                   (ARABIC_NAMES[p.id] || '');
  return words.every(w => haystack.includes(w));
}

// ── "DID YOU MEAN" SEARCH SUGGESTIONS ─────────────────────────────────────
// When a search finds nothing, suggest the closest real spelling — e.g.
// "drimel" → Did you mean "dremel"? Each query word is compared (edit
// distance) against every word that actually appears in product names,
// brands, categories and keywords, and the whole corrected query is only
// offered if it genuinely returns results.
function _levenshtein(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  var prev = [], cur = [];
  for (var j = 0; j <= b.length; j++) prev[j] = j;
  for (var i = 1; i <= a.length; i++) {
    cur[0] = i;
    var rowMin = i;
    for (var k = 1; k <= b.length; k++) {
      cur[k] = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + (a[i - 1] === b[k - 1] ? 0 : 1));
      if (cur[k] < rowMin) rowMin = cur[k];
    }
    if (rowMin > max) return max + 1; // no path can recover — stop early
    var t = prev; prev = cur; cur = t;
  }
  return prev[b.length];
}

// normalized word -> original display spelling, built from the live catalog
var _vocabCache = null, _vocabCacheCount = 0;
function _searchVocab() {
  var products = getAllProducts();
  if (_vocabCache && _vocabCacheCount === products.length) return _vocabCache;
  var vocab = {};
  function addWords(text) {
    String(text || '').split(/[\s\/,()+×x-]+/).forEach(function(w) {
      var display = w.trim();
      if (display.length < 3 || /^[\d.]+$/.test(display)) return;
      var norm = normalizeQ(display);
      if (norm.length >= 3 && !vocab[norm]) vocab[norm] = display.toLowerCase();
    });
  }
  products.forEach(function(p) {
    addWords(p.name);
    addWords(p.brand);
    addWords((p.category || '').replace(/-/g, ' '));
    addWords(_sbProductKeywords[p.id]);
    addWords(ARABIC_NAMES[p.id]);
  });
  _vocabCache = vocab; _vocabCacheCount = products.length;
  return vocab;
}

function _didYouMean(query) {
  var vocab = _searchVocab();
  var changed = false;
  var corrected = normalizeQ(query).split(' ').map(function(word) {
    if (word.length < 3 || vocab[word]) return word; // fine as-is
    var maxDist = word.length <= 4 ? 1 : word.length <= 7 ? 2 : 3;
    var best = null, bestDist = maxDist + 1;
    for (var norm in vocab) {
      var d = _levenshtein(word, norm, maxDist);
      if (d < bestDist) { bestDist = d; best = vocab[norm]; }
    }
    if (best) { changed = true; return best; }
    return word;
  }).join(' ');
  if (!changed) return null;
  // only suggest spellings that actually find something
  var hits = getAllProducts().filter(function(p) { return matchesSearch(corrected, p); }).length;
  return hits > 0 ? corrected : null;
}

function applySearchSuggestion(q) {
  var input = document.getElementById('searchInput');
  input.value = q;
  renderProducts();
  input.focus();
}

// ── RENDER PRODUCTS ───────────────────────────────────────────────────────
// Injects/updates a Product ItemList structured-data block so Google can
// understand and potentially show rich results for the actual catalog —
// rebuilt from the real live product/brand/SKU data each time it loads
// (see loadSBData) rather than being a static, easily-stale snapshot.
function _injectProductSchema() {
  const products = getAllProducts();
  if (!products.length) return;
  // Offer prices are always current (fetched live from Supabase), so a
  // far-future validity date is the standard convention for a perpetual
  // catalog rather than a real expiry — set once per page load.
  const priceValidUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const reviewStats = window._sbReviewStats || {};
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'itemListElement': products.map(function(p, i) {
      const photo = (_sbPhotos[p.id] && (_sbPhotos[p.id].startsWith('http') || _sbPhotos[p.id].startsWith('data:'))) ? _sbPhotos[p.id] : p.img;
      const liveStatus = getLiveStock(p.id) || p.stock;
      const rs = reviewStats[p.id];
      return {
        '@type': 'ListItem',
        'position': i + 1,
        'item': {
          '@type': 'Product',
          'name': p.name,
          'description': p.desc || undefined,
          'sku': getProductSku(p.id).replace(/^SKU[-:]\s*/, ''),
          // "Generic" is the admin's marker for unbranded commodity items
          // (bolts, gloves, mesh...) — omit the field entirely rather than
          // telling Google the brand is literally "Generic"
          'brand': (p.brand && p.brand !== 'Generic') ? { '@type': 'Brand', 'name': p.brand } : undefined,
          'category': p.category,
          'keywords': _sbProductKeywords[p.id] || undefined,
          'image': (photo && photo.startsWith('http')) ? photo : undefined,
          // Real customer ratings only — omitted entirely when a product has
          // no reviews yet, never a fabricated/default rating.
          'aggregateRating': (rs && rs.count > 0) ? {
            '@type': 'AggregateRating',
            'ratingValue': Math.round(rs.avg * 10) / 10,
            'reviewCount': rs.count
          } : undefined,
          'offers': {
            '@type': 'Offer',
            'priceCurrency': 'KWD',
            'price': p.price,
            'priceValidUntil': priceValidUntil,
            'itemCondition': 'https://schema.org/NewCondition',
            'availability': liveStatus === 'out-of-stock' ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock'
          }
        }
      };
    })
  };
  let tag = document.getElementById('productListSchema');
  if (!tag) {
    tag = document.createElement('script');
    tag.type = 'application/ld+json';
    tag.id = 'productListSchema';
    document.head.appendChild(tag);
  }
  tag.textContent = JSON.stringify(itemList);
}

// Card-level size/pack picker — mirrors the product popup's own
// _pmCurrentPrice/pmVariantChange, but scoped to one grid card instead of
// the modal, so a shopper can pick an option without leaving the grid.
function _cardRawPrice(p, idx) {
  const opts = getVariants(p.id);
  if (!opts.length) return p.price;
  const v = opts[idx || 0] || opts[0];
  return (v.price > 0) ? v.price : p.price;
}
function _cardVariantPrice(p, idx) {
  return applySale(_cardRawPrice(p, idx), p.id);
}
// Shared by the card's initial render and cardVariantChange so both show the
// exact same "was/now" markup when a Featured Sale % is active.
function _priceHtml(rawPrice, id) {
  const sale = getFeaturedSale(id);
  if (sale > 0 && rawPrice > 0 && !window._sbPriceHidden[id]) {
    const now = rawPrice * (1 - sale / 100);
    return '<span class="prod-price-now">' + now.toFixed(3) + '</span> <span class="prod-price-was">' + rawPrice.toFixed(3) + '</span> <small>KWD</small>';
  }
  return rawPrice.toFixed(3) + ' <small>KWD</small>';
}
function cardVariantChange(id, sel) {
  const p = getAllProducts().find(x => x.id === id);
  if (!p) return;
  const idx = parseInt(sel.value, 10) || 0;
  const priceEl = document.getElementById('cardPrice' + id);
  if (priceEl) priceEl.innerHTML = _priceHtml(_cardRawPrice(p, idx), id);
  const skuEl = document.getElementById('cardSku' + id);
  if (skuEl) skuEl.textContent = _variantSku(getVariants(id)[idx], id);
}

// ── SORT ─────────────────────────────────────────────────────────────────
// 'recommended' keeps the existing badge-priority order (see below); every
// other mode replaces it entirely rather than being layered on top, since
// "recommended, but ALSO price order" isn't a coherent single sort.
let currentSort = 'recommended';
function onSortChange(mode) {
  currentSort = mode;
  renderProducts();
}
function _sortProducts(list, mode) {
  if (mode === 'price-asc' || mode === 'price-desc') {
    list.sort((a, b) => {
      // Price-hidden ("Ask on WhatsApp") items have no real price to compare
      // — push them to the end regardless of direction rather than letting
      // them collapse to 0 and jump to the front of a "low to high" sort.
      const aHidden = !(a.price > 0) || !!window._sbPriceHidden[a.id];
      const bHidden = !(b.price > 0) || !!window._sbPriceHidden[b.id];
      if (aHidden && bHidden) return 0;
      if (aHidden) return 1;
      if (bHidden) return -1;
      const aPrice = applySale(a.price, a.id);
      const bPrice = applySale(b.price, b.id);
      return mode === 'price-asc' ? aPrice - bPrice : bPrice - aPrice;
    });
  } else if (mode === 'newest') {
    // No reliable "date added" on the baked-in catalog half of the products,
    // but ids were assigned in strictly increasing order as products were
    // added (both the original seed and every later admin/CSV batch), so id
    // descending is an accurate proxy without needing a real timestamp.
    list.sort((a, b) => b.id - a.id);
  } else if (mode === 'name-asc') {
    list.sort((a, b) => a.name.localeCompare(b.name));
  } else if (mode === 'name-desc') {
    list.sort((a, b) => b.name.localeCompare(a.name));
  }
  return list;
}

function _filterProductsBy(query) {
  return getAllProducts().filter(p => {
    const matchCat    = activeFilter === 'all' || p.category === activeFilter || getMultiCats(p.id).includes(activeFilter);
    const matchSub     = activeSubFilter === 'all' || p.subcategory === activeSubFilter;
    const matchSearch = matchesSearch(query, p);
    return matchCat && matchSub && matchSearch;
  });
}

function renderProducts() {
  const query = document.getElementById('searchInput').value.trim();
  const grid  = document.getElementById('productsGrid');
  const empty = document.getElementById('productsEmpty');
  const correctionNotice = document.getElementById('searchCorrectionNotice');
  renderSubFilters();

  let filtered = _filterProductsBy(query);
  // Typo tolerance: an exact-spelling miss doesn't have to be a dead end —
  // if a nearby real spelling finds something (within whatever category
  // filter is active), just show that instead of an empty grid.
  let suggestion = null, correctedFrom = null;
  if (!filtered.length && query) {
    suggestion = _didYouMean(query);
    if (suggestion) {
      const correctedResults = _filterProductsBy(suggestion);
      if (correctedResults.length) { filtered = correctedResults; correctedFrom = suggestion; }
    }
  }
  const isArU = _lang === 'ar';
  if (correctionNotice) {
    if (correctedFrom) {
      correctionNotice.style.display = 'flex';
      correctionNotice.innerHTML = '<i class="fa fa-info-circle"></i> ' + (isArU
        ? 'عرض النتائج لـ <strong>"' + correctedFrom.replace(/</g, '&lt;') + '"</strong> بدلاً من "' + query.replace(/</g, '&lt;') + '"'
        : 'Showing results for <strong>"' + correctedFrom.replace(/</g, '&lt;') + '"</strong> instead of "' + query.replace(/</g, '&lt;') + '"');
    } else {
      correctionNotice.style.display = 'none';
      correctionNotice.innerHTML = '';
    }
  }
  if (!filtered.length) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    // The very first render (before the Supabase fetch in loadSBData() has
    // resolved) and any category click made before it resolves both hit
    // this branch with an incomplete catalog — that's "still loading", not
    // "genuinely no matches", and shouldn't say so. window._catalogReady
    // flips true once (js/01-config-data.js) and this same function runs
    // again right after, replacing this with the real result.
    if (!window._catalogReady) {
      empty.innerHTML = '<span class="loading-gear" aria-hidden="true"></span><p>' + (isArU ? 'جارٍ تحميل المنتجات...' : 'Loading products…') + '</p>';
      return;
    }
    empty.innerHTML = '<i class="fa fa-box-open"></i>' +
      '<p data-i18n="no_results">' + (isArU ? 'لا توجد منتجات مطابقة. جرّب بحثاً آخر.' : 'No products found. Try a different search.') + '</p>' +
      (suggestion
        ? '<p style="margin-top:10px;font-size:15px">' + (isArU ? 'هل تقصد' : 'Did you mean') + ' ' +
          '<a href="#" style="color:var(--orange);font-weight:800;text-decoration:underline" ' +
          'onclick="applySearchSuggestion(this.textContent);return false;">' + suggestion.replace(/</g, '&lt;') + '</a>' + (isArU ? '؟' : '?') + '</p>'
        : '');
    return;
  }
  empty.style.display = 'none';
  if (currentSort === 'recommended') {
    // Best Sellers always first, then other badged items, then the rest
    const badgeOrder = { 'Best Seller': 0, 'Popular': 1, 'Pro': 2, 'New': 3, 'Sale': 4 };
    filtered.sort((a, b) => {
      const aRank = a.badge !== null && a.badge !== undefined ? (badgeOrder[a.badge] !== undefined ? badgeOrder[a.badge] : 5) : 99;
      const bRank = b.badge !== null && b.badge !== undefined ? (badgeOrder[b.badge] !== undefined ? badgeOrder[b.badge] : 5) : 99;
      return aRank - bRank;
    });
  } else {
    _sortProducts(filtered, currentSort);
  }
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
    const pCat  = isAr ? (_AR_CATS[p.category] || catLabel(p.category)) : catLabel(p.category);
    let stockLabel, stockClass;
    if (isOut)      { stockLabel = isAr ? '&#10006; غير متوفر'  : '&#10006; Out of Stock';  stockClass = 'out-of-stock'; }
    else if (isLow) { stockLabel = (isAr ? '&#9888; كمية محدودة' : '&#9888; Low Stock') + (liveQty !== null ? ' (' + liveQty + (isAr ? ' متبقي)' : ' left)') : ''); stockClass = 'low-stock'; }
    else            { stockLabel = (isAr ? '&#10003; متوفر'      : '&#10003; In Stock')  + (liveQty !== null ? ' (' + liveQty + ')' : ''); stockClass = 'in-stock'; }
    const addBtn   = isAr ? 'أضف' : 'Add';
    const unavail  = isAr ? 'غير متاح' : 'Unavailable';
    // Price-hidden ("Ask Price on WhatsApp") products are services, not real
    // stocked inventory — their stock field is meaningless, so never show the
    // Out of Stock ribbon/dimming for them.
    const priceHidden = !!window._sbPriceHidden[p.id];
    const showOut = isOut && !priceHidden;
    const cardSale = getFeaturedSale(p.id);
    const hasCardSale = cardSale > 0 && p.price > 0 && !priceHidden;
    return `
      <div class="product-card ${showOut ? 'card-out' : ''}" onclick="openProduct(${p.id})">
        <div class="product-img-wrap ${photo ? '' : 'img-ready'}">
          ${hasCardSale ? `<span class="product-badge product-badge-sale">-${cardSale}%</span>` : (p.badge ? `<span class="product-badge">${p.badge}</span>` : '')}
          ${showOut ? `<span class="out-badge">${isAr ? 'نفد المخزون' : 'OUT OF STOCK'}</span>` : ''}
          <button class="card-wl-btn ${isWishlisted(p.id)?'wishlisted':''}" onclick="toggleWishlist(${p.id}, event)" title="${isWishlisted(p.id)?'Remove from wishlist':'Save to wishlist'}" aria-label="${isWishlisted(p.id)?'Remove from wishlist':'Save to wishlist'}"><i class="fa fa-heart"></i></button>
          ${photo
            ? `<img src="${photo}" data-local="${p.img}" alt="${pName}" loading="lazy" onerror="imgError(this)" onload="this.parentElement.classList.add('img-ready')" />
               <div class="product-img-fallback" style="display:none"><i class="fa fa-tools"></i></div>`
            : `<div class="product-img-fallback" style="display:flex"><i class="fa fa-tools"></i></div>`}
        </div>
        <div class="product-info">
          <div class="product-cat">${pCat}</div>
          <div style="font-size:10px;font-weight:700;color:#aaa;letter-spacing:0.5px;margin-bottom:3px" id="cardSku${p.id}">${_variantSku(getVariants(p.id)[0], p.id)}</div>
          <h3>${pName}</h3>
          <p>${pDesc}</p>
          <!-- Kept in the DOM (visually hidden, not removed) so Google can still
               discover/crawl the per-product SEO pages via this internal link. -->
          <a class="pc-details" href="product/${productSlug(p)}.html" onclick="event.stopPropagation()" style="display:none;font-size:11px;font-weight:700;color:var(--orange);text-decoration:none;margin:2px 0 6px">${isAr ? 'عرض التفاصيل ←' : 'View details →'}</a>
          ${(getVariants(p.id).length) ? `
          <select class="card-variant-sel" id="cardVarSel${p.id}" onclick="event.stopPropagation()" onchange="event.stopPropagation();cardVariantChange(${p.id},this)">
            ${getVariants(p.id).map((v, i) => `<option value="${i}">${v.label}${(hasVisiblePrice(p) && v.price > 0 && v.price !== p.price) ? ' — ' + v.price.toFixed(3) + ' KWD' : ''}</option>`).join('')}
          </select>
          ` : ''}
          <div class="product-footer">
            ${hasVisiblePrice(p) ? `
            <div>
              <div class="product-price" id="cardPrice${p.id}">${_priceHtml(_cardRawPrice(p), p.id)}</div>
              <div class="stock-badge ${stockClass}">${stockLabel}</div>
            </div>
            ${isOut
              ? `<button class="btn-add btn-disabled" disabled onclick="event.stopPropagation()">${unavail}</button>`
              : `<button class="btn-add" onclick="event.stopPropagation();addToCart(${p.id}, this)"><i class="fa fa-plus"></i> ${addBtn}</button>`}
            ` : `
            <div>
              <div class="product-price" style="font-size:12px;color:var(--gray-600)">${isAr ? 'السعر عند الطلب' : 'Price on request'}</div>
            </div>
            <button class="btn-add" style="background:#25D366" onclick="event.stopPropagation();askPriceOnWhatsApp(${p.id}, (document.getElementById('cardVarSel${p.id}')||{}).value)"><i class="fab fa-whatsapp"></i> ${isAr ? 'اسأل عن السعر' : 'Ask Price'}</button>
            `}
          </div>
        </div>
      </div>`;
  }).join('');
}

// renderProducts() rebuilds the whole grid (up to ~800+ cards) via innerHTML,
// so calling it on every raw keystroke (both the grid's own search box and
// the header search dropdown do this) made fast typing feel laggy — most
// noticeable on desktop, where people type quicker than on a phone keyboard.
// 180ms is short enough to still feel instant once typing pauses.
var _renderProductsDebounceTimer;
function debouncedRenderProducts() {
  clearTimeout(_renderProductsDebounceTimer);
  _renderProductsDebounceTimer = setTimeout(renderProducts, 180);
}

// ── LIVE SEARCH RESULTS OVERLAY ─────────────────────────────────────────
// Ranks closest-match-first: exact name match, then name starts with the
// query, then name contains it, then everything else matchesSearch() found
// via description/category/subcategory/brand/keywords/Arabic name. The main
// grid below (renderProducts) keeps whatever the current sort mode is —
// this overlay is purely for "what's the best match for what I just typed".
function _rankSearchResults(query) {
  const normQ = normalizeQ(query);
  return getAllProducts()
    .filter(p => matchesSearch(query, p))
    .map(p => {
      const name = normalizeQ(p.name);
      let score;
      if (name === normQ) score = 0;
      else if (name.indexOf(normQ) === 0) score = 1;
      else if (name.indexOf(normQ) !== -1) score = 2;
      else score = 3;
      return { p, score };
    })
    .sort((a, b) => a.score - b.score)
    .map(x => x.p);
}

var _searchOverlayDebounceTimer;
function debouncedSearchOverlay(query) {
  clearTimeout(_searchOverlayDebounceTimer);
  _searchOverlayDebounceTimer = setTimeout(function() { updateSearchOverlay(query); }, 180);
}

function updateSearchOverlay(query) {
  const overlay = document.getElementById('searchOverlay');
  if (!overlay) return;
  const q = (query || '').trim();
  if (!q) { closeSearchOverlay(); return; }

  let results = _rankSearchResults(q);
  const isAr = _lang === 'ar';
  // Typo tolerance: try the closest real spelling before giving up.
  let correctedFrom = null;
  if (!results.length) {
    const suggestion = _didYouMean(q);
    if (suggestion) {
      const correctedResults = _rankSearchResults(suggestion);
      if (correctedResults.length) { results = correctedResults; correctedFrom = suggestion; }
    }
  }
  const summaryEl = document.getElementById('searchOverlaySummary');
  if (correctedFrom) {
    summaryEl.innerHTML = results.length + ' ' + (isAr ? 'نتيجة لـ' : (results.length === 1 ? 'result for' : 'results for')) +
      ' <strong style="color:var(--orange)">"' + correctedFrom.replace(/</g, '&lt;') + '"</strong> ' +
      (isAr ? 'بدلاً من' : 'instead of') + ' "' + q.replace(/</g, '&lt;') + '"';
  } else {
    summaryEl.textContent = results.length + ' ' + (isAr ? 'نتيجة لـ' : (results.length === 1 ? 'result for' : 'results for')) + ' "' + q + '"';
  }

  const grid    = document.getElementById('searchOverlayGrid');
  const emptyEl = document.getElementById('searchOverlayEmpty');
  const moreBtn = document.getElementById('searchOverlayMore');
  const SHOWN   = 24;
  const top     = results.slice(0, SHOWN);
  const customPhotos = _sbPhotos || {};

  if (!top.length) {
    grid.innerHTML = '';
    emptyEl.style.display = 'block';
    document.getElementById('searchOverlayEmptyText').textContent =
      isAr ? 'لا توجد منتجات مطابقة.' : 'No products found. Try a different search.';
    moreBtn.style.display = 'none';
  } else {
    emptyEl.style.display = 'none';
    grid.innerHTML = top.map(function(p) {
      const raw   = customPhotos[p.id];
      const photo = (raw && (raw.startsWith('http') || raw.startsWith('data:'))) ? raw : p.img;
      const priceHtml = hasVisiblePrice(p)
        ? applySale(p.price, p.id).toFixed(3) + ' KWD'
        : (isAr ? 'السعر عند الطلب' : 'Price on request');
      const pCat = isAr ? (_AR_CATS[p.category] || catLabel(p.category)) : catLabel(p.category);
      return '<div class="search-overlay-card" onclick="selectSearchOverlayResult(' + p.id + ')">' +
        '<div class="so-img-wrap">' +
          (photo ? '<img src="' + photo + '" alt="' + p.name + '" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" />' : '') +
          '<div class="so-img-fallback" style="display:' + (photo ? 'none' : 'flex') + '"><i class="fa fa-tools"></i></div>' +
        '</div>' +
        '<div class="so-cat">' + pCat + '</div>' +
        '<div class="so-name">' + p.name + '</div>' +
        '<div class="so-price">' + priceHtml + '</div>' +
      '</div>';
    }).join('');
    moreBtn.style.display = results.length > SHOWN ? 'block' : 'none';
    moreBtn.textContent = isAr ? 'عرض جميع ' + results.length + ' نتيجة' : 'View all ' + results.length + ' results';
  }

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function selectSearchOverlayResult(id) {
  closeSearchOverlay();
  openProduct(id);
}

function viewAllSearchResults() {
  closeSearchOverlay();
  const grid = document.getElementById('productsGrid');
  if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeSearchOverlay() {
  const overlay = document.getElementById('searchOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

