// One-off maintenance script: expands per-product SEO keywords for any
// product currently sitting at only 6 or 7 keywords (the pre-bulk-SEO-pass
// leftovers) up to the same ~50-keyword template style already used across
// the rest of the catalog (see expert_settings 'product_keywords'), while
// keeping every keyword the product already had.
//
// Run with: node scripts/expand-thin-keywords.js [--dry-run]

const SB_URL = 'https://qhebhvllkovfbkqrcnmm.supabase.co';
const SB_KEY = Buffer.from('c2JfcHVibGlzaGFibGVfakN3cnAteTE2VFdWblg4QWszcjFtd19laEtBU2lwZA==', 'base64').toString('utf8');
const HEADERS = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
const DRY_RUN = process.argv.includes('--dry-run');

async function fetchAll(path) {
  let all = [], offset = 0;
  const pageSize = 1000;
  while (true) {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(`${SB_URL}${path}${sep}limit=${pageSize}&offset=${offset}`, { headers: HEADERS });
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('Unexpected response: ' + JSON.stringify(data).slice(0, 300));
    all = all.concat(data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

function catLabel(slug) {
  return (slug || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function buildKeywords(name, brand, category) {
  const n = name.trim();
  const b = (brand || '').trim();
  // "Cant Find Products" is an internal unverified-data bucket, not a real
  // category a shopper would search for — using it in a template phrase
  // would generate nonsense like "Cant Find Products Kuwait". Products still
  // sitting in that bucket just skip every category-based phrase below.
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
    if (cat) list.push(`${b} ${cat} Kuwait`);
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
  return list;
}

(async () => {
  console.log('Fetching products, keywords, brand map...');
  const [products, settingsRows] = await Promise.all([
    fetchAll('/rest/v1/expert_products?select=id,name,category'),
    fetch(`${SB_URL}/rest/v1/expert_settings?key=in.(product_keywords,brand_map)&select=key,value`, { headers: HEADERS }).then(r => r.json()),
  ]);
  const byKey = {};
  settingsRows.forEach(r => { byKey[r.key] = JSON.parse(r.value || '{}'); });
  const productKeywords = byKey.product_keywords || {};
  const brandMap = byKey.brand_map || {};
  const productsById = {};
  products.forEach(p => { productsById[p.id] = p; });

  const thin = Object.keys(productKeywords).filter(id => {
    const n = productKeywords[id].split(',').map(s => s.trim()).filter(Boolean).length;
    return n === 6 || n === 7;
  });
  console.log(`Found ${thin.length} products with only 6-7 keywords.`);

  let updated = 0;
  thin.forEach(id => {
    const p = productsById[id];
    if (!p) { console.warn(`  skip ${id}: product not found`); return; }
    const existing = productKeywords[id].split(',').map(s => s.trim()).filter(Boolean);
    // Trailing bare numeric codes (SKU/barcode) in the existing list aren't
    // real search phrases — keep them, but generate fresh phrases from the
    // product's own name rather than templating off a numeric "keyword".
    const generated = buildKeywords(p.name, brandMap[id], p.category);
    const seen = new Set(existing.map(k => k.toLowerCase()));
    const merged = existing.slice();
    generated.forEach(k => {
      if (!seen.has(k.toLowerCase())) { seen.add(k.toLowerCase()); merged.push(k); }
    });
    productKeywords[id] = merged.join(', ');
    updated++;
  });

  console.log(`Expanded ${updated} products.`);
  if (DRY_RUN) {
    console.log('--dry-run set, not writing. Sample:');
    console.log(thin[0], '->', productKeywords[thin[0]]);
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
