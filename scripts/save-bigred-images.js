// One-off maintenance script: saves the 50 Big Red product photos, currently
// stored only as base64 in Supabase (expert_photos), out to local files at
// expert-products/big-red/<product_id>.jpg — a local backup/archive copy.
// Doesn't change how the storefront serves these (still Supabase), purely
// for having them as real files on disk.
//
// Run with: node scripts/save-bigred-images.js

const fs = require('fs');
const path = require('path');

const SB_URL = 'https://qhebhvllkovfbkqrcnmm.supabase.co';
const SB_KEY = Buffer.from('c2JfcHVibGlzaGFibGVfakN3cnAteTE2VFdWblg4QWszcjFtd19laEtBU2lwZA==', 'base64').toString('utf8');
const HEADERS = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
const OUT_DIR = path.resolve(__dirname, '..', 'expert-products', 'big-red');

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const bigRed = await fetch(`${SB_URL}/rest/v1/expert_products?category=eq.big-red&select=id,name`, { headers: HEADERS }).then(r => r.json());
  console.log(`Found ${bigRed.length} Big Red products.`);

  const ids = bigRed.map(p => p.id);
  const photos = await fetch(`${SB_URL}/rest/v1/expert_photos?product_id=in.(${ids.join(',')})&select=product_id,img_url`, { headers: HEADERS }).then(r => r.json());
  const photoById = {};
  photos.forEach(p => { photoById[p.product_id] = p.img_url; });

  let saved = 0, missing = 0;
  bigRed.forEach(p => {
    const dataUrl = photoById[p.id];
    if (!dataUrl || !dataUrl.startsWith('data:image')) { console.warn(`  no photo for ${p.id} (${p.name})`); missing++; return; }
    const m = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!m) { console.warn(`  unrecognized data URL for ${p.id}`); missing++; return; }
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const buf = Buffer.from(m[2], 'base64');
    fs.writeFileSync(path.join(OUT_DIR, `${p.id}.${ext}`), buf);
    saved++;
  });

  console.log(`Saved ${saved} images to ${OUT_DIR}${missing ? `, ${missing} missing` : ''}.`);
})();
