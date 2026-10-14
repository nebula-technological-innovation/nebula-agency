// Static guard for the live-source reconciliation. Runtime replay tests remain required.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'supabase/functions/stripe-revenue-webhook/index.ts'), 'utf8');
assert.match(source, /checkout\\.session\\.completed/);
assert.match(source, /checkout\\.session\\.async_payment_succeeded/);
assert.match(source, /record_revenue_checkout/);
assert.match(source, /forwardCanonicalEntitlement/);
assert.match(source, /canonical_entitlement_forward_failed/);
assert.match(source, /json\\(503/);
assert.doesNotMatch(source, /canonicalStatus\\s*=\\s*["']not_configured["']/,
  'Never acknowledge recognized paid checkouts when canonical forwarding is unavailable');
assert.match(source, /catch\\s*\\(error\\)\\s*\\{\\s*return canonicalForwardFailure\\(error\\);\\s*\\}/);
