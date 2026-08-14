// ── STOCK ──────────────────────────────────────────────────────────────────────
// Stock quantities are stored locally in the browser (localStorage key: jain_stock)
// AND synced to Supabase. getStock() loads them from localStorage on startup.
function getStock() {
  const s = localStorage.getItem('jain_stock');
  if (s) return JSON.parse(s);
  const d = {};
  PRODUCTS.forEach(p => { d[p.id] = p.price > 10 ? 15 : p.price > 5 ? 30 : 50; });
  return d;
}
let stockData = getStock();

// _prodOverrides — stores manual name/price edits made in the admin table
//                  so they survive page refresh (localStorage key: bahar_overrides)
let _prodOverrides = {};
try { _prodOverrides = JSON.parse(localStorage.getItem('bahar_overrides') || '{}'); } catch(e) {}

// ── UNDO / REDO ────────────────────────────────────────────────────────────────
// Tracks stock changes so you can undo/redo with Ctrl+Z / Ctrl+Y.
// Each time stock changes, a snapshot is pushed onto _undoStack (max 50 levels).
let _undoStack = [];
let _redoStack = [];
function _pushUndo() {
  _undoStack.push(JSON.stringify(stockData));
  if (_undoStack.length > 50) _undoStack.shift();
  _redoStack = [];
  _syncUrBtns();
}
function _syncUrBtns() {
  document.getElementById('undoBtn').disabled = _undoStack.length === 0;
  document.getElementById('redoBtn').disabled = _redoStack.length === 0;
}
function undo() {
  if (!_undoStack.length) return;
  _redoStack.push(JSON.stringify(stockData));
  stockData = JSON.parse(_undoStack.pop());
  localStorage.setItem('jain_stock', JSON.stringify(stockData));
  renderTable(); renderStats(); _syncUrBtns();
  showToast('Undone â†©');
}
function redo() {
  if (!_redoStack.length) return;
  _undoStack.push(JSON.stringify(stockData));
  stockData = JSON.parse(_redoStack.pop());
  localStorage.setItem('jain_stock', JSON.stringify(stockData));
  renderTable(); renderStats(); _syncUrBtns();
  showToast('Redone â†ª');
}
// Tab-aware: Ctrl+Z/Ctrl+Y drives whichever tab's own undo/redo stack is
// visible (stock here, or the Featured tab's picks/sales — see foUndo/foRedo
// in admin/js/05-categories.js) so pressing it doesn't fire both at once.
document.addEventListener('keydown', function(e) {
  var featuredSection = document.getElementById('featuredSection');
  var onFeatured = featuredSection && featuredSection.style.display !== 'none';
  if ((e.ctrlKey||e.metaKey) && e.key === 'z') { e.preventDefault(); onFeatured ? foUndo() : undo(); }
  if ((e.ctrlKey||e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); onFeatured ? foRedo() : redo(); }
});

// ── SMART SEARCH (typo tolerance) ───────────────────────────────────────────
// Shared by the Inventory, Featured, and SEO tab searches (07-orders.js,
// 05-categories.js, 12-seo.js): when a search finds literally nothing, try
// the closest real spelling from the catalog's own names/brands/categories
// before giving up — same approach as the storefront's own "Did you mean"
// (js/02-catalog-render.js), reimplemented here since admin and storefront
// are separate pages with no shared script.
function _adminLevenshtein(a, b, max) {
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
    if (rowMin > max) return max + 1;
    var t = prev; prev = cur; cur = t;
  }
  return prev[b.length];
}

// normalized word -> original display spelling, built from the live catalog
var _adminVocabCache = null, _adminVocabCacheCount = 0;
function _adminSearchVocab() {
  var products = getAllAdminProducts();
  if (_adminVocabCache && _adminVocabCacheCount === products.length) return _adminVocabCache;
  var vocab = {};
  function addWords(text) {
    String(text || '').split(/[\s\/,()+×x-]+/).forEach(function(w) {
      var display = w.trim();
      if (display.length < 3 || /^[\d.]+$/.test(display)) return;
      var norm = display.toLowerCase();
      if (norm.length >= 3 && !vocab[norm]) vocab[norm] = display.toLowerCase();
    });
  }
  products.forEach(function(p) {
    addWords(p.name);
    addWords(getBrand(p.id));
    getProductCatSlugs(p).forEach(function(slug) {
      var match = getAllCats().find(function(c){ return c.slug === slug; });
      addWords(match ? match.label : slug.replace(/-/g, ' '));
    });
  });
  _adminVocabCache = vocab; _adminVocabCacheCount = products.length;
  return vocab;
}

// query: raw search text. matchFn(correctedQuery) => truthy if it would find
// something — callers pass their own filter so the correction respects
// whatever category/brand filter is currently active. Returns the corrected
// query string, or null if no correction was needed/found anything.
function _adminDidYouMean(query, matchFn) {
  var vocab = _adminSearchVocab();
  var changed = false;
  var corrected = query.toLowerCase().split(/\s+/).filter(Boolean).map(function(word) {
    if (word.length < 3 || vocab[word]) return word;
    var maxDist = word.length <= 4 ? 1 : word.length <= 7 ? 2 : 3;
    var best = null, bestDist = maxDist + 1;
    for (var norm in vocab) {
      var d = _adminLevenshtein(word, norm, maxDist);
      if (d < bestDist) { bestDist = d; best = vocab[norm]; }
    }
    if (best) { changed = true; return best; }
    return word;
  }).join(' ');
  if (!changed) return null;
  return matchFn(corrected) ? corrected : null;
}

