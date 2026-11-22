import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Zero-third-party-dependency Cloudflare Pages advanced-mode preview builder.
// Deliberately allowlist ONLY reviewed static public HTML, never the repository root.
const root = process.cwd();
const output = path.resolve(root, process.argv[2] || 'dist-cloudflare-review');
if (!output.startsWith(root + path.sep)) throw new Error('Output directory must remain inside the checkout');

const services = [
  'strategy-architecture-discovery', 'atlas-ai-automation-assessment',
  'automation-integration-sprint', 'technical-documentation-sprint',
  'data-integration-assessment', 'production-safe-security-assessment',
  'b2b-revenue-operations-sprint'
];
const kits = [
  'agent-ops-pack', 'collections-pack', 'ship-gate-pack',
  'offer-math-workbook', 'client-handoff-pack', 'review-relay',
  'after-hours-kit', 'site-sprint-kit', 'ai-automation-starter-kit'
];
const guides = [
  'small-business-ai-automation', 'ai-agent-operations',
  'production-deployment-checklist', 'ai-automation-architecture',
  'workflow-automation', 'technical-documentation',
  'data-integration', 'production-security', 'b2b-revenue-operations'
];
const routes = [
  ['/', 'index.html'],
  ['/offers', 'offers/index.html'],
  ['/landing-pages/revenue-catalog.html', 'landing-pages/revenue-catalog.html'],
  ['/landing-pages/operator-kits.html', 'landing-pages/operator-kits.html'],
  ...services.map(name => ['/landing-pages/services/' + name + '.html', 'landing-pages/services/' + name + '.html']),
  ...kits.map(name => ['/landing-pages/operator-kits/' + name + '.html', 'landing-pages/operator-kits/' + name + '.html']),
  ['/guides', 'guides/index.html'],
  ...guides.map(name => ['/guides/' + name + '.html', 'guides/' + name + '.html'])
];

const sha256 = x => createHash('sha256').update(x).digest('hex');
const pages = Object.create(null), manifest = [];
for (const [route, relative] of routes) {
  const full = path.resolve(root, relative);
  if (!full.startsWith(root + path.sep) || !fs.statSync(full).isFile()) throw new Error('Unsafe/missing page: ' + relative);
  const original = fs.readFileSync(full, 'utf8');
  const html = original.replaceAll('https://nebula-agency-sigma.vercel.app', 'https://nebularoe.com');
  if (/(?:href\s*=\s*["']|href\s*:\s*["'])(?:https:\/\/(?:buy|book)\.stripe\.com\/|\/api\/go\?offer=)/i.test(html)) {
    throw new Error('Direct payment link still visible in ' + relative);
  }
  if (/https:\/\/schema.org\/InStock|through live Stripe checkout|secure Stripe checkout and verified delivery/i.test(html)) {
    throw new Error('Unverified commercial readiness claim in ' + relative);
  }
  if (Object.hasOwn(pages, route)) throw new Error('Duplicate route: ' + route);
  pages[route] = html;
  manifest.push({route, source:relative, source_sha256:sha256(original), delivered_sha256:sha256(html)});
}

const HEADERS = Object.freeze({
  'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store',
  'X-Robots-Tag':'noindex, nofollow', 'Strict-Transport-Security':'max-age=86400',
  'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; form-action 'self' mailto:; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; upgrade-insecure-requests"
});

async function previewFetch(request) {
  const url = new URL(request.url);
  const method = request.method;
  const endpoint = url.pathname.replace(/\/+$/,'') || '/';
  if (method !== 'GET' && method !== 'HEAD') {
    return new Response('Method not allowed',{status:405,headers:HEADERS});
  }
  if (endpoint === '/robots.txt') {
    return new Response('User-agent: *\nDisallow: /\n',{headers:{...HEADERS,'Content-Type':'text/plain; charset=utf-8'}});
  }
  if (endpoint === '/api/go') {
    return new Response(null,{status:303,headers:{
      ...HEADERS,Location:new URL('/offers?status=qualification_required',url).toString(),
      'X-Nebula-Commercial-State':'release-held'
    }});
  }
  if (endpoint === '/api/revenue-status') {
    return Response.json({
      service:'nebula-public-commerce-readiness',
      source:'cloudflare-review-only',
      checkout:'RELEASE_HELD_PENDING_PROVIDER_EVIDENCE',
      collected_revenue:'NOT_REPORTED_BY_THIS_ENDPOINT',
      payout_account:'NOT_VERIFIED_BY_THIS_ENDPOINT'
    },{headers:{...HEADERS,'Content-Type':'application/json; charset=utf-8'}});
  }
  if (endpoint === '/contact') {
    return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Nebula Consultation Inquiry — Review</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><h1>Request a scoped consultation</h1><p>Email <a href="mailto:christianroe@roeacquisitions.net?subject=Nebula%20consultation%20request">Nebula sales</a>. This preview does not accept payment.</p><p><a href="/">Home</a></p></main></body></html>',{headers:HEADERS});
  }
  if (endpoint === '/privacy' || endpoint === '/terms') {
    return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Legal review pending</title></head><body><main><h1>Legal copy pending approval</h1><p>Noncommercial review preview only. No payment or customer data is accepted here.</p><p><a href="/">Home</a></p></main></body></html>',{headers:HEADERS});
  }
  if (!Object.hasOwn(PAGES,endpoint)) return new Response('Review route not published',{status:404,headers:HEADERS});
  return new Response(method === 'HEAD' ? null : PAGES[endpoint],{headers:HEADERS});
}

// Builder output is deterministic for a given source tree; there are no runtime
// provider credentials, data APIs, external fetches, or live purchase paths.
const worker = 'const PAGES = ' + JSON.stringify(pages) + ';\n' +
  'const HEADERS = ' + JSON.stringify(HEADERS) + ';\n' +
  'export default { fetch: ' + previewFetch.toString() + ' };\n';
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'_worker.js'),worker);
fs.writeFileSync(path.join(output,'preview-manifest.json'),JSON.stringify({
  format:1,environment:'preview-only',noindex:true,commercial_release:'HOLD',
  routes:manifest,worker_sha256:sha256(worker)
},null,2)+'\n');
console.log(JSON.stringify({status:'BUILT',routes:routes.length,worker_bytes:Buffer.byteLength(worker),worker_sha256:sha256(worker),output}));
