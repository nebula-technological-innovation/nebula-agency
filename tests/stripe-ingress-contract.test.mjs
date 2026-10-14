// Source contract guard. Runtime signed-event/replay testing is still a release requirement.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'supabase/functions/stripe-revenue-webhook/index.ts'), 'utf8');

for (const marker of [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'record_revenue_checkout',
  'forwardCanonicalEntitlement',
  'canonical_entitlement_forward_failed',
  'json(503',
]) assert.ok(source.includes(marker), 'Missing required payment safety marker: ' + marker);

assert.ok(!source.includes('canonicalStatus="not_configured"'),
  'Never acknowledge recognized paid checkout with missing canonical forwarding configuration');
assert.ok(source.includes('catch(error){ return canonicalForwardFailure(error); }'),
  'Canonical payment forwarding must fail with a retryable 503');
