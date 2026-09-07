export const OFFERS = Object.freeze({
  'atlas-assessment': {
    url: 'https://book.stripe.com/4gM9AU8xJdHmgZQ77vbMQ0w',
    kind: 'professional_service',
    fulfillment: 'bounded_manual_professional_service'
  },
  strategy_architecture_discovery: {
    url: 'https://book.stripe.com/8x2cN6bJV5aQfVM77vbMQ0c',
    kind: 'professional_service',
    fulfillment: 'bounded_manual_professional_service'
  },
  automation_integration_sprint: {
    url: 'https://book.stripe.com/00w9AU9BNeLqeRI77vbMQ0d',
    kind: 'professional_service',
    fulfillment: 'bounded_manual_professional_service'
  },
  technical_documentation_sprint: {
    url: 'https://book.stripe.com/5kQ4gAeW7gTycJAbnLbMQ0e',
    kind: 'professional_service',
    fulfillment: 'bounded_manual_professional_service'
  },
  data_integration_assessment: {
    url: 'https://book.stripe.com/cNi4gAg0b5aQaBsdvTbMQ0j',
    kind: 'professional_service',
    fulfillment: 'bounded_manual_professional_service'
  },
  security_assessment: {
    url: 'https://book.stripe.com/8x23cw15h0UAfVMcrPbMQ0k',
    kind: 'professional_service',
    fulfillment: 'bounded_manual_professional_service'
  },
  b2b_revenue_operations_sprint: {
    url: 'https://book.stripe.com/3cI7sM9BNcDi24W77vbMQ0l',
    kind: 'professional_service',
    fulfillment: 'bounded_manual_professional_service'
  },
  'review-relay': {
    url: 'https://buy.stripe.com/28EdRa15hdHm6lcbnLbMQ0t',
    kind: 'digital_product',
    fulfillment: 'supabase_secure_digital_delivery'
  },
  'after-hours-kit': {
    url: 'https://buy.stripe.com/8x2dRabJV1YEeRIezXbMQ0s',
    kind: 'digital_product',
    fulfillment: 'supabase_secure_digital_delivery'
  },
  'site-sprint-kit': {
    url: 'https://buy.stripe.com/6oU14o7tFavadNEdvTbMQ0r',
    kind: 'digital_product',
    fulfillment: 'supabase_secure_digital_delivery'
  },
  'client-handoff-pack': {
    url: 'https://buy.stripe.com/eVq28sdS30UA7pg1NbbMQ0q',
    kind: 'digital_product',
    fulfillment: 'supabase_secure_digital_delivery'
  },
  'offer-math-workbook': {
    url: 'https://buy.stripe.com/3cIdRa8xJfPubFw77vbMQ0p',
    kind: 'digital_product',
    fulfillment: 'supabase_secure_digital_delivery'
  },
  'ship-gate-pack': {
    url: 'https://buy.stripe.com/eVq9AUg0beLqaBsdvTbMQ0o',
    kind: 'digital_product',
    fulfillment: 'supabase_secure_digital_delivery'
  },
  'collections-pack': {
    url: 'https://buy.stripe.com/eVqaEY3dp0UAcJAcrPbMQ0n',
    kind: 'digital_product',
    fulfillment: 'supabase_secure_digital_delivery'
  },
  'agent-ops-pack': {
    url: 'https://buy.stripe.com/14A4gA01d46M9xo4ZnbMQ0m',
    kind: 'digital_product',
    fulfillment: 'supabase_secure_digital_delivery'
  }
});

export function offerSummary() {
  const entries = Object.entries(OFFERS);
  const professional = entries.filter(([, offer]) => offer.kind === 'professional_service');
  const digital = entries.filter(([, offer]) => offer.kind === 'digital_product');
  return {
    live_checkout_offer_count: entries.length,
    professional_service_offer_count: professional.length,
    digital_product_offer_count: digital.length,
    offers: entries.map(([id, offer]) => ({
      id,
      state: 'ACTIVE',
      kind: offer.kind,
      fulfillment: offer.fulfillment
    }))
  };
}
