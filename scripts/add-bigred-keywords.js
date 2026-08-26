// One-off maintenance script: adds per-product SEO keywords (expert_settings
// 'product_keywords') for every Big Red category product that currently has
// none, using the same ~35-45 keyword template style as the rest of the
// catalog (see scripts/expand-thin-keywords.js).
//
// Run with: node scripts/add-bigred-keywords.js [--dry-run]

const SB_URL = 'https://qhebhvllkovfbkqrcnmm.supabase.co';
const SB_KEY = Buffer.from('c2JfcHVibGlzaGFibGVfakN3cnAteTE2VFdWblg4QWszcjFtd19laEtBU2lwZA==', 'base64').toString('utf8');
const HEADERS = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
const DRY_RUN = process.argv.includes('--dry-run');
const BRAND = 'Big Red';

function catLabel(slug) {
  return (slug || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function buildKeywords(name, brand, category) {
  const n = name.trim();
  const b = (brand || '').trim();
  const cat = category === 'cant-find-products' ? null : catLabel(category);
  const list = [
    `${n} Kuwait`, `buy ${n} Kuwait`, `${n} price Kuwait`, `${n} price in Kuwait`,
    `${n} for sale Kuwait`, `${n} online Kuwait`, `${n} online store Kuwait`,
    `${n} shop Kuwait`, `${n} store Kuwait`, `cheap ${n} Kuwait`, `best ${n} Kuwait`,
    `${n} near me Kuwait`, `wholesale ${n} Kuwait`, `retail ${n} Kuwait`,
    `${n} supplier Kuwait`, `${n} wholesale price Kuwait`, `${n} bulk order Kuwait`,
    `order ${n} online Kuwait`, `${n} KD price`, `${n} KWD price Kuwait`,
  ];
  if (b) {
    list.push(`${b} ${n} Kuwait`, `buy ${b} ${n}`, `${b} ${n} price Kuwait`, `genuine ${b} ${n} Kuwait`, `${b} Kuwait`);
    // Skip "<brand> <category> Kuwait" when they're the same word (e.g. the
    // Big Red category's own brand is literally "Big Red") — it would just
    // repeat itself instead of forming a real phrase.
    if (cat && cat.toLowerCase() !== b.toLowerCase()) list.push(`${b} ${cat} Kuwait`);
  }
  if (cat) list.push(`${cat} Kuwait`, `${cat} store Kuwait`, `${cat} supplier Kuwait`);
  list.push(
    `${n} supplies Kuwait`, `industrial ${n} Kuwait`,
    `commercial ${n} Kuwait`, `${n} specifications Kuwait`, `${n} catalog Kuwait`,
    `Expert Hardware ${n}`, `Expert Hardware Kuwait ${n}`, `${n} Expert Hardware Kuwait`,
    `${n} hardware store Kuwait`, `${n} same day delivery Kuwait`, `${n} fast delivery Kuwait`,
    `${n} delivery Kuwait City`, `${n} construction supply Kuwait`, `${n} contractor supply Kuwait`,
    `${n} trade supply Kuwait`, `${n} B2B Kuwait`, `${n} hardware shop near me`
  );
  return [...new Set(list)];
}

(async () => {
  console.log('Fetching Big Red products and current keywords...');
  const [bigRed, settingsRows] = await Promise.all([
    fetch(`${SB_URL}/rest/v1/expert_products?category=eq.big-red&select=id,name,category`, { headers: HEADERS }).then(r => r.json()),
    fetch(`${SB_URL}/rest/v1/expert_settings?key=eq.product_keywords&select=value`, { headers: HEADERS }).then(r => r.json()),
  ]);
  const productKeywords = settingsRows[0] ? JSON.parse(settingsRows[0].value || '{}') : {};

  let added = 0;
  bigRed.forEach(p => {
    if (productKeywords[p.id]) return; // already has keywords, leave it alone
    productKeywords[p.id] = buildKeywords(p.name, BRAND, p.category).join(', ');
    added++;
  });

  console.log(`Adding keywords to ${added} of ${bigRed.length} Big Red products.`);
  if (DRY_RUN) {
    const sampleId = bigRed[0].id;
    console.log('--dry-run set, not writing. Sample:');
    console.log(sampleId, '->', productKeywords[sampleId]);
    return;
  }

  const res = await fetch(`${SB_URL}/rest/v1/expert_settings`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ key: 'product_keywords', value: JSON.stringify(productKeywords) }]),
  });
  if (!res.ok) {
    console.error('Failed to save:', res.status, await res.text());
    process.exit(1);
  }
  console.log('Saved product_keywords to Supabase.');
})();
