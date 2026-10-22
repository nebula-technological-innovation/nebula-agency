import assert from 'node:assert/strict';
import fs from 'node:fs';

// Structural checks do not establish legal approval or live website readiness.
// Run with --production only after approval to check published routes.
const routes = [
  ['/contact/', 'contact/index.html'],
  ['/policies/privacy.html', 'policies/privacy.html'],
  ['/policies/terms.html', 'policies/terms.html'],
  ['/policies/refunds.html', 'policies/refunds.html']
];
const home = fs.readFileSync('index.html', 'utf8');
const sitemap = fs.readFileSync('sitemap.xml', 'utf8');

for (const [urlPath, filePath] of routes) {
  assert.ok(fs.existsSync(filePath), 'missing route source: ' + filePath);
  const html = fs.readFileSync(filePath, 'utf8');
  assert.match(html, /<title[^>]*>[^<]+<\/title>/i, 'missing title: ' + filePath);
  assert.match(html, /<h1[\s>]/i, 'missing h1: ' + filePath);
  assert.ok(html.length > 300, 'unexpectedly empty page: ' + filePath);
  assert.ok(html.includes('https://nebularoe.com' + urlPath), 'missing canonical URL: ' + filePath);
  assert.ok(home.includes('href="' + urlPath + '"'), 'homepage missing link: ' + urlPath);
  assert.ok(sitemap.includes('<loc>https://nebularoe.com' + urlPath + '</loc>'), 'sitemap missing ' + urlPath);
}
assert.ok(home.includes('href="/api/go?offer=strategy_architecture_discovery'),
  'discovery checkout missing from homepage');
assert.ok(home.includes('href="/api/go?offer=ai-task-sprint'),
  'task-sprint checkout missing from homepage');
console.log(JSON.stringify({check:'static_trust_routes',status:'PASS',route_count:routes.length}));

if (process.argv.includes('--production')) {
  let failures = 0;
  for (const urlPath of ['/', ...routes.map(([route]) => route)]) {
    try {
      const response = await fetch('https://nebularoe.com' + urlPath, {
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
        headers: {'user-agent':'NebulaReleaseAcceptance/1.0'}
      });
      const ok = response.status === 200;
      if (!ok) failures++;
      console.log((ok ? 'PASS' : 'FAIL') + ' production ' + urlPath + ' HTTP ' + response.status);
    } catch (error) {
      failures++;
      console.log('FAIL production ' + urlPath + ' ' + error.name);
    }
  }
  if (failures) {
    console.error('PRODUCTION_RELEASE_ACCEPTANCE=HOLD; failed_routes=' + failures);
    process.exitCode = 2;
  } else {
    console.log('PRODUCTION_RELEASE_ACCEPTANCE=PASS (HTTP routing only; legal approval still required)');
  }
}