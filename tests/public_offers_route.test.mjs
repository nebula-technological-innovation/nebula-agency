import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync('offers/index.html', 'utf8');
const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));

test('offers routes have explicit static Vercel targets', () => {
  for (const route of ['/offers', '/offers/']) {
    assert.ok(config.rewrites.some((r) => r.source === route && r.destination === '/offers/index.html'), `no mapping for ${route}`);
  }
});

test('offers page is accessible and does not directly charge', () => {
  assert.match(source, /<title>Technology & AI Services/);
  assert.match(source, /<main\s+id="main"/);
  assert.match(source, /Release-gated purchase policy/);
  assert.doesNotMatch(source, /https:\/\/(?:book|buy)\.stripe\.com\//);
  assert.match(source, /mailto:/);
});

test('offers page internal service links resolve in the tracked tree', () => {
  for (const m of source.matchAll(/href="(\/landing-pages\/services\/[^"]+)"/g)) {
    assert.ok(fs.existsSync(path.join('.',m[1].slice(1))), `missing link ${m[1]}`);
  }
});

test('offers receives protective response headers', () => {
  for (const route of ['/offers', '/offers/']) {
    const item = config.headers.find((h) => h.source === route);
    assert.ok(item, `missing header config for ${route}`);
    const map = Object.fromEntries(item.headers.map((h) => [h.key.toLowerCase(), h.value]));
    assert.ok(map['content-security-policy'].includes("frame-ancestors 'none'"));
    assert.equal(map['x-content-type-options'], 'nosniff');
  }
});
