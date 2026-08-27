// marhaba-products/ moved into expert-products/marhaba-products/ — fixes the
// 45 expert_products.img_url rows that pointed at the old top-level path.
//
// Run with: node scripts/fix-marhaba-photo-urls.js [--dry-run]

const SB_URL = 'https://qhebhvllkovfbkqrcnmm.supabase.co';
const SB_KEY = Buffer.from('c2JfcHVibGlzaGFibGVfakN3cnAteTE2VFdWblg4QWszcjFtd19laEtBU2lwZA==', 'base64').toString('utf8');
const HEADERS = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
const DRY_RUN = process.argv.includes('--dry-run');

async function fetchAll(table, select) {
  let all = [], offset = 0;
  while (true) {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?select=${select}&limit=1000&offset=${offset}`, { headers: HEADERS });
    const d = await r.json();
    all = all.concat(d);
    if (d.length < 1000) break;
    offset += 1000;
  }
  return all;
}

(async () => {
  const products = await fetchAll('expert_products', 'id,img_url');
  const affected = products.filter(r => r.img_url && r.img_url.includes('/marhaba-products/') && !r.img_url.includes('/expert-products/marhaba-products/'));
  console.log(`Found ${affected.length} expert_products rows referencing the old marhaba-products path.`);

  if (DRY_RUN) {
    affected.slice(0, 3).forEach(r => {
      const fixed = r.img_url.replace('/marhaba-products/', '/expert-products/marhaba-products/');
      console.log(r.id, r.img_url, '->', fixed);
    });
    return;
  }

  let fixed = 0, failed = 0;
  for (const r of affected) {
    const newUrl = r.img_url.replace('/marhaba-products/', '/expert-products/marhaba-products/');
    const res = await fetch(`${SB_URL}/rest/v1/expert_products?id=eq.${r.id}`, {
      method: 'PATCH',
      headers: { ...HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ img_url: newUrl }),
    });
    if (res.ok) fixed++; else failed++;
  }
  console.log(`Fixed ${fixed} rows${failed ? `, ${failed} failed` : ''}.`);
})();
