import assert from 'node:assert/strict';
import fs from 'node:fs';

// Intentionally isolate checkout from marketing analytics. A logging outage
// must not prevent valid customers from reaching the approved Stripe link.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { default: handler } = await import('../api/go.js');

async function invoke(method, offer) {
  const headers = new Map();
  const req = {
    method,
    query: { offer, channel: 'test', campaign: 'bounded-task-sprint' },
    headers: { 'user-agent': 'NebulaAcceptance/1.0' }
  };
  const res = {
    statusCode: 200,
    setHeader(name, value) { headers.set(name, value); },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    redirect(code, url) { this.statusCode = code; this.url = url; return this; }
  };
  await handler(req, res);
  return { res, headers };
}

const approved = await invoke('GET', 'ai-task-sprint');
assert.equal(approved.res.statusCode, 302, 'valid offer should redirect');
assert.equal(approved.res.url, 'https://book.stripe.com/3cI14o7tFfPuaBsbnLbMQ0z');
assert.match(approved.headers.get('Set-Cookie'), /SameSite=Lax; Secure; HttpOnly/);
assert.equal(approved.headers.get('Cache-Control'), 'no-store');

const unknown = await invoke('GET', 'not-an-approved-offer');
assert.equal(unknown.res.statusCode, 404, 'unknown offer must fail closed');
assert.equal(unknown.res.body?.error, 'unknown_offer');

const post = await invoke('POST', 'ai-task-sprint');
assert.equal(post.res.statusCode, 405, 'non-GET must fail closed');
assert.equal(post.res.body?.error, 'method_not_allowed');

const home = fs.readFileSync('index.html', 'utf8');
assert.match(home, /\$99\s*<small>one-time deposit, not the full project price<\/small>/);
assert.match(home, /If Nebula cannot accept the requested scope/);
assert.match(home, /\/api\/go\?offer=ai-task-sprint/);

console.log(JSON.stringify({
  status: 'PASS',
  checks: ['approved_redirect', 'secure_cookie', 'unknown_404', 'post_405', 'deposit_disclosure']
}));