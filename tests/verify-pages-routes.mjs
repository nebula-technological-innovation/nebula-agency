import assert from 'node:assert/strict';
import { onRequestGet as checkout } from '../functions/api/go.js';
import { onRequestGet as readiness } from '../functions/api/revenue-status.js';
import { OFFER_DESTINATIONS } from '../api/_offer-catalog.mjs';
import { REQUIRED_EVIDENCE } from '../api/_commercial-release.mjs';

const base = 'https://nebula-agency-cloudflare-review.pages.dev/api/go';
const invoke = (q, env) => checkout({
  request: new Request(base + q),
  env
});

const unknown = await invoke('?offer=made-up-product', {});
assert.equal(unknown.status, 404);
assert.equal(unknown.headers.get('cache-control'), 'no-store');
assert.equal((await unknown.json()).error, 'unknown_offer');

for (const query of [
  '?offer=atlas-assessment',
  '?offer=strategy_architecture_discovery',
  '?offer=agent-ops-pack',
  '?offer=atlas-assessment&next=https://evil.example/pay',
]) {
  const response = await invoke(query, {});
  assert.equal(response.status, 303, query);
  assert.equal(response.headers.get('x-nebula-commercial-state'), 'release-held');
  assert.equal(new URL(response.headers.get('location')).pathname, '/offers');
  assert.equal(new URL(response.headers.get('location')).origin, 'https://nebula-agency-cloudflare-review.pages.dev');
}
const ev = Object.fromEntries(REQUIRED_EVIDENCE.map(k => [k, 'synthetic://evidence/' + k]));
const offer = 'atlas-assessment';
const seller = 'acct_SYNTHETIC123456789012';
const secret = 'synthetic-only-hmac-secret-never-use-for-real-releases-123';
const now = Date.now();
const manifest = { version:2, offers:[{
  id:offer, decision:'OWNER_APPROVED', stripe_url:OFFER_DESTINATIONS[offer],
  seller_account:seller, approval_id:'synthetic-approval-001',
  approved_at:new Date(now-3600000).toISOString(),
  expires_at:new Date(now+86400000).toISOString(), evidence:ev
}] };
const signingKey = await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
const signature = async m => Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',signingKey,new TextEncoder().encode(JSON.stringify(m)))),x=>x.toString(16).padStart(2,'0')).join('');
const approvedEnv = {
  NEBULA_COMMERCIAL_RELEASE_MODE:'approved',
  NEBULA_COMMERCIAL_RELEASE_MANIFEST:JSON.stringify(manifest),
  NEBULA_COMMERCIAL_RELEASE_HMAC_SECRET:secret,
  NEBULA_COMMERCIAL_RELEASE_HMAC_SHA256:await signature(manifest),
  NEBULA_COMMERCIAL_SELLER_ACCOUNT:seller
};
const syntheticallyApproved = await invoke('?offer=' + offer, approvedEnv);
assert.equal(syntheticallyApproved.status,302);
assert.equal(syntheticallyApproved.headers.get('location'),OFFER_DESTINATIONS[offer]);
assert.equal(syntheticallyApproved.headers.get('x-nebula-commercial-state'),'owner-approved');
const unrelatedHeld = await invoke('?offer=agent-ops-pack',approvedEnv);
assert.equal(unrelatedHeld.status,303);
const tampered = structuredClone(manifest);
tampered.offers[0].stripe_url = 'https://evil.example/checkout';
const denied = await invoke('?offer=' + offer,{
  ...approvedEnv,
  NEBULA_COMMERCIAL_RELEASE_MANIFEST:JSON.stringify(tampered)
});
assert.equal(denied.status,303);
const missingSignature = await invoke('?offer=' + offer,{
  ...approvedEnv,NEBULA_COMMERCIAL_RELEASE_HMAC_SHA256:''
});
assert.equal(missingSignature.status,303);
const info = await readiness();
assert.equal(info.status, 200);
assert.equal(info.headers.get('cache-control'), 'no-store');
const state = await info.json();
assert.equal(state.checkout, 'RELEASE_HELD_PENDING_PROVIDER_EVIDENCE');
assert.equal(state.collected_revenue, 'NOT_REPORTED_BY_THIS_ENDPOINT');

console.log(JSON.stringify({
  result: 'PASS',
  simulated_hosting: 'cloudflare-pages',
  scope: 'synthetic_only',
  tested_negative_and_positive_routes: true,
  live_charge_created: false
}));
