import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Test the real checked-in module without package-level module type assumptions.
const source = readFileSync(new URL('../api/runtime-readiness.js', import.meta.url), 'utf8');
const { default: handler } = await import('data:text/javascript,' + encodeURIComponent(source));

const keys = [
  'STRIPE_WEBHOOK_SECRET', 'STRIPE_SECRET_KEY', 'DATABASE_URL',
  'POSTGRES_URL', 'SUPABASE_URL', 'NEON_DATABASE_URL', 'ENTITLEMENT_EVENT_TOKEN',
];
function queryReadiness(values = {}) {
  const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
  let status = 200;
  let payload;
  const res = {
    setHeader(key, value) { assert.equal(key, 'Cache-Control'); assert.equal(value, 'no-store'); return this; },
    status(code) { status = code; return this; },
    json(object) { payload = object; return this; },
  };
  try { handler({ method: 'GET' }, res); return { status, payload }; }
  finally {
    for (const key of keys) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
  }
}

test('never reports live paid-checkout readiness with no configuration', () => {
  const { status, payload } = queryReadiness();
  assert.equal(status, 200);
  assert.equal(payload.ready_for_signed_webhooks, false);
  assert.equal(payload.durable_order_repository_ready, false);
  assert.equal(payload.ready_for_paid_checkout, false);
  assert.equal(payload.stripe_signature_verification_configured, false);
});

test('credential and database presence cannot masquerade as a working economic writer', () => {
  const { payload } = queryReadiness({
    STRIPE_WEBHOOK_SECRET: 'test_whsec_marker',
    STRIPE_SECRET_KEY: 'test_sk_marker',
    DATABASE_URL: 'postgres://localhost:1/synthetic',
    ENTITLEMENT_EVENT_TOKEN: 'test_token_marker',
  });
  assert.equal(payload.configuration.database_url, true);
  assert.equal(payload.configuration.stripe_webhook_secret, true);
  assert.equal(payload.stripe_signature_verification_configured, true);
  assert.equal(payload.ready_for_signed_webhooks, false);
  assert.equal(payload.ready_for_paid_checkout, false);
  assert.equal(payload.durable_order_repository_ready, false);
  const rendered = JSON.stringify(payload);
  for (const value of ['test_whsec_marker', 'test_sk_marker', 'test_token_marker']) {
    assert.ok(!rendered.includes(value), 'secret value must never appear in readiness response');
  }
});

test('each alternative DB environment variable also cannot clear the payment release gate', () => {
  for (const key of ['POSTGRES_URL', 'SUPABASE_URL', 'NEON_DATABASE_URL']) {
    const { payload } = queryReadiness({
      STRIPE_WEBHOOK_SECRET: 'test_whsec_marker', [key]: 'postgres://localhost:1/synthetic',
    });
    assert.equal(payload.configuration.database_url, true);
    assert.equal(payload.ready_for_signed_webhooks, false);
    assert.equal(payload.ready_for_paid_checkout, false);
  }
});

test('readiness reports the compatibility-only release limitation explicitly', () => {
  const { payload } = queryReadiness({ STRIPE_WEBHOOK_SECRET: 'marker' });
  assert.match(payload.note, /compatibility only/i);
  assert.match(payload.note, /503/);
  assert.match(payload.note, /economic release gate/i);
});
