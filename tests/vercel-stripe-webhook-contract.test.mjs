// Non-charge contract for the SECONDARY Vercel Stripe destination.
// This endpoint is deliberately non-authoritative: it may NEVER grant a paid order.
// node --test tests/vercel-stripe-webhook-contract.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import handler from '../api/stripe-webhook.js';

const MOCK_SECRET = 'stripe-webhook-local-test-not-live';
function signed(event, valid = true) {
  const raw = JSON.stringify(event);
  const ts = Math.floor(Date.now()/1000);
  const signature = createHmac('sha256', MOCK_SECRET).update(String(ts) + '.' + raw).digest('hex');
  return {raw, header:'t=' + ts + ',v1=' + (valid ? signature : '0'.repeat(64))};
}
async function invoke({method='POST', event, valid=true, configured=true}={}) {
  const oldSecret=process.env.STRIPE_WEBHOOK_SECRET;
  const oldDb=process.env.DATABASE_URL;
  // Isolate the environment: no provider credentials, no fetch and no DB writes.
  process.env.STRIPE_WEBHOOK_SECRET = configured ? MOCK_SECRET : '';
  process.env.DATABASE_URL = configured ? 'mock://not-connected' : '';
  const {raw,header} = signed(event || {id:'evt_synthetic',type:'checkout.session.completed',
    data:{object:{payment_status:'paid'}}},valid);
  const req = Readable.from([Buffer.from(raw)]);
  req.method=method;
  req.headers={'stripe-signature':header};
  let code=null, payload=null;
  const res={
    setHeader(){return this;},
    status(status){code=status;return this;},
    json(obj){payload=obj;return this;}
  };
  try {await handler(req,res);return {code,payload};}
  finally {
    if(oldSecret===undefined)delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET=oldSecret;
    if(oldDb===undefined)delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL=oldDb;
  }
}
const paid={id:'evt_synthetic_paid_100',type:'checkout.session.completed',
  data:{object:{payment_status:'paid',id:'cs_synthetic_100'}}};
test('rejects unexpected method',async()=>{
  const r=await invoke({method:'GET'});
  assert.equal(r.code,405);
});
test('rejects requests without verified runtime config',async()=>{
  const r=await invoke({configured:false});
  assert.equal(r.code,503);
});
test('rejects invalid signature without processing',async()=>{
  const r=await invoke({event:paid,valid:false});
  assert.equal(r.code,400);
});
test('signed paid events are never falsely acknowledged as fulfilled',async()=>{
  for(const type of ['checkout.session.completed','checkout.session.async_payment_succeeded']){
    const r=await invoke({event:{...paid,type}});
    assert.equal(r.code,503);
    assert.equal(r.payload.error,'durable_order_repository_not_ready');
  }
});
test('replayed paid event remains fail closed',async()=>{
  const first=await invoke({event:paid});
  const second=await invoke({event:paid});
  assert.equal(first.code,503);
  assert.equal(second.code,503);
});
test('unpaid checkout is ignored without granting access',async()=>{
  const r=await invoke({event:{...paid,data:{object:{payment_status:'unpaid'}}}});
  assert.equal(r.code,200);
  assert.equal(r.payload.fulfillment,'unpaid_ignored');
});
test('unsupported events cannot claim fulfillment',async()=>{
  const r=await invoke({event:{id:'evt_synthetic_other',type:'payment_intent.succeeded',
    data:{object:{id:'pi_synthetic'}}}});
  assert.equal(r.code,200);
  assert.equal(r.payload.fulfillment,'not_applicable');
});
