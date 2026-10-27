// Read-only audit: cross-references every local file under expert-products/
// against every img_url reference in expert_products + expert_photos, to
// find (a) local files nothing in the database points to (safe to remove)
// and (b) database references that point at a local file that doesn't
// exist (broken image). Always run this before moving/deleting anything in
// expert-products/ — see CLAUDE.md's "before renaming/moving any image
// folder" gotcha.
//
// Run with: node scripts/audit-expert-products-images.js

const fs = require('fs');
const path = require('path');

const SB_URL = 'https://qhebhvllkovfbkqrcnmm.supabase.co';
const SB_KEY = Buffer.from('c2JfcHVibGlzaGFibGVfakN3cnAteTE2VFdWblg4QWszcjFtd19laEtBU2lwZA==', 'base64').toString('utf8');
const HEADERS = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
const ROOT = path.join(__dirname, '..', 'expert-products');
const SITE_PREFIX = 'https://mukarramkebra.github.io/Hardware-Website/expert-products/';

function walk(dir, base = '') {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out = out.concat(walk(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

async function fetchAllPaged(url) {
  let all = [], offset = 0;
  while (true) {
    const r = await fetch(`${url}&limit=1000&offset=${offset}`, { headers: HEADERS });
    const d = await r.json();
    if (!Array.isArray(d)) { console.error('Unexpected response:', d); break; }
    all = all.concat(d);
    if (d.length < 1000) break;
    offset += 1000;
  }
  return all;
}

(async () => {
  const localFiles = walk(ROOT); // relative paths, e.g. "cant-find-products/foo.jpg"
  const localSet = new Set(localFiles.map(f => f.replace(/\\/g, '/')));

  const [products, photos] = await Promise.all([
    fetchAllPaged(`${SB_URL}/rest/v1/expert_products?select=id,category,img_url`),
    fetchAllPaged(`${SB_URL}/rest/v1/expert_photos?select=product_id,img_url`),
  ]);

  const dbRefs = new Map(); // relative path -> [{source, id}]
  for (const row of [...products.map(p => ({ ...p, source: 'expert_products' })), ...photos.map(p => ({ ...p, id: p.product_id, source: 'expert_photos' }))]) {
    if (!row.img_url || !row.img_url.startsWith(SITE_PREFIX)) continue;
    const rel = decodeURIComponent(row.img_url.slice(SITE_PREFIX.length));
    if (!dbRefs.has(rel)) dbRefs.set(rel, []);
    dbRefs.get(rel).push({ source: row.source, id: row.id });
  }

  // 1) Local files with zero DB reference (candidates to remove)
  const unreferenced = localFiles.filter(f => !dbRefs.has(f.replace(/\\/g, '/')) && !f.endsWith('.csv'));

  // 2) DB references pointing at a local file that doesn't exist (broken images)
  const broken = [...dbRefs.entries()].filter(([rel]) => !localSet.has(rel));

  // 3) Per-top-level-folder summary
  const folderStats = {};
  for (const f of localFiles) {
    const top = f.split('/')[0];
    folderStats[top] = folderStats[top] || { files: 0, referenced: 0 };
    folderStats[top].files++;
    if (dbRefs.has(f.replace(/\\/g, '/'))) folderStats[top].referenced++;
  }

  console.log('=== Per-folder: files vs referenced-in-database ===');
  for (const [folder, s] of Object.entries(folderStats).sort()) {
    const flag = s.referenced === 0 ? '  <-- ZERO referenced, fully orphaned?' : (s.referenced < s.files ? '  <-- partially orphaned' : '');
    console.log(`${folder}: ${s.referenced}/${s.files} referenced${flag}`);
  }

  console.log(`\n=== Unreferenced local files: ${unreferenced.length} of ${localFiles.length} ===`);
  if (unreferenced.length) {
    console.log('First 30:');
    unreferenced.slice(0, 30).forEach(f => console.log('  ' + f));
  }

  console.log(`\n=== Broken DB references (point at a file that doesn't exist locally): ${broken.length} ===`);
  broken.slice(0, 20).forEach(([rel, refs]) => console.log('  ' + rel, JSON.stringify(refs.slice(0, 2))));

  fs.writeFileSync(
    path.join(__dirname, '..', '.audit-expert-products-images.json'),
    JSON.stringify({ unreferenced, broken: broken.map(([rel, refs]) => ({ rel, refs })), folderStats }, null, 2)
  );
  console.log('\nFull results written to .audit-expert-products-images.json');
})();
