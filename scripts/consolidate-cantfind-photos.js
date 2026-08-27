// Moves the local photo files for products in the "Can't Find Products"
// category out of their scattered numeric-range folders
// (expert-products/<range>/<file>) into one expert-products/cant-find-products/
// folder, and updates each product's expert_photos.img_url to match.
// Reads the overlap list scripts/../cfp_overlap.json (product_id + current
// img_url), produced by the investigation step before this script existed.
//
// Run with: node scripts/consolidate-cantfind-photos.js [--dry-run]

const fs = require('fs');
const path = require('path');

const SB_URL = 'https://qhebhvllkovfbkqrcnmm.supabase.co';
const SB_KEY = Buffer.from('c2JfcHVibGlzaGFibGVfakN3cnAteTE2VFdWblg4QWszcjFtd19laEtBU2lwZA==', 'base64').toString('utf8');
const HEADERS = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
const DRY_RUN = process.argv.includes('--dry-run');
const ROOT = path.resolve(__dirname, '..');
const DEST_DIR = path.join(ROOT, 'expert-products', 'cant-find-products');

(async () => {
  const overlap = JSON.parse(fs.readFileSync(path.join(ROOT, 'cfp_overlap.json'), 'utf8'));
  console.log(`${overlap.length} products to consolidate.`);

  if (!DRY_RUN) fs.mkdirSync(DEST_DIR, { recursive: true });

  let moved = 0, missing = 0, patched = 0, failed = 0;
  for (const row of overlap) {
    const u = new URL(row.img_url);
    // pathname like /Hardware-Website/expert-products/1-50/115.jpg
    const relIdx = u.pathname.indexOf('/expert-products/');
    // pathname keeps %-encoding as-is (e.g. "%28" for a literal "(" in the
    // real filename) — decode it before touching the filesystem, or names
    // with parens/spaces/etc. never match the actual file on disk.
    const relPath = decodeURIComponent(u.pathname.slice(relIdx + '/expert-products/'.length)); // e.g. "1-50/115.jpg"
    const srcPath = path.join(ROOT, 'expert-products', relPath);
    const basename = path.basename(relPath);
    const destPath = path.join(DEST_DIR, basename);
    const newUrl = `https://mukarramkebra.github.io/Hardware-Website/expert-products/cant-find-products/${encodeURIComponent(basename)}`;

    if (!fs.existsSync(srcPath)) { console.warn(`  MISSING on disk: ${srcPath}`); missing++; continue; }

    if (DRY_RUN) {
      if (moved < 3) console.log(`  ${relPath} -> cant-find-products/${basename}`);
      moved++;
      continue;
    }

    fs.renameSync(srcPath, destPath);
    moved++;

    const res = await fetch(`${SB_URL}/rest/v1/expert_photos?product_id=eq.${row.product_id}`, {
      method: 'PATCH',
      headers: { ...HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ img_url: newUrl }),
    });
    if (res.ok) patched++; else { failed++; console.warn(`  DB patch failed for ${row.product_id}`); }
  }
  console.log(`Moved ${moved} files, ${missing} missing.${DRY_RUN ? '' : ` Patched ${patched} DB rows${failed ? `, ${failed} failed` : ''}.`}`);
})();
