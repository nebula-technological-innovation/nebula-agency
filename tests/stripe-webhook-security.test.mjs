import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';

// Load the actual module as ESM without relying on a package.json type setting.
const actualSource = readFileSync(new URL('../api/stripe-webhook.js', import.meta.url), 'utf8');
const { default: handler } = await import('data:text/javascript,' + encodeURIComponent(actualSource));

// Synthetic only; this fixture never contacts Stripe or a database.
const SECRET = 'offline-synthetic-test-secret-not-for-production';
const makeEvent = (type = 'checkout.session.completed', payment_status = 'paid') => ({
  id: 'evt_synthetic_0001', livemode: true, type,
  data: { object: { id: 'cs_synthetic_0001', payment_status, amount_total: 25000, currency: 'usd' } },
});
function sign(raw, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = crypto.createHmac('sha256', SECRET).update(timestamp + '.' + raw).digest('hex');
  return { timestamp, signature, header: 't=' + timestamp + ',v1=' + signature };
}
async function runCase({ method = 'POST', raw = JSON.stringify(makeEvent()), header, db = true, secret = true } = {}) {
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const dbKeys = ['DATABASE_URL', 'POSTGRES_URL', 'SUPABASE_URL', 'NEON_DATABASE_URL'];
  const originalDbs = Object.fromEntries(dbKeys.map((key) => [key, process.env[key]]));
  if (secret) process.env.STRIPE_WEBHOOK_SECRET = SECRET; else delete process.env.STRIPE_WEBHOOK_SECRET;
  for (const key of dbKeys) delete process.env[key];
  if (db) process.env.DATABASE_URL = 'postgresql://127.0.0.1:65535/synthetic-nonreachable';
  const req = {
    method, headers: { 'stripe-signature': header === undefined ? sign(raw).header : header },
    async *[Symbol.asyncIterator]() { yield Buffer.from(raw); },
  };
  let code = 200;
  let body;
  const res = {
    setHeader() { return this; },
    status(value) { code = value; return this; },
    json(value) { body = value; return this; },
  };
  try { await handler(req, res); return { code, body }; }
  finally {
    if (originalSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
    for (const key of dbKeys) {
      if (originalDbs[key] === undefined) delete process.env[key];
      else process.env[key] = originalDbs[key];
    }
  }
}

test('non-POST requests fail without processing', async () => {
  const r = await runCase({ method: 'GET' });
  assert.equal(r.code, 405); assert.equal(r.body.error, 'method_not_allowed');
});
test('missing signature secret fails closed', async () => {
  assert.equal((await runCase({ secret: false })).code, 503);
});
test('missing database configuration fails closed', async () => {
  assert.equal((await runCase({ db: false })).code, 503);
});
test('missing or incorrect signature is rejected', async () => {
  for (const header of [null, 't=1,v1=bad', 't=notatime,v1=abcd']) {
    assert.equal((await runCase({ header })).code, 400);
  }
});
test('replayed old signed timestamp is rejected', async () => {
  const raw = JSON.stringify(makeEvent());
  assert.equal((await runCase({ raw, header: sign(raw, Math.floor(Date.now() / 1000) - 900).header })).code, 400);
});
test('malformed JSON with a valid signature returns HTTP 400', async () => {
  const r = await runCase({ raw: '{' });
  assert.equal(r.code, 400); assert.equal(r.body.error, 'invalid_json');
});
test('irrelevant event is acknowledged without writing records', async () => {
  const r = await runCase({ raw: JSON.stringify(makeEvent('customer.updated')) });
  assert.equal(r.code, 200); assert.equal(r.body.fulfillment, 'not_applicable');
});
test('unpaid Checkout completion is ignored', async () => {
  const r = await runCase({ raw: JSON.stringify(makeEvent('checkout.session.completed', 'unpaid')) });
  assert.equal(r.code, 200); assert.equal(r.body.fulfillment, 'unpaid_ignored');
});
test('paid Checkout completion fails closed, never signals fulfillment', async () => {
  const r = await runCase();
  assert.equal(r.code, 503); assert.equal(r.body.error, 'durable_order_repository_not_ready');
});
test('paid asynchronous Checkout success fails closed', async () => {
  const r = await runCase({ raw: JSON.stringify(makeEvent('checkout.session.async_payment_succeeded')) });
  assert.equal(r.code, 503);
});
test('mismatched valid-event signature is rejected', async () => {
  const header = sign(JSON.stringify(makeEvent('customer.updated'))).header;
  assert.equal((await runCase({ header })).code, 400);
});
test('hexadecimal signatures with trailing nonhex garbage are rejected', async () => {
  const raw = JSON.stringify(makeEvent());
  assert.equal((await runCase({ raw, header: sign(raw).header + 'zz' })).code, 400);
});
