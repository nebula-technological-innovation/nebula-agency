import assert from 'node:assert/strict';
import fs from 'node:fs';
import { commercialRedirectApproved, REQUIRED_EVIDENCE } from '../api/_commercial-release.mjs';

const offer = 'atlas-assessment';
const stripe = 'https://book.stripe.com/synthetic-not-live';
const account = 'acct_SYNTHETIC123456789012';
const secret = 'synthetic-only-hmac-secret-never-use-for-real-releases-123';
const evidence = Object.fromEntries(REQUIRED_EVIDENCE.map(k => [k, 'audit://synthetic/' + k]));
const now = Date.now();
const approved = {
  version: 2,
  offers: [{ id: offer, decision:'OWNER_APPROVED', stripe_url:stripe,
    seller_account:account, approval_id:'synthetic-approval-001',
    approved_at:new Date(now - 3600000).toISOString(),
    expires_at:new Date(now + 86400000).toISOString(), evidence
  }]
};
const hex = bytes => Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2,'0')).join('');
const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
const sign = async manifest => hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(JSON.stringify(manifest))));
const envFor = async manifest => ({
  NEBULA_COMMERCIAL_RELEASE_MODE:'approved',
  NEBULA_COMMERCIAL_RELEASE_MANIFEST:JSON.stringify(manifest),
  NEBULA_COMMERCIAL_RELEASE_HMAC_SECRET:secret,
  NEBULA_COMMERCIAL_RELEASE_HMAC_SHA256:await sign(manifest),
  NEBULA_COMMERCIAL_SELLER_ACCOUNT:account
});
const env = await envFor(approved);
let checks = 0;
async function deny(label, candidateOffer = offer, url = stripe, candidateEnv = env) {
  assert.equal(await commercialRedirectApproved(candidateOffer,url,candidateEnv),false,label);
  checks++;
}
await deny('default deny', offer, stripe, {});
await deny('no manifest',offer,stripe,{NEBULA_COMMERCIAL_RELEASE_MODE:'approved'});
await deny('mode disabled',offer,stripe,{...env,NEBULA_COMMERCIAL_RELEASE_MODE:'disabled'});
await deny('no signature',offer,stripe,{...env,NEBULA_COMMERCIAL_RELEASE_HMAC_SHA256:''});
await deny('weak secret',offer,stripe,{...env,NEBULA_COMMERCIAL_RELEASE_HMAC_SECRET:'weak'});
await deny('tampered signature',offer,stripe,{...env,NEBULA_COMMERCIAL_RELEASE_HMAC_SHA256:'0'.repeat(64)});
await deny('wrong seller',offer,stripe,{...env,NEBULA_COMMERCIAL_SELLER_ACCOUNT:'acct_WRONGSELLER123456789'});
await deny('wrong destination',offer,'https://book.stripe.com/wrong',env);
await deny('unknown offer','unknown',stripe,env);
await deny('off-host URL',offer,'https://evil.example/pay',env);
await deny('modified unsigned manifest',offer,stripe,{...env,NEBULA_COMMERCIAL_RELEASE_MANIFEST:JSON.stringify({...approved,offers:[]})});
assert.equal(await commercialRedirectApproved(offer,stripe,env),true,'synthetic proof only');checks++;
for (const key of REQUIRED_EVIDENCE) {
  const missing = structuredClone(approved);
  delete missing.offers[0].evidence[key];
  await deny('missing evidence: '+key,offer,stripe,await envFor(missing));
}
const dupe = structuredClone(approved);dupe.offers.push({...dupe.offers[0]});
await deny('duplicate release',offer,stripe,await envFor(dupe));
const expired = structuredClone(approved);
expired.offers[0].approved_at = new Date(now-7200000).toISOString();
expired.offers[0].expires_at = new Date(now-3600000).toISOString();
await deny('expired',offer,stripe,await envFor(expired));
const future = structuredClone(approved);
future.offers[0].approved_at = new Date(now+7200000).toISOString();
future.offers[0].expires_at = new Date(now+10800000).toISOString();
await deny('future approval',offer,stripe,await envFor(future));
const long = structuredClone(approved);
long.offers[0].expires_at = new Date(now+8*86400000).toISOString();
await deny('overlong approval',offer,stripe,await envFor(long));

const router = fs.readFileSync('api/go.js','utf8');
const status = fs.readFileSync('api/revenue-status.js','utf8');
const landing = fs.readFileSync('index.html','utf8');
assert.match(router,/await commercialRedirectApproved\(offerId, destination, process\.env\)/);
assert.match(router,/redirect\(303, '\/offers\?status=qualification_required'\)/);
assert.ok(!status.includes("checkout: 'live'"));
assert.ok(!status.includes("payout_account: 'configured'"));
assert.ok(!landing.includes('Each offer below has live Stripe checkout'));
assert.ok(!landing.includes('href="/api/go?'));
console.log(JSON.stringify({status:'PASS',synthetic_checks:checks,requires_signed_owner_release:true,production_checkout_enabled:false}));
