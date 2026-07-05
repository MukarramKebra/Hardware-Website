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
