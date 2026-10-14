// Source-level release assertions, not a substitute for signed-event replay tests.
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
  'forwardCanonicalEntitlement(admin, "/internal/payment-events"',
  'canonicalForwardFailure(error)',
  'canonical_forwarding: kind !== "unknown"',
  '"ai-task-sprint"',
  '"ai-native-website-launch-sprint"',
  '"ai_native_website_launch_sprint": "ai-native-website-launch-sprint"',
  'canonicalOffer(String(',
  'customer_email_unresolved',
  'payment_identity_unresolved',
  'verifyStripeSignature(raw',
  'invoice.payment_failed',
  'invoice.paid',
  'customer.subscription.deleted',
]) {
  assert.ok(source.includes(marker), 'Missing safety marker: ' + marker);
}
const durableWrite = source.indexOf('record_revenue_checkout');
const canonicalPaidEvent = source.indexOf('forwardCanonicalEntitlement(admin, "/internal/payment-events"');
const successfulPaidAck = source.indexOf('canonical_status: kind === "unknown" ? "pending_review" : "forwarded"');
assert.ok(durableWrite >= 0 && canonicalPaidEvent > durableWrite && successfulPaidAck > canonicalPaidEvent,
  'Durable persistence and canonical forwarding must precede successful acknowledgment');
assert.ok(source.includes('return canonicalForwardFailure(error);'),
  'Canonical forwarding errors must return a retryable 5xx');
assert.ok(!source.includes('canonicalStatus="not_configured"'),
  'Missing forwarding configuration must not be acknowledged as successfully delivered');
assert.ok(source.split('\n').length > 400,
  'Do not replace the readable main webhook source with a shorter deployed snapshot');

// The production checkout catalog includes both new and legacy service identifiers.
const offerIds = ['ai-task-sprint', 'ai-native-website-launch-sprint'];
for (const offerId of offerIds) {
  assert.ok(source.includes('"' + offerId + '"'), 'Missing production service offer: ' + offerId);
}
assert.ok(source.includes('const sku = canonicalOffer('),
  'Legacy aliases must also be resolved when checkout identifies an offer by SKU');

assert.ok(source.includes('payment_amount_or_currency_unresolved'),
  'Unknown amount or currency must yield retryable failure');
assert.ok(source.includes('amountTotal === null || currency === null'),
  'Do not fabricate payment amounts when forwarding');
assert.ok(!source.includes('amount: amountTotal ?? 0,'),
  'Never forward an invented zero-dollar amount');
assert.ok(!source.includes('currency: currency ?? "usd",'),
  'Never forward an invented USD currency');
for (const field of [
  'commercial_offering_id', 'commercial_offer_id', 'canonical_price_id',
  'entitlement_tier', 'provider_price_id', 'payment_role',
  'business_owner', 'fulfillment_type',
]) {
  assert.ok(source.includes('"' + field + '"'), 'Missing live v11 metadata: ' + field);
}

assert.ok(source.includes('safeMetadata.canonical_offer_id = offerId;'),
  'Provider record must preserve deployed v11 canonical_offer_id for audit and reconciliation');
