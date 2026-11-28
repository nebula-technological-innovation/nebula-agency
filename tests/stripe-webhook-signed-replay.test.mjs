// Synthetic signed Stripe events. NO provider network, secrets, or real charges.
// Requires Node 22+ with node:module.stripTypeScriptTypes.
// node --test tests/stripe-webhook-signed-replay.test.mjs
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shared = readFileSync(resolve(root, 'supabase/functions/_shared/canonical-entitlement-forwarder.ts'), 'utf8');
const handlerSource = readFileSync(resolve(root, 'supabase/functions/stripe-revenue-webhook/index.ts'), 'utf8');
const asDataUrl = (source) => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
let handler;
const state = {
  webhookSecret: 'signed-mock-not-a-real-secret',
  forwardUrl: 'https://internal.mock.invalid',
  forwardToken: 'in-memory-token',
  paidEvents: new Set(),
  canonicalEvents: new Set(),
  forwards: [],
  writes: [],
  upstreamUnavailable: false,
};

globalThis.Deno = {
  env: { get(name) {
    return ({ SUPABASE_URL: 'https://supabase.mock.invalid', SUPABASE_SERVICE_ROLE_KEY: 'in-memory-role' })[name];
  }},
  serve(fn) { handler = fn; },
};
globalThis.__mockCreateClient = () => ({
  async rpc(method, args) {
    if (method === 'get_runtime_secret') {
      const val = {
        stripe_webhook_secret: state.webhookSecret,
        canonical_entitlement_service_url: state.forwardUrl,
        canonical_entitlement_event_token: state.forwardToken,
      };
      return { data: val[args.p_key] ?? null, error: null };
    }
    if (method === 'record_revenue_checkout') {
      state.writes.push({method,args});
      const duplicate = state.paidEvents.has(args.p_provider_event_id);
      state.paidEvents.add(args.p_provider_event_id);
      return {data: [{fulfillment_status: args.p_fulfillment_status, duplicate}], error: null};
    }
    if (method === 'process_software_entitlement_event') {
      state.writes.push({method,args});
      return {data: [{result: 'processed'}], error: null};
    }
    throw new Error('Unexpected in-memory RPC method: ' + method);
  }
});
globalThis.fetch = async (input, init) => {
  assert.equal(String(input), state.forwardUrl + '/internal/payment-events');
  const body = JSON.parse(init.body);
  assert.equal(init.headers['idempotency-key'], body.event_id);
  state.forwards.push({body,headers:init.headers});
  if (state.upstreamUnavailable) return new Response(JSON.stringify({error:'unavailable'}), {
    status: 503, headers:{'content-type':'application/json'}});
  const duplicate = state.canonicalEvents.has(body.event_id);
  state.canonicalEvents.add(body.event_id);
  return new Response(JSON.stringify({
    status: duplicate ? 'duplicate' : 'processed', event_id:body.event_id, order_id:1001,
  }), {status:200,headers:{'content-type':'application/json'}});
};

const transformedShared = stripTypeScriptTypes(shared, {mode:'transform'});
const sharedUrl = asDataUrl(transformedShared);
let altered = handlerSource
  .replace(/^import "jsr:[^\n]+";\s*/m, '')
  .replace(/^import \{ createClient \} from "https:\/\/[^\n]+";\s*/m,
    'const createClient = globalThis.__mockCreateClient;\n')
  .replace(/import \{\s*CanonicalForwardError,\s*forwardCanonicalEntitlement,\s*\} from "\.\.\/_shared\/canonical-entitlement-forwarder\.ts";/,
    'import { CanonicalForwardError, forwardCanonicalEntitlement } from "' + sharedUrl + '";');
assert.ok(!altered.includes('jsr:@supabase') && !altered.includes('https://esm.sh'),
  'Test transport must never import provider libraries');
await import(asDataUrl(stripTypeScriptTypes(altered, {mode:'transform'})));
assert.equal(typeof handler,'function','Expected Deno.serve handler to be registered');

beforeEach(() => {
  state.webhookSecret = 'signed-mock-not-a-real-secret';
  state.forwardUrl = 'https://internal.mock.invalid';
  state.forwardToken = 'in-memory-token';
  state.paidEvents.clear();
  state.canonicalEvents.clear();
  state.forwards.length = 0;
  state.writes.length = 0;
  state.upstreamUnavailable = false;
});

const checkout = (changes = {}) => ({
  id:'evt_synthetic_paid_1001',type:'checkout.session.completed',livemode:true,
  data:{object:{
    id:'cs_synthetic_1001',payment_status:'paid',payment_intent:'pi_synthetic_1001',
    customer_email:'mock-customer@example.invalid',amount_total:25000,currency:'usd',
    metadata:{commercial_offer_id:'strategy_architecture_discovery'},
    ...(changes.session || {}),
  }},
  ...(changes.event || {}),
});
const invoice = (changes = {}) => ({
  id:'evt_synthetic_invoice_1002',type:'invoice.paid',livemode:true,
  data:{object:{
    subscription:'sub_synthetic_1002',customer_email:'mock-customer@example.invalid',
    amount_paid:2500,currency:'usd',
    lines:{data:[{price:{id:'price_synthetic',metadata:{nebula_sku:'nebula_api',nebula_tier:'basic'}}}]},
    ...changes,
  }},
});
async function send(event, options = {}) {
  const raw = JSON.stringify(event);
  const timestamp = options.timestamp ?? Math.floor(Date.now()/1000);
  const signature = createHmac('sha256', state.webhookSecret)
    .update(String(timestamp) + '.' + raw).digest('hex');
  const request = new Request('https://webhook.mock.invalid/',{
    method:'POST',body:raw,headers:{
      'content-type':'application/json',
      'stripe-signature':'t=' + timestamp + ',v1=' + (options.badSignature ? '0'.repeat(64) : signature),
    },
  });
  const res = await handler(request);
  return {status:res.status,body:await res.json()};
}

test('genuine HMAC signature required; tampering never persists a record', async () => {
  const r=await send(checkout(),{badSignature:true});
  assert.equal(r.status,400);
  assert.equal(state.writes.length,0);
});
test('stale signed event is rejected before persistence', async () => {
  const r=await send(checkout(),{timestamp:Math.floor(Date.now()/1000)-600});
  assert.equal(r.status,400);
  assert.equal(state.writes.length,0);
});
test('paid checkout must not 2xx when canonical target is absent',async()=>{
  state.forwardUrl = '';
  const r=await send(checkout());
  assert.equal(r.status,503);
  assert.equal(state.writes.length,1);
  assert.equal(state.forwards.length,0);
});
test('failed canonical delivery remains retryable; restored replay is idempotent',async()=>{
  state.upstreamUnavailable=true;
  const first=await send(checkout());
  assert.equal(first.status,503);
  state.upstreamUnavailable=false;
  const retry=await send(checkout());
  assert.equal(retry.status,200);
  assert.equal(retry.body.duplicate,true);
  const again=await send(checkout());
  assert.equal(again.status,200);
  assert.equal(state.canonicalEvents.size,1);
  assert.equal(state.forwards[0].headers['idempotency-key'],checkout().id);
});
test('paid checkout with missing amount does not forward invented money',async()=>{
  const r=await send(checkout({session:{amount_total:null}}));
  assert.equal(r.status,503);
  assert.equal(state.forwards.length,0);
});
test('recognized paid invoice with missing subscription is retryable',async()=>{
  const r=await send(invoice({subscription:null}));
  assert.equal(r.status,503);
  assert.equal(state.forwards.length,0);
});
test('recognized paid invoice with missing amount never defaults to zero',async()=>{
  const r=await send(invoice({amount_paid:null}));
  assert.equal(r.status,503);
  assert.equal(state.forwards.length,0);
});
test('recognized paid invoice with missing currency never defaults to USD',async()=>{
  const r=await send(invoice({currency:null}));
  assert.equal(r.status,503);
  assert.equal(state.forwards.length,0);
});
