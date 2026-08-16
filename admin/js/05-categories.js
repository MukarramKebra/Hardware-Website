// ── CATEGORY EDITOR ────────────────────────────────────────────────────────────
// CAT_DEFS = the list of categories with their name, icon, and default background image.
// renderCatEditor() draws the grid of category cards in the Categories tab.
// saveCatBg()  — saves a new background image when you click "Change Image"
// resetCatBg() — puts the default image back
var CAT_DEFS = [
  { slug:'tools',            label:'DCK Power Tools', icon:'fa-bolt',         default:'cat-images/tools.jpg' },
  { slug:'hand-tools',       label:'Hand Tools',      icon:'fa-hammer',       default:'cat-images/hand-tools.png' },
  { slug:'fastener',         label:'Fasteners',       icon:'fa-cog',          default:'cat-images/fastener.png' },
  { slug:'construction',     label:'Nails/Wires',     icon:'fa-thumbtack',    default:'cat-images/construction.png' },
  { slug:'safety',           label:'Safety',          icon:'fa-hard-hat',     default:'cat-images/safety.jpg' },
  { slug:'spray-adhesive',   label:'Adhesives',       icon:'fa-spray-can',    default:'cat-images/spray-adhesive.png' },
  { slug:'tape',             label:'Tapes',           icon:'fa-tape',         default:'cat-images/tape.png' },
  { slug:'door-handle',      label:'Door Handles',    icon:'fa-door-open',    default:'cat-images/door-handle.png' },
  { slug:'hardware',         label:'Hardware',        icon:'fa-toolbox',      default:'cat-images/hardware.png' },
  { slug:'paint-tool',       label:'Paint Tools',     icon:'fa-paint-roller', default:'cat-images/paint-tool.jpg' },
  { slug:'gardening',        label:'Garden Tools',    icon:'fa-seedling',     default:'cat-images/gardening.png' },
  { slug:'disc',             label:'Discs',           icon:'fa-compact-disc', default:'cat-images/disc.jpg' },
  { slug:'trolley-caster',   label:'Wheel Barrow',    icon:'fa-dolly',        default:'cat-images/trolley-caster.png' },
  { slug:'household',        label:'Cleaning',        icon:'fa-broom',        default:'cat-images/household.png' },
  { slug:'plumbing-fitting', label:'Fittings',        icon:'fa-wrench',       default:'cat-images/plumbing-fitting.png' },
  { slug:'sanitary',         label:'Sanitary Ware',   icon:'fa-shower',       default:'cat-images/sanitary.png' },
  { slug:'filter',           label:'Filters',         icon:'fa-filter',       default:'cat-images/filter.png' },
  { slug:'marhaba',          label:'Marhaba',         icon:'fa-plug',         default:'cat-images/marhaba.jpg' },
  { slug:'all',              label:'All Products',    icon:'fa-th-large',     default:'Bahar-Products/SKU-0015.jpg' }
];

// ── HIDDEN CATEGORIES (Inventory tab) ─────────────────────────────────────
// "Hidden" here is fully dynamic now, driven by cat_hidden (the same toggle
// as the Categories tab's Hide/Show button) — this panel is no longer a
// fixed slug list. Two exceptions: "Can't Find Products" is always included
// and always sorts last (it never had a real storefront tile to toggle —
// it's the catch-all for unverified imports, not a shop category), and
// "All" is a synthetic first entry that resets the table.
var CANT_FIND_SLUG = 'cant-find-products';
// Reads only — the Categories tab's own working copy (_catPendingLabels etc.)
// is what's actually being edited; these just reflect the last *saved*
// state, which is what everywhere else in admin (this panel, the Inventory
// table's sort) should follow.
function getCatLabels() {
  try { return JSON.parse(localStorage.getItem('jain_cat_labels') || '{}'); } catch(e) { return {}; }
}
function getCatHidden() {
  try { return JSON.parse(localStorage.getItem('jain_cat_hidden') || '{}'); } catch(e) { return {}; }
}
function renderHiddenCats() {
  var list = document.getElementById('hiddenCatsList');
  if (!list) return;
  var products = getAllAdminProducts();
  var labels = getCatLabels();
  var hiddenMap = getCatHidden();
  var defsBySlug = {};
  CAT_DEFS.forEach(function(c) { defsBySlug[c.slug] = c; });
  var hiddenSlugs = Object.keys(hiddenMap).filter(function(s) { return hiddenMap[s]; });
  // "default" = a real storefront category (tools, hand-tools, ...) currently
  // toggled hidden — restorable, but not rename/delete-able here (that's the
  // Categories tab's job, where the tile + label are managed together).
  // "custom" = a genuinely new category created from this panel — no
  // storefront tile ever exists for these, so rename/delete both make sense
  // straight from here. "locked" = the one permanent catch-all, untouchable.
  var entries = hiddenSlugs.map(function(s) { return { slug: s, label: (defsBySlug[s] || {}).label || s, kind: 'default' }; });
  entries = entries.concat(getCustomHiddenCats().map(function(c) { return { slug: c.slug, label: c.label, kind: 'custom' }; }));
  entries.push({ slug: CANT_FIND_SLUG, label: "Can't Find Products", kind: 'locked' });
  entries.sort(function(a, b) {
    if (a.slug === CANT_FIND_SLUG) return 1;
    if (b.slug === CANT_FIND_SLUG) return -1;
    return 0;
  });
  // "All" comes first and resets the table back to every product — a quick
  // way back out after filtering into a hidden category from this panel,
  // without hunting for the main Category dropdown's All option.
  var chips = [{ slug: 'all', label: 'All', count: products.length, kind: 'reset' }].concat(
    entries.map(function(c) {
      return { slug: c.slug, label: labels[c.slug] || c.label, count: products.filter(function(p) { return p.cat === c.slug; }).length, kind: c.kind };
    })
  );
  list.innerHTML = chips.map(function(c) {
    var manage = '';
    if (c.kind === 'default') {
      manage = '<button class="hc-action" onclick="event.stopPropagation();quickUnhideCategory(\'' + c.slug + '\')" title="Restore to storefront"><i class="fa fa-eye"></i></button>';
    } else if (c.kind === 'custom') {
      manage = '<button class="hc-action" onclick="event.stopPropagation();renameHiddenCategory(\'' + c.slug + '\')" title="Rename"><i class="fa fa-pencil"></i></button>' +
               '<button class="hc-action" onclick="event.stopPropagation();deleteHiddenCategory(\'' + c.slug + '\')" title="Delete"><i class="fa fa-trash"></i></button>';
    }
    return '<div class="hidden-cat-chip">' +
      '<span class="hc-click" onclick="fcSet(\'cat\',\'' + c.slug + '\',\'' + c.label.replace(/'/g, "\\'") + '\')">' +
        '<span class="hc-name">' + encodeHtml(c.label) + '</span>' +
        '<span class="hc-count">' + c.count + '</span>' +
      '</span>' +
      manage +
    '</div>';
  }).join('') + _hideCatPickerHTML(hiddenSlugs);
}

// ── CUSTOM HIDDEN CATEGORIES ──────────────────────────────────────────────
// Genuinely NEW categories that don't exist in CAT_DEFS at all — same idea
// as Can't Find Products (admin-only, no storefront pill/tile), except
// user-created and any number can exist. No storefront tile by construction:
// index.html's category grid only renders the fixed CAT_DEFS set, so
// anything outside it is automatically invisible to customers — no separate
// "hidden" flag needed the way real storefront categories require one.
// Synced through Supabase (expert_settings key 'custom_hidden_cats') so
// every admin session and the category-assignment dropdowns (Add Product,
// multi-category picker, CSV import) see the same list — unlike the older
// getCustomCats()/'bahar_categories' mechanism, which is localStorage-only
// (see handoff.md "Next steps").
function getCustomHiddenCats() {
  if (window._sbCustomHiddenCats) return window._sbCustomHiddenCats;
  try { return JSON.parse(localStorage.getItem('jain_custom_hidden_cats') || '[]'); } catch(e) { return []; }
}
function _pushCustomHiddenCats(list) {
  window._sbCustomHiddenCats = list;
  localStorage.setItem('jain_custom_hidden_cats', JSON.stringify(list));
  _invalidateCatsCache();
  return sbFetch(SB_URL + '/rest/v1/expert_settings', {
    method: 'POST',
    headers: Object.assign({}, SB_HDRS, { 'Prefer': 'resolution=merge-duplicates' }),
    body: JSON.stringify([{ key: 'custom_hidden_cats', value: JSON.stringify(list) }])
  });
}
// Avoids colliding with ANY existing category slug (built-in, custom,
// hidden, or the Can't Find Products catch-all) — plain slugify() isn't
// enough since two different names can slugify to the same thing, or land
// on a built-in slug (e.g. "MARHABA" -> "marhaba", already the Generators
// category's slug).
function _uniqueHiddenCatSlug(base) {
  var taken = {};
  getAllCats().forEach(function(c){ taken[c.slug] = true; });
  taken[CANT_FIND_SLUG] = true;
  var slug = base, n = 2;
  while (taken[slug]) { slug = base + '-' + n; n++; }
  return slug;
}
async function createHiddenCategory(name) {
  name = (name || '').trim();
  if (!name) { showToast('Enter a category name'); return; }
  var base = slugify(name);
  if (!base) { showToast('Enter a valid category name'); return; }
  var slug = _uniqueHiddenCatSlug(base);
  var list = getCustomHiddenCats().concat([{ slug: slug, label: name }]);
  var res = await _pushCustomHiddenCats(list);
  if (res.error) { showToast('Failed to save — check Supabase expert_settings table'); return; }
  refreshCategorySelects();
  renderHiddenCats();
  showToast('"' + name + '" created as a hidden category');
}
async function renameHiddenCategory(slug) {
  var list = getCustomHiddenCats();
  var entry = list.find(function(c){ return c.slug === slug; });
  if (!entry) return;
  var name = prompt('Rename "' + entry.label + '" to:', entry.label);
  if (name === null) return;
  name = name.trim();
  if (!name) { showToast("Name can't be empty"); return; }
  entry.label = name;
  var res = await _pushCustomHiddenCats(list);
  if (res.error) { showToast('Failed to save — check Supabase expert_settings table'); return; }
  refreshCategorySelects();
  renderHiddenCats();
  renderTable();
  showToast('Renamed to "' + name + '"');
}
async function deleteHiddenCategory(slug) {
  var list = getCustomHiddenCats();
  var entry = list.find(function(c){ return c.slug === slug; });
  if (!entry) return;
  var count = getAllAdminProducts().filter(function(p){ return p.cat === slug; }).length;
  if (!confirm('Delete "' + entry.label + '"?' + (count ? ' ' + count + ' product(s) using it will need reassigning to a new category.' : ''))) return;
  var next = list.filter(function(c){ return c.slug !== slug; });
  var res = await _pushCustomHiddenCats(next);
  if (res.error) { showToast('Failed to save — check Supabase expert_settings table'); return; }
  refreshCategorySelects();
  renderHiddenCats();
  showToast('Category deleted');
}
// Inverse of quickHideCategory() below — restores a real storefront
// category (one currently toggled hidden via cat_hidden) back to the nav.
async function quickUnhideCategory(slug) {
  var hidden = getCatHidden();
  delete hidden[slug];
  localStorage.setItem('jain_cat_hidden', JSON.stringify(hidden));
  var res = await sbFetch(SB_URL + '/rest/v1/expert_settings', {
    method: 'POST',
    headers: Object.assign({}, SB_HDRS, { 'Prefer': 'resolution=merge-duplicates' }),
    body: JSON.stringify([{ key: 'cat_hidden', value: JSON.stringify(hidden) }])
  });
  if (res.error) { showToast('Failed to save — check Supabase expert_settings table'); return; }
  if (typeof _catPendingHidden !== 'undefined') _catPendingHidden = hidden;
  renderHiddenCats();
  showToast('Category restored to storefront');
}

// "+ Hide a category" — creates a new hidden category right from this
// panel instead of requiring a trip to the Categories tab. Takes effect
// immediately (not staged behind that tab's Save/Undo/Redo — this is a
// separate, simpler surface) and keeps the two in sync since both read/
// write the same cat_hidden setting.
function _hideCatPickerHTML(hiddenSlugs) {
  var options = CAT_DEFS.filter(function(c) {
    return c.slug !== 'all' && hiddenSlugs.indexOf(c.slug) === -1;
  });
  if (!options.length) return '';
  var labels = getCatLabels();
  return '<select class="hidden-cat-add" onchange="if(this.value){quickHideCategory(this.value);this.value=\'\';}" style="margin-left:auto">' +
    '<option value="">+ Hide a category…</option>' +
    options.map(function(c) {
      return '<option value="' + c.slug + '">' + encodeHtml(labels[c.slug] || c.label) + '</option>';
    }).join('') +
  '</select>';
}
async function quickHideCategory(slug) {
  var hidden = getCatHidden();
  hidden[slug] = true;
  localStorage.setItem('jain_cat_hidden', JSON.stringify(hidden));
  var res = await sbFetch(SB_URL + '/rest/v1/expert_settings', {
    method: 'POST',
    headers: Object.assign({}, SB_HDRS, { 'Prefer': 'resolution=merge-duplicates' }),
    body: JSON.stringify([{ key: 'cat_hidden', value: JSON.stringify(hidden) }])
  });
  if (res.error) { showToast('Failed to save — check Supabase expert_settings table'); return; }
  // Keep the Categories tab's own pending copy in sync if it's already
  // loaded this session, so switching tabs doesn't show stale state.
  if (typeof _catPendingHidden !== 'undefined') _catPendingHidden = hidden;
  renderHiddenCats();
  showToast('Category hidden from storefront');
}

// Custom order + renamed labels work like the Featured tab's picks
// (js/05-categories.js foItems below): drag/rename only touches an
// in-memory pending copy, Undo/Redo step through snapshots of it, and
// nothing reaches Supabase until "Save Changes" — so a bad drag or a
// typo can be walked back before it goes live on the storefront (labels
// are picked up there by applyCatLabelOverrides() in js/02-catalog-render.js).
var _catPendingOrder  = [];   // array of slugs, working copy
var _catPendingLabels = {};   // slug -> custom label, working copy
var _catPendingHidden = {};   // slug -> true if hidden from the storefront nav
var _catUndoStack = [];
var _catRedoStack = [];
var _catDirty = false;

function _catSnapshot() { return JSON.stringify({ order: _catPendingOrder, labels: _catPendingLabels, hidden: _catPendingHidden }); }
function _catPushUndo() {
  _catUndoStack.push(_catSnapshot());
  if (_catUndoStack.length > 50) _catUndoStack.shift();
  _catRedoStack = [];
  _catDirty = true;
  _catSyncButtons();
}
function _catSyncButtons() {
  var u = document.getElementById('catUndoBtn');
  var r = document.getElementById('catRedoBtn');
  var s = document.getElementById('catSaveBtn');
  if (u) u.disabled = _catUndoStack.length === 0;
  if (r) r.disabled = _catRedoStack.length === 0;
  if (s) s.disabled = !_catDirty;
}
function catUndo() {
  if (!_catUndoStack.length) return;
  _catRedoStack.push(_catSnapshot());
  var snap = JSON.parse(_catUndoStack.pop());
  _catPendingOrder = snap.order;
  _catPendingLabels = snap.labels;
  _catPendingHidden = snap.hidden || {};
  _catDirty = true;
  _catSyncButtons();
  renderCatEditor();
  showToast('Undone ↩');
}
function catRedo() {
  if (!_catRedoStack.length) return;
  _catUndoStack.push(_catSnapshot());
  var snap = JSON.parse(_catRedoStack.pop());
  _catPendingOrder = snap.order;
  _catPendingLabels = snap.labels;
  _catPendingHidden = snap.hidden || {};
  _catDirty = true;
  _catSyncButtons();
  renderCatEditor();
  showToast('Redone ↪');
}

function _orderedCatDefs() {
  var bySlug = {};
  CAT_DEFS.forEach(function(c) { bySlug[c.slug] = c; });
  var ordered = _catPendingOrder.map(function(slug) { return bySlug[slug]; }).filter(Boolean);
  CAT_DEFS.forEach(function(c) { if (_catPendingOrder.indexOf(c.slug) === -1) ordered.push(c); });
  return ordered.map(function(c) {
    return Object.assign({}, c, { label: _catPendingLabels[c.slug] || c.label, hidden: !!_catPendingHidden[c.slug] });
  });
}

// "All Products" isn't a real storefront category (there's no pill/tile to
// hide) — the toggle only makes sense on actual categories.
function catToggleHidden(slug) {
  if (slug === 'all') return;
  _catPushUndo();
  if (_catPendingHidden[slug]) delete _catPendingHidden[slug];
  else _catPendingHidden[slug] = true;
  renderCatEditor();
}

async function saveCatChanges() {
  var slugs = _orderedCatDefs().map(function(c) { return c.slug; });
  localStorage.setItem('jain_cat_order', JSON.stringify(slugs));
  localStorage.setItem('jain_cat_labels', JSON.stringify(_catPendingLabels));
  localStorage.setItem('jain_cat_hidden', JSON.stringify(_catPendingHidden));
  var res = await sbFetch(SB_URL + '/rest/v1/expert_settings', {
    method: 'POST',
    headers: Object.assign({}, SB_HDRS, { 'Prefer': 'resolution=merge-duplicates' }),
    body: JSON.stringify([
      { key: 'cat_order',  value: JSON.stringify(slugs) },
      { key: 'cat_labels', value: JSON.stringify(_catPendingLabels) },
      { key: 'cat_hidden', value: JSON.stringify(_catPendingHidden) }
    ])
  });
  if (res.error) { showToast('Failed to save — check Supabase expert_settings table'); return; }
  _catDirty = false;
  _catSyncButtons();
  renderHiddenCats();
  showToast('Category layout saved!');
}

async function loadCatLayout() {
  var res = await sbFetch(SB_URL + '/rest/v1/expert_settings?key=in.(cat_order,cat_labels,cat_hidden)&select=key,value', { headers: SB_HDRS });
  var order = [], labels = {}, hidden = {};
  if (!res.error && Array.isArray(res.data)) {
    res.data.forEach(function(row) {
      if (row.key === 'cat_order')  { try { order  = JSON.parse(row.value) || []; } catch(e) {} }
      if (row.key === 'cat_labels') { try { labels = JSON.parse(row.value) || {}; } catch(e) {} }
      if (row.key === 'cat_hidden') { try { hidden = JSON.parse(row.value) || {}; } catch(e) {} }
    });
  }
  _catPendingOrder = order;
  _catPendingLabels = labels;
  _catPendingHidden = hidden;
  // Undo history doesn't survive a fresh reload from the source of truth.
  _catUndoStack = [];
  _catRedoStack = [];
  _catDirty = false;
  _catSyncButtons();
  renderCatEditor();
}

var _catDragSlug = null;
function catDragStart(e, slug) {
  _catDragSlug = slug;
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('cat-dragging');
}
function catDragEnd(e) {
  e.currentTarget.classList.remove('cat-dragging');
  _catDragSlug = null;
}
function catDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('cat-drag-over');
}
function catDragLeave(e) {
  e.currentTarget.classList.remove('cat-drag-over');
}
function catDrop(e, targetSlug) {
  e.preventDefault();
  e.currentTarget.classList.remove('cat-drag-over');
  if (!_catDragSlug || _catDragSlug === targetSlug) return;
  var slugs = _orderedCatDefs().map(function(c) { return c.slug; });
  var from = slugs.indexOf(_catDragSlug);
  var to   = slugs.indexOf(targetSlug);
  if (from === -1 || to === -1) return;
  _catPushUndo();
  slugs.splice(from, 1);
  slugs.splice(to, 0, _catDragSlug);
  _catPendingOrder = slugs;
  renderCatEditor();
}

function catRenameCommit(slug, el) {
  var val = el.textContent.replace(/\s+/g, ' ').trim();
  var def = CAT_DEFS.find(function(c) { return c.slug === slug; });
  var current = _catPendingLabels[slug] || (def ? def.label : slug);
  if (!val) { el.textContent = current; return; }
  if (val === current) return;
  _catPushUndo();
  if (val === (def ? def.label : slug)) delete _catPendingLabels[slug];
  else _catPendingLabels[slug] = val;
}
function catRenameKeydown(e) {
  if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
}

function renderCatEditor() {
  var bgs = {};
  try { bgs = JSON.parse(localStorage.getItem('jain_cat_bgs') || '{}'); } catch(e) {}
  var grid = document.getElementById('catEditGrid');
  if (!grid) return;
  grid.innerHTML = _orderedCatDefs().map(function(cat) {
    var img = bgs[cat.slug] || cat.default;
    return '<div class="cat-edit-card' + (cat.hidden ? ' cat-edit-hidden' : '') + '" draggable="true" ' +
        'ondragstart="catDragStart(event,\'' + cat.slug + '\')" ondragend="catDragEnd(event)" ' +
        'ondragover="catDragOver(event)" ondragleave="catDragLeave(event)" ondrop="catDrop(event,\'' + cat.slug + '\')" ' +
        'style="background:#fff;border:1px solid #e2e4e8;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.07)">' +
      '<div class="cat-edit-drag-handle" title="Drag to reorder"><i class="fa fa-grip-lines"></i></div>' +
      (cat.hidden ? '<div class="cat-edit-hidden-badge"><i class="fa fa-eye-slash"></i> Hidden</div>' : '') +
      '<div style="height:150px;background:url(\'' + img + '\') center/cover no-repeat"></div>' +
      '<div style="padding:12px 14px">' +
        '<div class="cat-edit-name" contenteditable="true" spellcheck="false" ' +
          'onblur="catRenameCommit(\'' + cat.slug + '\',this)" onkeydown="catRenameKeydown(event)" ' +
          'style="font-weight:800;font-size:13px;color:#1c1c1c;margin-bottom:10px;padding:3px 5px;border-radius:5px;outline:none" ' +
          'title="Click to rename">' + encodeHtml(cat.label) + '</div>' +
        '<label style="display:block;background:var(--orange);color:#fff;text-align:center;padding:8px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700">' +
          '<i class="fa fa-image"></i> Change Image' +
          '<input type="file" accept="image/*" style="display:none" onchange="saveCatBg(\'' + cat.slug + '\',this)" />' +
        '</label>' +
        (cat.slug !== 'all'
          ? '<button onclick="openCatProducts(\'' + cat.slug + '\')" style="width:100%;margin-top:6px;background:none;border:1px solid var(--orange);border-radius:6px;padding:7px;font-size:11px;font-weight:700;color:var(--orange);cursor:pointer"><i class="fa fa-boxes"></i> Products</button>'
          : '') +
        (cat.slug !== 'all'
          ? '<button onclick="catToggleHidden(\'' + cat.slug + '\')" style="width:100%;margin-top:6px;background:none;border:1px solid ' + (cat.hidden ? 'var(--green,#1c7a52)' : '#e2e4e8') + ';border-radius:6px;padding:6px;font-size:11px;font-weight:700;color:' + (cat.hidden ? 'var(--green,#1c7a52)' : '#888') + ';cursor:pointer"><i class="fa ' + (cat.hidden ? 'fa-eye' : 'fa-eye-slash') + '"></i> ' + (cat.hidden ? 'Show on storefront' : 'Hide from storefront') + '</button>'
          : '') +
        '<button onclick="resetCatBg(\'' + cat.slug + '\')" style="width:100%;margin-top:6px;background:none;border:1px solid #e2e4e8;border-radius:6px;padding:6px;font-size:11px;color:#888;cursor:pointer"><i class="fa fa-undo"></i> Reset Default</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function saveCatBg(slug, input) {
  if (!input.files || !input.files[0]) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var bgs = {};
    try { bgs = JSON.parse(localStorage.getItem('jain_cat_bgs') || '{}'); } catch(er) {}
    bgs[slug] = e.target.result;
    localStorage.setItem('jain_cat_bgs', JSON.stringify(bgs));
    // Save to Supabase
    sbFetch(SB_URL + '/rest/v1/expert_cat_bgs', {
      method: 'POST',
      headers: Object.assign({}, SB_HDRS, { 'Prefer': 'resolution=merge-duplicates' }),
      body: JSON.stringify([{ slug: slug, img_url: e.target.result }])
    });
    showToast('Category image updated!');
    renderCatEditor();
  };
  reader.readAsDataURL(input.files[0]);
}

function resetCatBg(slug) {
  var bgs = {};
  try { bgs = JSON.parse(localStorage.getItem('jain_cat_bgs') || '{}'); } catch(e) {}
  delete bgs[slug];
  localStorage.setItem('jain_cat_bgs', JSON.stringify(bgs));
  sbFetch(SB_URL + '/rest/v1/expert_cat_bgs?slug=eq.' + slug, { method: 'DELETE', headers: SB_HDRS });
  showToast('Reset to default');
  renderCatEditor();
}

// ── SIDE BANNERS ─────────────────────────────────────────────────────────────
// loadBanners()   — fetches the current banner list from Supabase and draws it.
//                   The first time this runs with an empty table, it seeds the
//                   database with the same defaults the storefront falls back
//                   to (Banners/ folder) so they show up here as real rows you
//                   can edit or delete — otherwise there'd be nothing to manage
//                   until you added a banner yourself.
// addBanner()     — uploads a new banner (brand name + image) to Supabase
// editBanner()    — opens the edit modal for one banner
// saveEditBanner()— saves the brand name / replacement image for that banner
// deleteBanner()  — removes one banner
var _bannerList = [];
var _editBannerId = null;
var DEFAULT_BANNERS = [
  { brand: 'DCK',    img: 'Banners/dck1.jpg' },
  { brand: 'DCK',    img: 'Banners/dck2.jpg' },
  { brand: 'Covax',  img: 'Banners/covax1.jpg' },
  { brand: 'Covax',  img: 'Banners/covax2.jpg' },
  { brand: 'iTrust', img: 'Banners/itrust1.jpg' },
  { brand: 'iTrust', img: 'Banners/itrust2.jpg' },
  { brand: 'iTrust', img: 'Banners/itrust3.jpg' },
  { brand: 'iTrust', img: 'Banners/itrust4.jpg' }
];

async function loadBanners() {
  var res = await sbFetch(SB_URL + '/rest/v1/expert_banners?select=*&order=id.asc', { headers: SB_HDRS });
  var list = Array.isArray(res.data) ? res.data : [];
  if (!list.length && !res.error) {
    var seedRows = DEFAULT_BANNERS.map(function(b) { return { brand: b.brand, img_url: b.img }; });
    var seedRes = await sbFetch(SB_URL + '/rest/v1/expert_banners', {
      method: 'POST',
      headers: Object.assign({}, SB_HDRS, { 'Prefer': 'return=representation' }),
      body: JSON.stringify(seedRows)
    });
    list = Array.isArray(seedRes.data) ? seedRes.data : [];
  }
  _bannerList = list;
  renderBannerEditor();
}

function renderBannerEditor() {
  var grid = document.getElementById('bannerEditGrid');
  if (!grid) return;
  if (!_bannerList.length) {
    grid.innerHTML = '<p style="color:#aaa;font-size:12px;grid-column:1/-1">No custom banners yet — the homepage is showing the default set from the Banners folder.</p>';
    return;
  }
  grid.innerHTML = _bannerList.map(function(b) {
    return '<div style="background:#fff;border:1px solid #e2e4e8;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.07)">' +
      '<div style="height:130px;background:url(\'' + b.img_url + '\') center/cover no-repeat"></div>' +
      '<div style="padding:10px 12px">' +
        '<div style="font-weight:800;font-size:13px;color:#1c1c1c;margin-bottom:8px">' + encodeHtml(b.brand) + '</div>' +
        '<div style="display:flex;gap:6px">' +
          '<button onclick="editBanner(' + b.id + ')" style="flex:1;background:none;border:1px solid var(--border);color:var(--gray);border-radius:6px;padding:6px;font-size:11px;font-weight:700;cursor:pointer"><i class="fa fa-edit"></i> Edit</button>' +
          '<button onclick="deleteBanner(' + b.id + ')" style="flex:1;background:none;border:1px solid var(--red);color:var(--red);border-radius:6px;padding:6px;font-size:11px;font-weight:700;cursor:pointer"><i class="fa fa-trash"></i> Delete</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function addBanner() {
  var fileInput  = document.getElementById('newBannerFile');
  var brandInput = document.getElementById('newBannerBrand');
  var brand = (brandInput.value || '').trim();
  if (!brand) { showToast('Enter a brand name first'); fileInput.value = ''; return; }
  if (!fileInput.files || !fileInput.files[0]) return;
  var reader = new FileReader();
  reader.onload = async function(e) {
    var res = await sbFetch(SB_URL + '/rest/v1/expert_banners', {
      method: 'POST',
      headers: Object.assign({}, SB_HDRS, { 'Prefer': 'return=representation' }),
      body: JSON.stringify([{ brand: brand, img_url: e.target.result }])
    });
    if (res.error) { showToast('Failed to save banner'); return; }
    brandInput.value = '';
    fileInput.value  = '';
    showToast('Banner added!');
    loadBanners();
  };
  reader.readAsDataURL(fileInput.files[0]);
}

function editBanner(id) {
  var b = _bannerList.find(function(x) { return x.id === id; });
  if (!b) return;
  _editBannerId = id;
  document.getElementById('editBannerBrand').value = b.brand;
  document.getElementById('editBannerFile').value = '';
  document.getElementById('editBannerOverlay').classList.add('open');
}

function closeEditBanner() {
  document.getElementById('editBannerOverlay').classList.remove('open');
  _editBannerId = null;
}

async function saveEditBanner() {
  if (_editBannerId === null) return;
  var brand = (document.getElementById('editBannerBrand').value || '').trim();
  if (!brand) { showToast('Brand name can\'t be empty'); return; }
  var fileInput = document.getElementById('editBannerFile');

  function patch(imgUrl) {
    var body = { brand: brand };
    if (imgUrl) body.img_url = imgUrl;
    return sbFetch(SB_URL + '/rest/v1/expert_banners?id=eq.' + _editBannerId, {
      method: 'PATCH',
      headers: Object.assign({}, SB_HDRS, { 'Prefer': 'return=representation' }),
      body: JSON.stringify(body)
    });
  }

  var res;
  if (fileInput.files && fileInput.files[0]) {
    var dataUrl = await new Promise(function(resolve) {
      var reader = new FileReader();
      reader.onload = function(e) { resolve(e.target.result); };
      reader.readAsDataURL(fileInput.files[0]);
    });
    res = await patch(dataUrl);
  } else {
    res = await patch(null);
  }
  if (res.error) { showToast('Failed to save changes'); return; }
  showToast('Banner updated!');
  closeEditBanner();
  loadBanners();
}

async function deleteBanner(id) {
  if (!confirm('Delete this banner?')) return;
  await sbFetch(SB_URL + '/rest/v1/expert_banners?id=eq.' + id, { method: 'DELETE', headers: SB_HDRS });
  showToast('Banner deleted');
  loadBanners();
}

// ── CATEGORY PRODUCT MANAGER ─────────────────────────────────────────────────
// "Products" button on each category card: tick/untick products to add or
// remove them from that category. Adding puts the category in the product's
// extra-categories list; removing takes it out. If the category is a product's
// PRIMARY one, removing promotes one of its other categories to primary —
// or is skipped (with a warning) when it has no other category to fall back on.
var _cpSlug = null;
var _cpState = {};   // product id -> currently ticked (true/false)

function openCatProducts(slug) {
  _cpSlug = slug;
  _cpState = {};
  var cat = getAllCats().find(function(c){ return c.slug === slug; });
  document.getElementById('cpTitle').textContent = (cat ? cat.label : slug) + ' — Products';
  document.getElementById('cpSearch').value = '';
  getAllAdminProducts().forEach(function(p) {
    _cpState[p.id] = getProductCatSlugs(p).includes(slug);
  });
  _cpRenderList('');
  document.getElementById('catProdOverlay').classList.add('open');
  setTimeout(function(){ document.getElementById('cpSearch').focus(); }, 100);
}
function closeCatProducts() {
  document.getElementById('catProdOverlay').classList.remove('open');
  _cpSlug = null;
}
function _cpRenderList(q) {
  q = (q || '').toLowerCase();
  var rows = getAllAdminProducts().filter(function(p) {
    return !q || p.name.toLowerCase().includes(q) ||
      getProductSku(p.id).toLowerCase().includes(q) ||
      (typeof getBrand === 'function' && getBrand(p.id).toLowerCase().includes(q));
  }).map(function(p) {
    var ck = !!_cpState[p.id];
    var isPrimary = p.cat === _cpSlug;
    return '<div class="mc-cat-row' + (ck ? ' mc-selected' : '') + '" onclick="cpToggle(this,' + p.id + ')">' +
      '<input type="checkbox"' + (ck ? ' checked' : '') + ' />' +
      '<span class="mc-lbl">' + encodeHtml(p.name) + ' <span style="color:#aaa;font-weight:500;font-size:11px">' + getProductSku(p.id) + '</span></span>' +
      (isPrimary ? '<span class="mc-primary-tag">primary</span>' : '') +
    '</div>';
  }).join('');
  document.getElementById('cpList').innerHTML = rows || '<p style="color:#aaa;font-size:12px;padding:8px 2px">No products match this search.</p>';
}
function cpFilter() { _cpRenderList(document.getElementById('cpSearch').value); }
function cpToggle(row, id) {
  _cpState[id] = !_cpState[id];
  row.classList.toggle('mc-selected', _cpState[id]);
  row.querySelector('input[type="checkbox"]').checked = _cpState[id];
}
async function saveCatProducts() {
  if (!_cpSlug) return;
  var slug = _cpSlug;
  var added = 0, removed = 0, skipped = [];
  var products = getAllAdminProducts();
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var wasMember = getProductCatSlugs(p).includes(slug);
    var nowMember = !!_cpState[p.id];
    if (wasMember === nowMember) continue;

    var extras = getExtraCats(p.id).filter(function(c){ return c !== p.cat; });
    if (nowMember) {
      if (!extras.includes(slug)) extras.push(slug);
      saveExtraCats(p.id, extras);
      added++;
    } else if (p.cat === slug) {
      // Removing the product's primary category — promote another one
      var others = extras.filter(function(c){ return c !== slug; });
      if (!others.length) { skipped.push(p.name); continue; }
      var newPrimary = others[0];
      var r = await sbFetch(SB_URL + '/rest/v1/expert_products?id=eq.' + p.id, {
        method: 'PATCH', headers: SB_HDRS, body: JSON.stringify({ category: newPrimary })
      });
      if (r.error) { skipped.push(p.name); continue; }
      var row = _customProductRows.find(function(x){ return x.id === p.id; });
      if (row) row.category = newPrimary;
      saveExtraCats(p.id, others.filter(function(c){ return c !== newPrimary; }));
      removed++;
    } else {
      saveExtraCats(p.id, extras.filter(function(c){ return c !== slug; }));
      removed++;
    }
  }
  closeCatProducts();
  renderTable();
  var msg = added + ' added, ' + removed + ' removed';
  if (skipped.length) msg += ' — ' + skipped.length + ' skipped (only category: ' + skipped.slice(0,2).join(', ') + (skipped.length > 2 ? '…' : '') + ')';
  showToast(msg);
}

// ── FEATURED PRODUCTS (homepage offers strip) ────────────────────────────────
// Its own full-width tab (not a modal) so it reads like the Inventory table —
// thumbnail, name, SKU, brand, price, description — just without Inventory's
// stock/bulk-action buttons, which don't apply to picking homepage products.
// Admin picks any number of real products (no cap), each optionally with a
// Sale % that discounts its price only in the homepage strip (the product's
// real price everywhere else — cart, checkout, its own page — is untouched).
// Stored in expert_settings key 'featured_offers' as a JSON array of
// { id, sale } objects — array order is also the display order on the
// storefront, and 'sale' is the % off (0/absent = no sale).
var _foItems = []; // ordered array of { id, sale } (pending save)

function _foFind(id) { return _foItems.find(function(x) { return x.id === id; }); }
function _foOfferPrice(price, sale) { return sale > 0 ? price * (1 - sale / 100) : price; }

// ── UNDO / REDO ──────────────────────────────────────────────────────────────
// Mirrors Inventory's stock undo/redo (js/02-helpers.js): a snapshot of
// _foItems is pushed before every mutation (toggle, sale, select-all, bulk
// sale), so Ctrl+Z / Ctrl+Y or the toolbar buttons step back/forward through
// picks and prices without touching the live save until you hit Save.
var _foUndoStack = [];
var _foRedoStack = [];
function _foPushUndo() {
  _foUndoStack.push(JSON.stringify(_foItems));
  if (_foUndoStack.length > 50) _foUndoStack.shift();
  _foRedoStack = [];
  _foSyncUrBtns();
}
function _foSyncUrBtns() {
  var u = document.getElementById('foUndoBtn');
  var r = document.getElementById('foRedoBtn');
  if (u) u.disabled = _foUndoStack.length === 0;
  if (r) r.disabled = _foRedoStack.length === 0;
}
function foUndo() {
  if (!_foUndoStack.length) return;
  _foRedoStack.push(JSON.stringify(_foItems));
  _foItems = JSON.parse(_foUndoStack.pop());
  _foSyncUrBtns();
  _foUpdateCount();
  _foRenderList(document.getElementById('foSearch').value);
  showToast('Undone ↩');
}
function foRedo() {
  if (!_foRedoStack.length) return;
  _foUndoStack.push(JSON.stringify(_foItems));
  _foItems = JSON.parse(_foRedoStack.pop());
  _foSyncUrBtns();
  _foUpdateCount();
  _foRenderList(document.getElementById('foSearch').value);
  showToast('Redone ↪');
}

async function renderFeaturedTab() {
  var res = await sbFetch(SB_URL + '/rest/v1/expert_settings?key=eq.featured_offers&select=value', { headers: SB_HDRS });
  var raw = [];
  if (!res.error && Array.isArray(res.data) && res.data[0] && res.data[0].value) {
    try { raw = JSON.parse(res.data[0].value) || []; } catch(e) {}
  }
  // Older saves stored plain product ids (no sale support yet) — migrate those in-memory.
  _foItems = raw.map(function(x) { return (typeof x === 'number') ? { id: x, sale: 0 } : { id: x.id, sale: x.sale || 0 }; });
  // Undo history doesn't survive a fresh reload from the source of truth.
  _foUndoStack = [];
  _foRedoStack = [];
  _foSyncUrBtns();
  document.getElementById('foSearch').value = '';
  document.getElementById('foCatFilter').value = 'all';
  document.getElementById('foBrandFilter').value = 'all';
  document.getElementById('foCatComboLabel').textContent = 'All Categories';
  document.getElementById('foBrandComboLabel').textContent = 'All Brands';
  _foRenderList('');
  _foUpdateCount();
}
function _foUpdateCount() {
  var el = document.getElementById('foCount');
  if (el) el.textContent = _foItems.length + ' selected';
}
// Products currently matching the search box + category/brand filters —
// shared by rendering, Select All, and the header checkbox's tri-state sync.
function _foFilteredList(q) {
  q = (q || '').toLowerCase();
  var catF   = (document.getElementById('foCatFilter')   || { value: 'all' }).value;
  var brandF = (document.getElementById('foBrandFilter') || { value: 'all' }).value;
  return getAllAdminProducts().filter(function(p) {
    // Can't Find Products is unverified/unconfirmed catalog data (see the
    // catalog-audit category) — it should never be pickable for the
    // homepage offers strip, and excluding it here means Select All can't
    // pull it in either, since that operates on this same filtered list.
    if (p.cat === 'cant-find-products') return false;
    var matchesQ = !q || p.name.toLowerCase().includes(q) ||
      getProductSku(p.id).toLowerCase().includes(q) ||
      (typeof getBrand === 'function' && getBrand(p.id).toLowerCase().includes(q));
    var matchesCat   = catF === 'all'   || p.cat === catF;
    var matchesBrand = brandF === 'all' || getBrand(p.id) === brandF;
    return matchesQ && matchesCat && matchesBrand;
  });
}
function _foRenderList(q) {
  var photos = JSON.parse(localStorage.getItem('jain_photos') || '{}');
  var list = _foFilteredList(q);
  // Typo tolerance: try the closest real spelling before giving up.
  var correctedFrom = null;
  if (!list.length && q) {
    var suggestion = _adminDidYouMean(q, function(corrected) { return _foFilteredList(corrected).length > 0; });
    if (suggestion) { list = _foFilteredList(suggestion); correctedFrom = suggestion; }
  }
  var rows = list.map(function(p) {
    var item = _foFind(p.id);
    var ck = !!item;
    var sale = item ? item.sale : 0;
    var rawPh = photos[p.id];
    var thumb = (rawPh && (rawPh.startsWith('http') || rawPh.startsWith('data:'))) ? rawPh : (p.img || NO_IMG);
    var brand = (typeof getBrand === 'function' ? getBrand(p.id) : '') || '';
    var priceCell = sale > 0
      ? '<div><div style="text-decoration:line-through;color:#aaa;font-size:11px">' + p.price.toFixed(3) + '</div>' +
        '<div class="price-cell" style="color:var(--red)">' + _foOfferPrice(p.price, sale).toFixed(3) + '</div></div>'
      : '<span class="price-cell">' + p.price.toFixed(3) + '</span>';
    var saleCell = '<div style="display:flex;align-items:center;gap:5px" onclick="event.stopPropagation()">' +
      '<input type="number" min="0" max="95" placeholder="—" value="' + (sale > 0 ? sale : '') + '" ' +
        'style="width:54px;padding:6px 7px;border:1.5px solid var(--border);border-radius:6px;font-size:12px;text-align:center;font-family:inherit" ' +
        'onchange="foSetSale(' + p.id + ',this.value)" />' +
      '<span style="font-size:11px;color:var(--gray)">%</span>' +
      (sale > 0 ? '<button onclick="foSetSale(' + p.id + ',0)" title="Clear sale" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:12px;padding:2px"><i class="fa fa-times"></i></button>' : '') +
    '</div>';
    // Drag handle only does anything for items already in the strip — order
    // only matters once something's actually featured, and dragging an
    // unfeatured row would just reorder ids that aren't in _foItems at all.
    var dragAttrs = ck
      ? 'draggable="true" ondragstart="foDragStart(event,' + p.id + ')" ondragend="foDragEnd(event)" ondragover="foDragOver(event)" ondragleave="foDragLeave(event)" ondrop="foDrop(event,' + p.id + ')"'
      : '';
    var dragHandle = ck
      ? '<i class="fa fa-grip-vertical" style="color:#ccc;cursor:grab" title="Drag to reorder"></i>'
      : '';
    return '<tr class="' + (ck ? 'fo-row-selected' : '') + '" ' + dragAttrs + ' onclick="foToggle(this,' + p.id + ')" style="cursor:pointer">' +
      '<td class="chk-col" onclick="event.stopPropagation()" style="cursor:default">' + dragHandle + '</td>' +
      '<td class="chk-col"><input type="checkbox" style="pointer-events:none"' + (ck ? ' checked' : '') + ' /></td>' +
      '<td><div style="display:flex;align-items:center;gap:11px">' +
        '<img class="prod-img" src="' + thumb + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=NO_IMG" />' +
        '<div><div class="prod-name">' + encodeHtml(p.name) + '</div><div class="prod-sku">' + getProductSku(p.id) + '</div></div>' +
      '</div></td>' +
      '<td>' + encodeHtml(brand) + '</td>' +
      '<td>' + priceCell + '</td>' +
      '<td>' + saleCell + '</td>' +
      '<td style="max-width:320px;color:var(--gray);font-size:12px;font-weight:500">' + (p.desc ? encodeHtml(p.desc) : '') + '</td>' +
    '</tr>';
  }).join('');
  var correctionRow = correctedFrom
    ? '<tr class="search-correction-row"><td colspan="7"><i class="fa fa-info-circle"></i> Showing results for "'+encodeHtml(correctedFrom)+'" instead of "'+encodeHtml(q)+'"</td></tr>'
    : '';
  document.getElementById('foTblBody').innerHTML = correctionRow + (rows || '<tr><td colspan="7" style="color:#aaa;padding:20px;text-align:center">No products match this search.</td></tr>');
  var nSel = list.filter(function(p) { return !!_foFind(p.id); }).length;
  var allSelected = list.length > 0 && nSel === list.length;
  var saChk = document.getElementById('foSelectAll');
  if (saChk) {
    saChk.checked = allSelected;
    saChk.indeterminate = nSel > 0 && nSel < list.length;
  }
  var saBtn = document.getElementById('foSelectAllBtn');
  if (saBtn) saBtn.innerHTML = '<i class="fa fa-check-square"></i> ' + (allSelected ? 'Unselect All' : 'Select All');
  var bulkCount = document.getElementById('foBulkCount');
  if (bulkCount) bulkCount.textContent = nSel + ' selected here';
}
function foFilter() { _foRenderList(document.getElementById('foSearch').value); }
// Same lag as the inventory search — _foRenderList rebuilds the whole
// filtered product list on every keystroke, so debounce it too.
var _foFilterDebounceTimer;
function debouncedFoFilter() {
  clearTimeout(_foFilterDebounceTimer);
  _foFilterDebounceTimer = setTimeout(foFilter, 180);
}

// ── SELECT ALL / UNSELECT ALL (respects the search + category/brand filters;
// no cap) — a real toggle: if everything currently shown is already
// featured, this removes all of them; otherwise it features whatever's
// missing. The header checkbox and toolbar button (label flips between
// "Select All" / "Unselect All") both read this same all-selected state.
function foToggleSelectAll() {
  var q = document.getElementById('foSearch').value;
  var list = _foFilteredList(q);
  if (!list.length) return;
  var allSelected = list.every(function(p) { return !!_foFind(p.id); });
  _foPushUndo();
  if (allSelected) {
    var ids = new Set(list.map(function(p) { return p.id; }));
    _foItems = _foItems.filter(function(x) { return !ids.has(x.id); });
  } else {
    list.filter(function(p) { return !_foFind(p.id); }).forEach(function(p) { _foItems.push({ id: p.id, sale: 0 }); });
  }
  _foUpdateCount();
  _foRenderList(q);
}
// Toolbar button — same as ticking the header checkbox.
function foSelectAllVisible() {
  foToggleSelectAll();
}

// ── BULK SALE (applies to whatever the search/category/brand filters + your
// selection currently show — search for a group, Select All, then set one
// Sale % for all of them here instead of typing it into every row) ───────────
function foApplyBulkSale() {
  var pct = Math.max(0, Math.min(95, parseInt(document.getElementById('foBulkSale').value, 10) || 0));
  var q = document.getElementById('foSearch').value;
  var visibleIds = new Set(_foFilteredList(q).map(function(p) { return p.id; }));
  var matches = _foItems.filter(function(item) { return visibleIds.has(item.id); });
  if (!matches.length) { showToast('No selected products match the current search/filters'); return; }
  _foPushUndo();
  matches.forEach(function(item) { item.sale = pct; });
  _foRenderList(q);
  showToast('Applied ' + pct + '% sale to ' + matches.length + ' product' + (matches.length === 1 ? '' : 's'));
}
function foClearBulkSale() {
  var q = document.getElementById('foSearch').value;
  var visibleIds = new Set(_foFilteredList(q).map(function(p) { return p.id; }));
  var matches = _foItems.filter(function(item) { return visibleIds.has(item.id) && item.sale > 0; });
  if (matches.length) {
    _foPushUndo();
    matches.forEach(function(item) { item.sale = 0; });
  }
  document.getElementById('foBulkSale').value = '';
  _foRenderList(q);
  showToast(matches.length ? ('Cleared sale from ' + matches.length + ' product' + (matches.length === 1 ? '' : 's')) : 'Nothing to clear');
}

// Search/filter for a group (e.g. brand=Makita), Select All to feature
// them, then this instead of dragging each one to the front by hand.
// Only reorders — anything matching the search/filter that isn't already
// featured is left alone, same as Apply/Clear Sale above.
function foMoveSelectedToFirst() {
  var q = document.getElementById('foSearch').value;
  var matchIds = _foFilteredList(q).map(function(p) { return p.id; });
  var idSet = new Set(matchIds);
  var toMove = _foItems.filter(function(item) { return idSet.has(item.id); });
  if (!toMove.length) { showToast('Nothing selected here is currently featured'); return; }
  _foPushUndo();
  var rest = _foItems.filter(function(item) { return !idSet.has(item.id); });
  // Keep the matched items in whatever order they were already in, just
  // move that whole block to the front rather than shuffling it further.
  _foItems = toMove.concat(rest);
  _foRenderList(q);
  showToast('Moved ' + toMove.length + ' product' + (toMove.length === 1 ? '' : 's') + ' to first');
}

// ── CATEGORY + BRAND FILTER DROPDOWNS (Featured tab) ──────────────────────────
// Parallel to Inventory's fcToggle/fcRenderList/fcPick (js/10-csv-import.js)
// but scoped to this tab's own combo ids so the two tabs' filters don't clash;
// fcCloseAll() there is generic (any open .fc-panel) so it still closes these.
var _foFcOptions = { cat: [], brand: [] };
var _foFcVisible = { cat: [], brand: [] };
function _foFcIds(kind) {
  var cap = kind === 'cat' ? 'Cat' : 'Brand';
  return { combo: 'fo' + cap + 'Combo', panel: 'fo' + cap + 'ComboPanel', search: 'fo' + cap + 'ComboSearch', list: 'fo' + cap + 'ComboList', label: 'fo' + cap + 'ComboLabel', hidden: kind === 'cat' ? 'foCatFilter' : 'foBrandFilter' };
}
function _foFcRebuild(kind) {
  if (kind === 'cat') {
    // Can't Find Products is excluded from the picker itself (see
    // _foFilteredList) — leaving it selectable here would offer a category
    // that always resolves to zero results, no different than a brand whose
    // only products all happen to be Can't Find Products (fixed below).
    _foFcOptions.cat = [{ value: 'all', label: 'All Categories' }].concat(
      getAllCats().filter(function(c) { return c.slug !== 'cant-find-products'; }).map(function(c) { return { value: c.slug, label: c.label }; }));
  } else {
    // Brands are collected only from products that can actually appear in
    // this list — otherwise a brand whose entire catalog sits in Can't Find
    // Products (e.g. DCK/DCA, an early unverified import batch) shows up as
    // a selectable option that silently returns zero results every time.
    var brands = {};
    getAllAdminProducts().forEach(function(p) {
      if (p.cat === 'cant-find-products') return;
      var b = getBrand(p.id); if (b) brands[b] = true;
    });
    _foFcOptions.brand = [{ value: 'all', label: 'All Brands' }].concat(
      Object.keys(brands).sort(function(a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); })
        .map(function(b) { return { value: b, label: b }; }));
  }
}
function foFcToggle(kind) {
  var ids = _foFcIds(kind);
  var panel = document.getElementById(ids.panel);
  var wasOpen = panel.classList.contains('open');
  fcCloseAll();
  if (wasOpen) return;
  _foFcRebuild(kind);
  document.getElementById(ids.search).value = '';
  foFcRenderList(kind, '');
  panel.classList.add('open');
  setTimeout(function() { document.getElementById(ids.search).focus(); }, 60);
}
function foFcRenderList(kind, q) {
  q = (q || '').toLowerCase();
  var ids = _foFcIds(kind);
  var cur = document.getElementById(ids.hidden).value;
  _foFcVisible[kind] = _foFcOptions[kind].filter(function(o) { return !q || o.label.toLowerCase().includes(q); });
  document.getElementById(ids.list).innerHTML = _foFcVisible[kind].length
    ? _foFcVisible[kind].map(function(o, i) {
        return '<div class="fc-opt' + (o.value === cur ? ' sel' : '') + '" onclick="foFcPick(\'' + kind + '\',' + i + ')">' +
          encodeHtml(o.label) + (o.value === cur ? ' <i class="fa fa-check"></i>' : '') + '</div>';
      }).join('')
    : '<div class="fc-empty">No matches</div>';
}
function foFcFilterList(kind) { foFcRenderList(kind, document.getElementById(_foFcIds(kind).search).value); }
function foFcPick(kind, i) {
  var o = _foFcVisible[kind][i];
  if (o) foFcSet(kind, o.value, o.label);
}
function foFcSet(kind, value, label) {
  var ids = _foFcIds(kind);
  document.getElementById(ids.hidden).value = value;
  document.getElementById(ids.label).textContent = value === 'all' ? (kind === 'cat' ? 'All Categories' : 'All Brands') : (label || value);
  fcCloseAll();
  foFilter();
}
function foToggle(row, id) {
  _foPushUndo();
  var idx = _foItems.findIndex(function(x) { return x.id === id; });
  if (idx === -1) {
    _foItems.push({ id: id, sale: 0 });
  } else {
    _foItems.splice(idx, 1);
  }
  _foUpdateCount();
  _foRenderList(document.getElementById('foSearch').value);
}

// ── DRAG-TO-REORDER (Featured tab) ──────────────────────────────────────────
// _foItems' array order IS the storefront ticker's display order (see the
// comment above _foItems' declaration), so this reorders the real thing, not
// just how the admin table happens to be sorted. Only featured rows are
// draggable (see the ck check in _foRenderList) — reordering something not
// in the strip yet wouldn't mean anything.
var _foDragId = null;
function foDragStart(e, id) {
  _foDragId = id;
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('fo-dragging');
}
function foDragEnd(e) {
  e.currentTarget.classList.remove('fo-dragging');
  _foDragId = null;
}
function foDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('fo-drag-over');
}
function foDragLeave(e) {
  e.currentTarget.classList.remove('fo-drag-over');
}
function foDrop(e, targetId) {
  e.preventDefault();
  e.currentTarget.classList.remove('fo-drag-over');
  if (_foDragId === null || _foDragId === targetId) return;
  var from = _foItems.findIndex(function(x) { return x.id === _foDragId; });
  var to   = _foItems.findIndex(function(x) { return x.id === targetId; });
  if (from === -1 || to === -1) return;
  _foPushUndo();
  var moved = _foItems.splice(from, 1)[0];
  _foItems.splice(to, 0, moved);
  _foRenderList(document.getElementById('foSearch').value);
}
// Setting a sale % on a product that isn't featured yet features it first —
// a sale price only means anything if it's actually shown in the strip.
function foSetSale(id, rawVal) {
  _foPushUndo();
  var pct = Math.max(0, Math.min(95, parseInt(rawVal, 10) || 0));
  var item = _foFind(id);
  if (!item) {
    item = { id: id, sale: 0 };
    _foItems.push(item);
  }
  item.sale = pct;
  _foUpdateCount();
  _foRenderList(document.getElementById('foSearch').value);
}
async function saveFeaturedOffers() {
  var r = await sbFetch(SB_URL + '/rest/v1/expert_settings', {
    method: 'POST',
    headers: Object.assign({}, SB_HDRS, { 'Prefer': 'resolution=merge-duplicates' }),
    body: JSON.stringify([{ key: 'featured_offers', value: JSON.stringify(_foItems) }])
  });
  if (r.error) { showToast('Failed to save — check Supabase expert_settings table'); return; }
  showToast('Featured products saved!');
}

