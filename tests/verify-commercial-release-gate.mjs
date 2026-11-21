import assert from 'node:assert/strict';
import fs from 'node:fs';
import { commercialRedirectApproved, REQUIRED_EVIDENCE } from '../api/_commercial-release.mjs';

const offer = 'atlas-assessment';
const stripe = 'https://book.stripe.com/synthetic-not-live';
const evidence = Object.fromEntries(REQUIRED_EVIDENCE.map(k => [k, 'audit://synthetic/' + k]));
const approved = {
  version: 1,
  offers: [{ id: offer, decision: 'OWNER_APPROVED', stripe_url: stripe,
    approval_id: 'synthetic-approval-001', approved_at: '2026-11-21T00:00:00Z',
    evidence }]
};
const env = { NEBULA_COMMERCIAL_RELEASE_MODE: 'approved', NEBULA_COMMERCIAL_RELEASE_MANIFEST: JSON.stringify(approved) };

assert.equal(commercialRedirectApproved(offer, stripe), false, 'default is held');
assert.equal(commercialRedirectApproved(offer, stripe, { NEBULA_COMMERCIAL_RELEASE_MODE: 'approved' }), false, 'manifest required');
assert.equal(commercialRedirectApproved(offer, stripe, { ...env, NEBULA_COMMERCIAL_RELEASE_MODE: 'disabled' }), false);
assert.equal(commercialRedirectApproved(offer, stripe, { ...env, NEBULA_COMMERCIAL_RELEASE_MANIFEST: '{' }), false);
assert.equal(commercialRedirectApproved(offer, 'https://evil.example/pay', env), false);
assert.equal(commercialRedirectApproved(offer, 'https://book.stripe.com/wrong', env), false);
assert.equal(commercialRedirectApproved('unknown', stripe, env), false);
assert.equal(commercialRedirectApproved(offer, stripe, env), true, 'synthetic exhaustive evidence allows only selected offer');
for (const key of REQUIRED_EVIDENCE) {
  const copy = structuredClone(approved);
  delete copy.offers[0].evidence[key];
  assert.equal(commercialRedirectApproved(offer, stripe, { ...env, NEBULA_COMMERCIAL_RELEASE_MANIFEST: JSON.stringify(copy) }), false, 'missing gate: '+key);
}
const duplicate = structuredClone(approved);
duplicate.offers.push(duplicate.offers[0]);
assert.equal(commercialRedirectApproved(offer, stripe, { ...env, NEBULA_COMMERCIAL_RELEASE_MANIFEST: JSON.stringify(duplicate) }), false);

const router = fs.readFileSync('api/go.js', 'utf8');
const status = fs.readFileSync('api/revenue-status.js', 'utf8');
const landing = fs.readFileSync('index.html', 'utf8');
assert.match(router, /commercialRedirectApproved\(offerId, destination, process\.env\)/);
assert.match(router, /redirect\(303, '\/offers\?status=qualification_required'\)/);
assert.ok(!status.includes("checkout: 'live'"));
assert.ok(!status.includes("payout_account: 'configured'"));
assert.ok(!landing.includes('Each offer below has live Stripe checkout'));
assert.ok(!landing.includes('Production-ready professional services'));
assert.ok(!landing.includes('href="/api/go?'));
console.log(JSON.stringify({ status:'PASS', synthetic_checks: 8 + REQUIRED_EVIDENCE.length, production_checkout_enabled: false }));
