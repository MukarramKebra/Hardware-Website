// Read-only comparison: expertshardware.com's live catalog vs our
// expert_products table. Reports what's on their site but not ours, and
// what's ours but not on their site — no writes anywhere. Explicitly
// excludes Big Red and Generators/marhaba from the "ours but not theirs"
// list (per owner instruction: those aren't from that site, don't touch).
//
// Run with: node scripts/audit-vs-expertshardware.js

const SB_URL = 'https://qhebhvllkovfbkqrcnmm.supabase.co';
const SB_KEY = Buffer.from('c2JfcHVibGlzaGFibGVfakN3cnAteTE2VFdWblg4QWszcjFtd19laEtBU2lwZA==', 'base64').toString('utf8');
const HEADERS = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
const PROTECTED_CATS = new Set(['big-red', 'marhaba']);

function norm(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchTheirCatalog() {
  let items = [], page = 1;
  const pageSize = 200;
  while (true) {
    const query = `{ products(filter: {category_id: {eq: "2"}}, pageSize: ${pageSize}, currentPage: ${page}) { total_count items { sku name } } }`;
    const res = await fetch('https://expertshardware.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const j = await res.json();
    const batch = j.data.products.items;
    items = items.concat(batch);
    if (items.length >= j.data.products.total_count || batch.length === 0) break;
    page++;
  }
  return items;
}

async function fetchOurCatalog() {
  let all = [], offset = 0;
  while (true) {
    const res = await fetch(`${SB_URL}/rest/v1/expert_products?select=id,name,category&limit=1000&offset=${offset}`, { headers: HEADERS });
    const batch = await res.json();
    all = all.concat(batch);
    if (batch.length < 1000) break;
    offset += 1000;
  }
  return all;
}

(async () => {
  console.log('Fetching expertshardware.com catalog...');
  const theirs = await fetchTheirCatalog();
  console.log(`  ${theirs.length} products found on their site.`);

  console.log('Fetching our catalog...');
  const ours = await fetchOurCatalog();
  console.log(`  ${ours.length} products found in our database.`);

  const theirNames = new Set(theirs.map(p => norm(p.name)));
  const ourNames = new Set(ours.map(p => norm(p.name)));

  // Ours, but not on their site — excluding protected categories entirely.
  const oursNotTheirs = ours.filter(p => !PROTECTED_CATS.has(p.category) && !theirNames.has(norm(p.name)));
  // Theirs, but not in ours.
  const theirsNotOurs = theirs.filter(p => !ourNames.has(norm(p.name)));

  console.log(`\n=== On our site but NOT found on expertshardware.com: ${oursNotTheirs.length} (excluding big-red/marhaba) ===`);
  const byCat = {};
  oursNotTheirs.forEach(p => { byCat[p.category] = (byCat[p.category] || 0) + 1; });
  console.log('By category:', JSON.stringify(byCat, null, 2));

  console.log(`\n=== On expertshardware.com but NOT found in our catalog: ${theirsNotOurs.length} ===`);

  require('fs').writeFileSync(
    require('path').join(__dirname, '..', '.audit-vs-expertshardware.json'),
    JSON.stringify({
      theirTotal: theirs.length,
      ourTotal: ours.length,
      oursNotTheirs: oursNotTheirs.map(p => ({ id: p.id, name: p.name, category: p.category })),
      theirsNotOurs: theirsNotOurs.map(p => ({ sku: p.sku, name: p.name })),
    }, null, 2)
  );
  console.log('\nFull results written to .audit-vs-expertshardware.json');
})();
