// ── SEO SETTINGS ─────────────────────────────────────────────────────────────
// Lets the owner/admin edit the site's Google search title/description/keywords
// without touching code. Stored in Supabase (expert_settings, key 'seo_settings')
// and read by the storefront on every page load — same key-value pattern already
// used for sku_map / brand_map / site_disabled.
var _seoDefaults = {
  title: 'Expert Hardware Kuwait | Hand & Power Tools, DCK, TOLSEN, Dremel, INGCO, Stanley & More',
  description: 'Expert Hardware for Wholesale and Retail Trade — Kuwait City hardware store selling hand tools, power tools, welding machines, fasteners, safety gear, adhesives and more from DCK, TOLSEN, Dremel, INGCO, Stanley, Total, HARDEN, DCA, Makita and other trusted brands. Same-day delivery in Kuwait City.',
  keywords: 'hardware store Kuwait, hand tools Kuwait, power tools Kuwait, DCK tools Kuwait, TOLSEN Kuwait, Dremel Kuwait, INGCO Kuwait, Stanley tools Kuwait, Total tools Kuwait, Makita Kuwait, Milwaukee Kuwait, HARDEN tools Kuwait, welding machine Kuwait, MIG welder Kuwait, ARC welder Kuwait, TIG welding Kuwait, inverter welder Kuwait, welding mask Kuwait, welding goggles Kuwait, welding electrodes Kuwait, welding supplies Kuwait, electrode holder Kuwait, earth clamp Kuwait, safety equipment Kuwait, fasteners Kuwait, screws and bolts Kuwait, hole saw Kuwait, rotary tool bits Kuwait, router bits Kuwait, sanding discs Kuwait, sandpaper Kuwait, abrasive belt Kuwait, wire brush Kuwait, cut-off wheel Kuwait, diamond cutting blade Kuwait, VDE insulated tools Kuwait, insulated pliers Kuwait, electrician tools Kuwait, grease gun Kuwait, hand riveter Kuwait, diamond core bit Kuwait, utility knife blades Kuwait, PPR pipe welding Kuwait, plastic welding machine Kuwait, glass cutter Kuwait, block plane Kuwait, bench vice Kuwait, clamps Kuwait, bar clamp Kuwait, G clamp Kuwait, tool bag Kuwait, tool box Kuwait, tool storage Kuwait, soldering iron Kuwait, glue sticks Kuwait, wholesale hardware Kuwait, retail hardware Kuwait, tool shop Kuwait, Kuwait City hardware, hardware store near me Kuwait, construction tools Kuwait, workshop tools Kuwait, Expert Hardware Kuwait'
};

async function loadSEOSettings() {
  var res = await sbFetch(SB_URL + '/rest/v1/expert_settings?key=eq.seo_settings&select=value', { headers: SB_HDRS });
  var seo = _seoDefaults;
  if (!res.error && Array.isArray(res.data) && res.data[0] && res.data[0].value) {
    try { seo = Object.assign({}, _seoDefaults, JSON.parse(res.data[0].value)); } catch(e) {}
  }
  document.getElementById('seoTitle').value = seo.title;
  document.getElementById('seoDescription').value = seo.description;
  document.getElementById('seoKeywords').value = seo.keywords;
  _seoUpdateCounts();
}

function _seoUpdateCounts() {
  var title = document.getElementById('seoTitle').value;
  var desc  = document.getElementById('seoDescription').value;
  document.getElementById('seoTitleCount').textContent = title.length + '/60 recommended';
  document.getElementById('seoDescCount').textContent  = desc.length + '/160 recommended';
  document.getElementById('seoPreviewTitle').textContent = title || 'Page title preview';
  document.getElementById('seoPreviewDesc').textContent  = desc || 'Description preview will appear here as you type.';
}

async function saveSEOSettings() {
  var title = document.getElementById('seoTitle').value.trim();
  var description = document.getElementById('seoDescription').value.trim();
  var keywords = document.getElementById('seoKeywords').value.trim();
  if (!title || !description) { showToast('Title and description are required'); return; }
  var value = JSON.stringify({ title: title, description: description, keywords: keywords });
  var res = await sbFetch(SB_URL + '/rest/v1/expert_settings', {
    method: 'POST',
    headers: Object.assign({}, SB_HDRS, { 'Prefer': 'resolution=merge-duplicates' }),
    body: JSON.stringify([{ key: 'seo_settings', value: value }])
  });
  showToast(res.error ? 'Failed to save SEO settings' : 'SEO settings saved — live on the site now ✅');
}

// ── PER-PRODUCT SEO (description + keywords) ─────────────────────────────────
// Description shows in the product popup and feeds the Product structured
// data Google reads (see _injectProductSchema in js/02-catalog-render.js).
// Keywords are distinct search phrases for THIS product (e.g. "21mm hole saw
// Kuwait", "buy TOLSEN hole saw Kuwait") on top of the sitewide keyword list —
// they also feed the storefront's own search matching. Both are editable any
// time from the Inventory tab, not just when the product is added.
var _seoProdId = null;
function openProductSEO(id) {
  var p = getAllAdminProducts().find(function(x){ return x.id === id; });
  if (!p) return;
  _seoProdId = id;
  document.getElementById('seoProdName').textContent = '#' + id + ' — ' + p.name;
  document.getElementById('seoProdDesc').value = p.desc || '';
  document.getElementById('seoProdDescCount').textContent = (p.desc || '').length + ' characters';
  document.getElementById('seoProdKeywords').value = (window._sbProductKeywords || {})[id] || '';
  document.getElementById('seoProdOverlay').classList.add('open');
}
function closeProductSEO() {
  document.getElementById('seoProdOverlay').classList.remove('open');
  _seoProdId = null;
}
async function saveProductSEO() {
  if (!_seoProdId) return;
  var desc = document.getElementById('seoProdDesc').value.trim();
  var keywords = document.getElementById('seoProdKeywords').value.trim();
  var res = await sbFetch(SB_URL + '/rest/v1/expert_products?id=eq.' + _seoProdId, {
    method: 'PATCH', headers: SB_HDRS, body: JSON.stringify({ description: desc })
  });
  if (res.error) { showToast('Failed to save'); return; }
  var row = _customProductRows.find(function(r){ return r.id === _seoProdId; });
  if (row) row.description = desc;

  if (!window._sbProductKeywords) window._sbProductKeywords = {};
  window._sbProductKeywords[_seoProdId] = keywords;
  await sbFetch(SB_URL + '/rest/v1/expert_settings', {
    method: 'POST', headers: Object.assign({}, SB_HDRS, { 'Prefer': 'resolution=merge-duplicates' }),
    body: JSON.stringify([{ key: 'product_keywords', value: JSON.stringify(window._sbProductKeywords) }])
  });
  showToast('Product SEO saved ✅');
  closeProductSEO();
  // keep the SEO tab's product list in sync if it's the active view
  if (document.getElementById('seoSection').style.display !== 'none') renderSEOProducts();
}

// ── SEO TAB PRODUCT LIST ─────────────────────────────────────────────────────
// Every product with just its description/keyword status and an Edit button —
// so all SEO editing happens in this tab without hunting through Inventory's
// row menus. Reuses openProductSEO(), the same editor the Inventory tab uses.
function renderSEOProducts() {
  var body = document.getElementById('seoProdBody');
  if (!body) return;
  var q = (document.getElementById('seoProdSearch').value || '').toLowerCase().trim();
  var photos = {};
  try { photos = JSON.parse(localStorage.getItem('jain_photos') || '{}'); } catch(e) {}
  var list = getAllAdminProducts().filter(function(p) {
    return !q || p.name.toLowerCase().indexOf(q) !== -1 || getProductSku(p.id).toLowerCase().indexOf(q) !== -1;
  });
  body.innerHTML = list.map(function(p) {
    var desc = p.desc || '';
    var kw   = (window._sbProductKeywords || {})[p.id] || '';
    var ph   = photos[p.id];
    var thumb = (ph && (ph.indexOf('http') === 0 || ph.indexOf('data:') === 0)) ? ph : '';
    return '<tr>' +
      '<td>' + (thumb ? '<img class="prod-img" src="' + thumb + '" loading="lazy" onerror="this.style.opacity=0.3" />' : '<div class="prod-img" style="background:var(--light)"></div>') + '</td>' +
      '<td><div class="prod-name">' + encodeHtml(p.name) + '</div><div class="prod-sku">' + getProductSku(p.id) + '</div></td>' +
      '<td><span class="cat-pill">' + encodeHtml((function(){ var s = (getProductCatSlugs(p)[0]) || ''; var m = getAllCats().find(function(c){ return c.slug === s; }); return m ? m.label : (s ? s.replace(/-/g, ' ') : '—'); })()) + '</span></td>' +
      '<td style="max-width:340px">' + (desc
        ? '<span style="font-size:12px;color:var(--gray);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px" title="' + encodeHtml(desc) + '">' + encodeHtml(desc) + '</span>'
        : '<span style="color:var(--red);font-size:11px;font-weight:700"><i class="fa fa-exclamation-triangle"></i> Missing</span>') + '</td>' +
      '<td>' + (kw
        ? '<span style="color:var(--green);font-size:11px;font-weight:700"><i class="fa fa-check"></i> ' + kw.split(',').length + '</span>'
        : '<span style="color:#b45309;font-size:11px;font-weight:700">None</span>') + '</td>' +
      '<td><button class="act-btn" style="background:#eef2ff;color:#4338ca;border-color:#c7d2fe" onclick="openProductSEO(' + p.id + ')"><i class="fa fa-edit"></i> Edit</button></td>' +
    '</tr>';
  }).join('') || '<tr><td colspan="6" style="padding:24px;text-align:center;color:var(--gray)">No products match your search.</td></tr>';
}
