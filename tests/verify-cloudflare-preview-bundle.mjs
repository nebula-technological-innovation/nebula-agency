import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const output = 'dist-cloudflare-review';
execFileSync(process.execPath,['scripts/build-cloudflare-review.mjs',output],{stdio:'pipe'});
const manifest = JSON.parse(fs.readFileSync(path.join(output,'preview-manifest.json'),'utf8'));
assert.equal(manifest.environment,'preview-only');
assert.equal(manifest.commercial_release,'HOLD');
assert.equal(manifest.noindex,true);
assert.equal(manifest.routes.length,30,'full routes manifest must include all customer-facing linked pages');
assert.equal(new Set(manifest.routes.map(x=>x.route)).size,30);

const workerFile = path.resolve(output,'_worker.js');
const deployed = (await import(pathToFileURL(workerFile).href)).default;
for (const page of manifest.routes) {
  const req = new Request('https://example.pages.dev'+page.route);
  const response = await deployed.fetch(req);
  assert.equal(response.status,200,page.route);
  assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow',page.route);
  const html = await response.text();
  assert.ok(html.includes('<html'),page.route);
  assert.ok(!/(?:href\s*=\s*["']|href\s*:\s*["'])(?:https:\/\/(?:book|buy)\.stripe\.com\/|\/api\/go\?offer=)/i.test(html),page.route);
  const head = await deployed.fetch(new Request(req.url,{method:'HEAD'}));
  assert.equal(head.status,200,page.route);
  assert.equal(await head.text(),'');
}
for (const route of ['/api/go?offer=atlas-assessment','/api/go?offer=agent-ops-pack']) {
  const response = await deployed.fetch(new Request('https://example.pages.dev'+route));
  assert.equal(response.status,303);
  assert.equal(response.headers.get('x-nebula-commercial-state'),'release-held');
  assert.equal(new URL(response.headers.get('location')).pathname,'/offers');
}
assert.equal((await deployed.fetch(new Request('https://example.pages.dev/absent'))).status,404);
assert.equal((await deployed.fetch(new Request('https://example.pages.dev/',{method:'POST'}))).status,405);
assert.equal((await deployed.fetch(new Request('https://example.pages.dev/contact'))).status,200);
assert.equal((await deployed.fetch(new Request('https://example.pages.dev/privacy'))).status,200);
assert.equal((await deployed.fetch(new Request('https://example.pages.dev/terms'))).status,200);
const status = await deployed.fetch(new Request('https://example.pages.dev/api/revenue-status'));
assert.equal((await status.json()).collected_revenue,'NOT_REPORTED_BY_THIS_ENDPOINT');
console.log(JSON.stringify({status:'PASS',pages:manifest.routes.length,noindex:true,release:'HOLD',live_charge_created:false}));
