import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../offers/index.html');
const config = JSON.parse(read('../vercel.json'));

test('both offers paths resolve to a real static destination', () => {
  const rewrites = Object.fromEntries(config.rewrites.map(({ source, destination }) => [source, destination]));
  assert.equal(rewrites['/offers'], '/offers/index.html');
  assert.equal(rewrites['/offers/'], '/offers/index.html');
  assert.ok(existsSync(new URL('../offers/index.html', import.meta.url)));
});
test('existing API routes remain untouched', () => {
  assert.equal(config.framework, undefined);
  assert.equal(config.routes, undefined);
  assert.equal(config.redirects, undefined);
});
test('page has main landmark and accurate canonical URL', () => {
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<main id="main"/);
  assert.match(html, /https:\/\/nebularoe\.com\/offers/);
  assert.match(html, /<h1>Professional technology and AI services<\/h1>/);
});
test('links to real source pages without bypassing payment gates', () => {
  for (const name of [
    'strategy-architecture-discovery.html',
    'atlas-ai-automation-assessment.html',
    'automation-integration-sprint.html',
  ]) {
    assert.ok(html.includes(name), name);
    assert.ok(existsSync(new URL('../landing-pages/services/' + name, import.meta.url)), name);
  }
  assert.doesNotMatch(html, /https:\/\/(buy|book)\.stripe\.com/i);
  assert.doesNotMatch(html, /\/api\/go\?/);
  assert.match(html, /Release-gated purchase policy/);
});

test('offers routes receive scoped security headers', () => {
  for (const route of ['/offers', '/offers/']) {
    const rule = config.headers.find((item) => item.source === route);
    assert.ok(rule, 'Missing scoped headers for ' + route);
    const headers = Object.fromEntries(rule.headers.map(({ key, value }) => [key.toLowerCase(), value]));
    assert.equal(headers['x-content-type-options'], 'nosniff');
    assert.equal(headers['x-frame-options'], 'DENY');
    assert.equal(headers['referrer-policy'], 'strict-origin-when-cross-origin');
    assert.match(headers['content-security-policy'], /frame-ancestors 'none'/);
    assert.match(headers['content-security-policy'], /form-action 'none'/);
    assert.match(headers['permissions-policy'], /camera=\(\)/);
  }
  assert.equal(config.headers.length, 2, 'Do not change API response header behavior unintentionally');
});
