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
