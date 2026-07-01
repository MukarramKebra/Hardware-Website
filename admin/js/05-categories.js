// ── CATEGORY EDITOR ────────────────────────────────────────────────────────────
// CAT_DEFS = the list of categories with their name, icon, and default background image.
// renderCatEditor() draws the grid of category cards in the Categories tab.
// saveCatBg()  — saves a new background image when you click "Change Image"
// resetCatBg() — puts the default image back
var CAT_DEFS = [
  { slug:'power-tools',  label:'Power Tools',       icon:'fa-bolt',      default:'Bahar-Products/SKU-0001.jpg' },
  { slug:'hand-tools',   label:'Hand Tools',        icon:'fa-hammer',    default:'Bahar-Products/SKU-0011.jpg' },
  { slug:'fasteners',    label:'Fasteners',         icon:'fa-cog',       default:'Bahar-Products/SKU-0024.jpg' },
  { slug:'measuring',    label:'Measuring',         icon:'fa-ruler',     default:'Bahar-Products/SKU-0031.jpg' },
  { slug:'safety',       label:'Safety',            icon:'fa-hard-hat',  default:'Bahar-Products/SKU-0040.jpg' },
  { slug:'cutting',      label:'Cutting Tools',     icon:'fa-cut',       default:'Bahar-Products/SKU-0043.jpg' },
  { slug:'accessories',  label:'Accessories',       icon:'fa-toolbox',   default:'Bahar-Products/SKU-0048.jpg' },
  { slug:'all',          label:'All Products',      icon:'fa-th-large',  default:'Bahar-Products/SKU-0015.jpg' }
];

function renderCatEditor() {
  var bgs = {};
  try { bgs = JSON.parse(localStorage.getItem('jain_cat_bgs') || '{}'); } catch(e) {}
  var grid = document.getElementById('catEditGrid');
  if (!grid) return;
  grid.innerHTML = CAT_DEFS.map(function(cat) {
    var img = bgs[cat.slug] || cat.default;
    return '<div style="background:#fff;border:1px solid #e2e4e8;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.07)">' +
      '<div style="height:150px;background:url(\'' + img + '\') center/cover no-repeat;position:relative">' +
        '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center">' +
          '<i class="fa ' + cat.icon + '" style="color:#fff;font-size:32px"></i>' +
        '</div>' +
      '</div>' +
      '<div style="padding:12px 14px">' +
        '<div style="font-weight:800;font-size:13px;color:#1c1c1c;margin-bottom:10px">' + cat.label + '</div>' +
        '<label style="display:block;background:var(--orange);color:#fff;text-align:center;padding:8px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700">' +
          '<i class="fa fa-image"></i> Change Image' +
          '<input type="file" accept="image/*" style="display:none" onchange="saveCatBg(\'' + cat.slug + '\',this)" />' +
        '</label>' +
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

