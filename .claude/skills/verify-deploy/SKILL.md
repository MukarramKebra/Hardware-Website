---
name: verify-deploy
description: Confirm a GitHub Pages deploy for this site actually landed after pushing to main — polls the live site until fresh content shows up, then spot-checks key URLs for broken paths. Use after any push that changes index.html, admin/index.html, code/css, code/js, expert-products, or scripts/generate-product-pages.js.
---

# Verify Deploy

This site (Expert Hardware Kuwait) has no CI status Claude can query directly (no `gh` CLI auth, no GitHub MCP — see CLAUDE.md). The only way to confirm a push actually deployed is to poll the live GitHub Pages URLs directly. This skill is that workflow, packaged so it doesn't have to be reinvented every time.

## When to run this

After `git push origin main` for any change touching:
- `index.html` or `admin/index.html`
- `code/css/*` or `code/js/*`
- `expert-products/**` (image paths — see the "absolute URL" gotcha in CLAUDE.md)
- `scripts/generate-product-pages.js` (triggers the `generate-seo.yml` regen of every `/product/*.html`)

Skip it for changes that don't touch anything served to visitors (e.g. editing this skill file itself, or a one-off Supabase data script with no code change).

## Steps

1. **Identify one distinctive string** that only exists in the NEW version of the changed file(s) — a new class name, a corrected path, a comment you just added. Reused across pushes today, e.g. checking for `code/css/01-base.css` containing `../../loader-gear.png` after a path-depth fix.

2. **Poll until it shows up**, capped at ~2 minutes (GitHub Pages + the `generate-seo.yml` Action both take a minute or two):
   ```bash
   i=0
   until curl -s "https://mukarramkebra.github.io/Hardware-Website/<changed-file>?_=$(date +%s)" | grep -q "<distinctive-string>"; do
     i=$((i+1))
     if [ $i -ge 12 ]; then echo "TIMEOUT after $((i*10))s"; break; fi
     sleep 10
   done
   echo "polls: $i"
   ```
   Always use a cache-busting `?_=$(date +%s)` query param — GitHub Pages' CDN caches aggressively.

3. **Spot-check the core URLs** relevant to what changed — expect all `200`:
   ```bash
   for u in \
     "https://mukarramkebra.github.io/Hardware-Website/" \
     "https://mukarramkebra.github.io/Hardware-Website/code/css/01-base.css" \
     "https://mukarramkebra.github.io/Hardware-Website/code/js/01-config-data.js" \
     "https://mukarramkebra.github.io/Hardware-Website/admin/" \
     "https://mukarramkebra.github.io/Hardware-Website/product/torin-big-red-hydraulic-bottle-jack-101581.html"; do
     code=$(curl -s -o /dev/null -w "%{http_code}" "$u")
     echo "$code  $u"
   done
   ```
   If an image folder moved, add a couple of its files (e.g. `expert-products/cant-find-products/<some-file>.jpg`) to this list — a 404 there means a database `img_url` reference wasn't updated (see CLAUDE.md's absolute-URL gotcha).

4. **If anything's still wrong after the poll succeeds**, don't assume the fix didn't work — check whether the STAGED/committed version actually matches the WORKING TREE version (`git diff HEAD~1 -- <file>` or `git show HEAD:<file>`). A `git mv` followed by a later `Edit` to the same file does not automatically re-stage the edit — this exact mistake shipped a broken CSS path once already this session.

5. For anything interactive (a form, a modal, a category filter), a curl check only proves the file loads — it doesn't prove the feature works. Use the Browser tools (`preview_start` with the live URL, `javascript_tool` to drive the interaction, `read_console_messages` for errors) for an actual functional check, not just a status-code check.
