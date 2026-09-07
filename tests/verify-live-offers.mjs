import fs from 'node:fs';

const expected = new Map(Object.entries({
  'atlas-assessment': 'https://book.stripe.com/4gM9AU8xJdHmgZQ77vbMQ0w',
  strategy_architecture_discovery: 'https://book.stripe.com/8x2cN6bJV5aQfVM77vbMQ0c',
  automation_integration_sprint: 'https://book.stripe.com/00w9AU9BNeLqeRI77vbMQ0d',
  technical_documentation_sprint: 'https://book.stripe.com/5kQ4gAeW7gTycJAbnLbMQ0e',
  data_integration_assessment: 'https://book.stripe.com/cNi4gAg0b5aQaBsdvTbMQ0j',
  security_assessment: 'https://book.stripe.com/8x23cw15h0UAfVMcrPbMQ0k',
  b2b_revenue_operations_sprint: 'https://book.stripe.com/3cI7sM9BNcDi24W77vbMQ0l',
  'review-relay': 'https://buy.stripe.com/28EdRa15hdHm6lcbnLbMQ0t',
  'after-hours-kit': 'https://buy.stripe.com/8x2dRabJV1YEeRIezXbMQ0s',
  'site-sprint-kit': 'https://buy.stripe.com/6oU14o7tFavadNEdvTbMQ0r',
  'client-handoff-pack': 'https://buy.stripe.com/eVq28sdS30UA7pg1NbbMQ0q',
  'offer-math-workbook': 'https://buy.stripe.com/3cIdRa8xJfPubFw77vbMQ0p',
  'ship-gate-pack': 'https://buy.stripe.com/eVq9AUg0beLqaBsdvTbMQ0o',
  'collections-pack': 'https://buy.stripe.com/eVqaEY3dp0UAcJAcrPbMQ0n',
  'agent-ops-pack': 'https://buy.stripe.com/14A4gA01d46M9xo4ZnbMQ0m',
}));

const router = fs.readFileSync('api/go.js', 'utf8');
for (const [offer, url] of expected) {
  if (!router.includes(`'${offer}': '${url}'`) &&
      !router.includes(`${offer}: '${url}'`)) {
    throw new Error(`verified offer mapping missing or drifted: ${offer}`);
  }
}

const pages = [
  fs.readFileSync('index.html', 'utf8'),
  fs.readFileSync('landing-pages/operator-kits.html', 'utf8'),
].join('\n');

const referenced = [
  ...pages.matchAll(/\/api\/go\?offer=([^&"'\s]+)/g),
].map((match) => match[1]);

for (const offer of referenced) {
  if (!expected.has(offer)) {
    throw new Error(`customer-facing page references unknown offer: ${offer}`);
  }
}

for (const offer of expected.keys()) {
  if (!referenced.includes(offer)) {
    throw new Error(`verified live offer is not customer-facing: ${offer}`);
  }
}

if (expected.size !== 15) {
  throw new Error(`expected 15 verified offers, found ${expected.size}`);
}

console.log(JSON.stringify({
  status: 'PASS',
  verified_offer_count: expected.size,
  customer_facing_offer_count: new Set(referenced).size,
}));
