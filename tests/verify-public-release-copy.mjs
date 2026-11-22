import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Static and React marketing surfaces must never bypass the per-offer release gate.
// Run against the entire directory so new landing pages cannot silently add paid links.
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => {
    const next = path.join(dir, item.name);
    return item.isDirectory() ? walk(next) : /\.(html|tsx|jsx)$/.test(item.name) ? [next] : [];
  });
}

const files = ['index.html','offers/index.html', ...walk('landing-pages'), ...walk('guides')];
assert(files.length >= 20, 'expected complete marketing source tree');
let checkoutLinks = 0;
let oldProductionClaims = 0;
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const href = /(?:href\s*=\s*["']|href\s*:\s*["'])(https:\/\/(?:buy|book)\.stripe\.com\/|\/api\/go\?offer=)/gi;
  for (const match of source.matchAll(href)) { checkoutLinks++; throw new Error('Unapproved direct payment link in ' + file + ': ' + match[1]); }
  if (/through live Stripe checkout|secure Stripe checkout and verified delivery|checkout is handled by Stripe\. After payment/i.test(source)) {
    oldProductionClaims++;
    throw new Error('Unverified live-checkout claim in ' + file);
  }
  for (const m of source.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let ld;
    try { ld = JSON.parse(m[1]); } catch { throw new Error('Invalid JSON-LD in ' + file); }
    if (JSON.stringify(ld).includes('https://schema.org/InStock')) throw new Error('Unverified stock metadata in ' + file);
  }
}
assert.equal(checkoutLinks, 0);
assert.equal(oldProductionClaims, 0);
console.log(JSON.stringify({status: 'PASS',marketing_files_checked: files.length, direct_checkout_links:0, unverified_stock_claims:0, production_checkout_enabled:false}));
