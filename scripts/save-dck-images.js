// One-off maintenance script: downloads all DCK product images (currently
// hotlinked from expertshardware.com) and saves them locally under
// expert-products/DCK products/<sku>.jpg. SKU = the product name, since every
// DCK product's `name` field is already a DCK SKU code (e.g. "KMY02-235").
// Does NOT touch expert_products.img_url — this is a local-archive step only.
//
// Run with: node scripts/save-dck-images.js [--dry-run]

const fs = require('fs');
const path = require('path');

const SB_URL = 'https://qhebhvllkovfbkqrcnmm.supabase.co';
const SB_KEY = Buffer.from('c2JfcHVibGlzaGFibGVfakN3cnAteTE2VFdWblg4QWszcjFtd19laEtBU2lwZA==', 'base64').toString('utf8');
const HEADERS = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
const OUT_DIR = path.resolve(__dirname, '..', 'expert-products', 'DCK products');
const CONCURRENCY = 6;
const RETRIES = 2;
const DRY_RUN = process.argv.includes('--dry-run');

function sanitize(name) {
  return String(name)
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.\s]+$/, '');
}

function extFromUrl(url) {
  const m = url.match(/\.([a-zA-Z0-9]{2,5})(?:\?|$)/);
  return m ? m[1].toLowerCase() : 'jpg';
}

async function fetchWithRetry(url, opts = {}, tries = RETRIES) {
  let lastErr;
  for (let i = 0; i <= tries; i++) {
    try {
      const res = await fetch(url, opts);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      lastErr = e;
      if (i < tries) await new Promise(r => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw lastErr;
}

(async () => {
  if (!DRY_RUN) fs.mkdirSync(OUT_DIR, { recursive: true });

  const brandRow = await fetchWithRetry(`${SB_URL}/rest/v1/expert_settings?key=eq.brand_map&select=value`, { headers: HEADERS }).then(r => r.json());
  const rawVal = brandRow[0]?.value;
  const brandMap = typeof rawVal === 'string' ? JSON.parse(rawVal) : (rawVal || {});
  const dckIds = Object.keys(brandMap).filter(k => brandMap[k] === 'DCK').map(Number);
  console.log(`Found ${dckIds.length} DCK product ids in brand_map.`);

  const prods = [];
  for (let i = 0; i < dckIds.length; i += 100) {
    const batch = dckIds.slice(i, i + 100);
    const chunk = await fetchWithRetry(`${SB_URL}/rest/v1/expert_products?id=in.(${batch.join(',')})&select=id,name,img_url`, { headers: HEADERS }).then(r => r.json());
    prods.push(...chunk);
  }
  console.log(`Fetched ${prods.length} product rows.`);

  const jobs = [];
  const skipped = [];
  const seenFilenames = new Set();
  for (const p of prods) {
    if (!p.img_url) { skipped.push({ id: p.id, name: p.name, reason: 'no img_url' }); continue; }
    if (!/^https?:\/\//i.test(p.img_url)) { skipped.push({ id: p.id, name: p.name, reason: `non-http url: ${p.img_url.slice(0, 60)}` }); continue; }
    const sku = sanitize(p.name || `product-${p.id}`);
    if (!sku) { skipped.push({ id: p.id, name: p.name, reason: 'empty sku after sanitize' }); continue; }
    const ext = extFromUrl(p.img_url);
    let filename = `${sku}.${ext}`;
    if (seenFilenames.has(filename.toLowerCase())) {
      filename = `${sku}-${p.id}.${ext}`;
    }
    seenFilenames.add(filename.toLowerCase());
    jobs.push({ id: p.id, name: p.name, url: p.img_url, filename });
  }
  console.log(`Prepared ${jobs.length} download jobs (${skipped.length} skipped).`);
  if (skipped.length) console.log('Skipped:', skipped);

  if (DRY_RUN) {
    console.log('\n--dry-run: would download these files:');
    jobs.slice(0, 10).forEach(j => console.log(`  ${j.filename}  <-  ${j.url}`));
    if (jobs.length > 10) console.log(`  ... and ${jobs.length - 10} more`);
    return;
  }

  let done = 0, saved = 0, failed = 0;
  const failures = [];
  const manifest = [];

  async function worker(queue) {
    while (queue.length) {
      const job = queue.shift();
      if (!job) break;
      try {
        const res = await fetchWithRetry(job.url, {}, RETRIES);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 200) throw new Error(`suspiciously small (${buf.length} bytes)`);
        fs.writeFileSync(path.join(OUT_DIR, job.filename), buf);
        saved++;
        manifest.push({ id: job.id, sku: job.name, filename: job.filename, bytes: buf.length, source: job.url });
      } catch (e) {
        failed++;
        failures.push({ id: job.id, name: job.name, url: job.url, filename: job.filename, error: String(e.message || e) });
      } finally {
        done++;
        if (done % 10 === 0 || done === jobs.length) process.stdout.write(`  ${done}/${jobs.length} (${saved} saved, ${failed} failed)\n`);
      }
    }
  }

  const queue = [...jobs];
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));

  const manifestPath = path.resolve(__dirname, '..', '.dck-images-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ saved: manifest, failed: failures, skipped }, null, 2));

  console.log(`\nSaved ${saved}/${jobs.length} to ${OUT_DIR}`);
  if (failed) {
    console.log(`${failed} failures (see ${manifestPath}):`);
    failures.slice(0, 20).forEach(f => console.log(`  ${f.filename} <- ${f.url}  :: ${f.error}`));
  }
  console.log(`Manifest: ${manifestPath}`);
})().catch(e => { console.error(e); process.exit(1); });
