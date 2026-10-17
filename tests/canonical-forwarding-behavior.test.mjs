// Non-charge transport contract tests; only synthetic in-memory RPC and fetch.
// Node 22+: node --experimental-transform-types --test tests/canonical-forwarding-behavior.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forwardCanonicalEntitlement, CanonicalForwardError } from '../supabase/functions/_shared/canonical-entitlement-forwarder.ts';

const path = '/internal/payment-events';
const payload = Object.freeze({event_id: 'evt_mock_only_001', paid: true, amount: 25000,
  currency: 'usd', product_id: 'strategy_architecture_discovery'});
function admin(url = 'https://localhost', token = 'mock-token') {
  return {rpc: async (_method, {p_key}) => ({data: p_key === 'canonical_entitlement_service_url' ? url : token, error: null})};
}
function response(body, status = 200, type = 'application/json') {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body),
    {status, headers: {'content-type': type}});
}
async function rejected(promise, code) {
  await assert.rejects(promise, error => error instanceof CanonicalForwardError && error.code === code);
}

test('missing event identity rejects without contacting destination', async () => {
  let called = false;
  await rejected(forwardCanonicalEntitlement(admin(), path, {...payload, event_id: ''}, async () => {
    called = true; return response({ok:true});
  }), 'canonical_entitlement_forward_failed');
  assert.equal(called, false);
});

test('missing token or URL rejects without network call', async () => {
  for(const [url, token] of [['', 'mock-token'], ['https://localhost','']]) {
    let called = false;
    await rejected(forwardCanonicalEntitlement(admin(url,token), path, payload, async()=>{
      called = true;return response({ok:true});
    }), 'canonical_entitlement_forwarding_not_configured');
    assert.equal(called,false);
  }
});

test('non-TLS destination fails closed', async () => {
  await rejected(forwardCanonicalEntitlement(admin('http://payments.example.test'), path, payload,
    async()=>{throw new Error('network must not run');}), 'canonical_entitlement_forwarding_not_configured');
});

test('mock 503 and non-JSON 200 cannot acknowledge fulfillment', async()=>{
  await rejected(forwardCanonicalEntitlement(admin(), path, payload, async()=>response({error:'down'},503)),
    'canonical_entitlement_forward_failed');
  await rejected(forwardCanonicalEntitlement(admin(), path, payload, async()=>response('<html>OK</html>',200,'text/html')),
    'canonical_entitlement_forward_failed');
});

test('JSON 200 with not_configured or rejected cannot acknowledge fulfillment', async()=>{
  for(const state of ['not_configured','pending_review','rejected','unauthorized','ignored','failed']) {
    await rejected(forwardCanonicalEntitlement(admin(), path, payload,
      async()=>response({canonical_status:state})), 'canonical_entitlement_forward_failed');
  }
});

test('generic HTTP 200 cannot count as durable payment acknowledgment', async()=>{
  for(const bad of [{},{ok:true},{status:'processed'},
      {status:'processed',event_id:'evt_wrong',order_id:1},
      {status:'processed',event_id:payload.event_id,order_id:null},
      {status:'ignored',event_id:payload.event_id,order_id:3}]) {
    await rejected(forwardCanonicalEntitlement(admin(),path,payload,async()=>response(bad)),
      'canonical_entitlement_forward_failed');
  }
});

test('duplicate durable order is accepted only for the matching event', async()=>{
  const r = await forwardCanonicalEntitlement(admin(),path,payload,
    async()=>response({status:'duplicate',event_id:payload.event_id,order_id:11}));
  assert.equal(r.status,'duplicate');
});

test('successful mock acknowledgment carries stable idempotency key and original amount', async()=>{
  const seen=[];
  const call=async (url, init)=>{
    seen.push({url:String(url), headers:init.headers, body:JSON.parse(init.body)});
    return response({status:'processed',event_id:payload.event_id,order_id:17});
  };
  const one=await forwardCanonicalEntitlement(admin(),path,payload,call);
  const two=await forwardCanonicalEntitlement(admin(),path,payload,call);
  assert.equal(one.status,'processed');assert.equal(two.status,'processed');
  assert.equal(seen.length,2);
  for(const item of seen){
    assert.equal(item.headers['idempotency-key'],payload.event_id);
    assert.equal(item.body.amount,25000);
    assert.equal(item.body.currency,'usd');
    assert.equal(item.url,'https://localhost/internal/payment-events');
  }
});
