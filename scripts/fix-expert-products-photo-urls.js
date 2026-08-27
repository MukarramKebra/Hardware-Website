// Emergency fix: expert_photos.img_url stored absolute URLs pointing at the
// old "expert products" folder (URL-encoded as expert%20products). Renaming
// that folder to expert-products (see the asset-reorg commit) 404'd every
// one of these. This rewrites them in place to the new path.
//
// Run with: node scripts/fix-expert-products-photo-urls.js [--dry-run]

const SB_URL = 'https://qhebhvllkovfbkqrcnmm.supabase.co';
const SB_KEY = Buffer.from('c2JfcHVibGlzaGFibGVfakN3cnAteTE2VFdWblg4QWszcjFtd19laEtBU2lwZA==', 'base64').toString('utf8');
const HEADERS = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
const DRY_RUN = process.argv.includes('--dry-run');

async function fetchAllPhotos() {
  let all = [], offset = 0;
  while (true) {
    const r = await fetch(`${SB_URL}/rest/v1/expert_photos?select=product_id,img_url&limit=1000&offset=${offset}`, { headers: HEADERS });
    const d = await r.json();
    all = all.concat(d);
    if (d.length < 1000) break;
    offset += 1000;
  }
  return all;
}

(async () => {
  const all = await fetchAllPhotos();
  const affected = all.filter(r => r.img_url && (r.img_url.includes('expert%20products') || r.img_url.includes('expert products')));
  console.log(`Found ${affected.length} of ${all.length} expert_photos rows referencing the old folder name.`);

  if (DRY_RUN) {
    console.log('--dry-run set, not writing. Sample fixes:');
    affected.slice(0, 3).forEach(r => {
      const fixed = r.img_url.replace(/expert(%20| )products/g, 'expert-products');
      console.log(r.product_id, r.img_url, '->', fixed);
    });
    return;
  }

  let fixed = 0, failed = 0;
  // Small batches in parallel so this doesn't take forever, but not so many
  // concurrent requests that Supabase rate-limits us.
  const BATCH = 20;
  for (let i = 0; i < affected.length; i += BATCH) {
    const batch = affected.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(async (r) => {
      const newUrl = r.img_url.replace(/expert(%20| )products/g, 'expert-products');
      const res = await fetch(`${SB_URL}/rest/v1/expert_photos?product_id=eq.${r.product_id}`, {
        method: 'PATCH',
        headers: { ...HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ img_url: newUrl }),
      });
      return res.ok;
    }));
    fixed += results.filter(Boolean).length;
    failed += results.filter(x => !x).length;
    console.log(`  ${Math.min(i + BATCH, affected.length)}/${affected.length}...`);
  }
  console.log(`Fixed ${fixed} rows${failed ? `, ${failed} failed` : ''}.`);
})();
