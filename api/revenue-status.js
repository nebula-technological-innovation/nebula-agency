// Public read-only status reports release eligibility, not a claim of collected revenue.
// Never derive "live" from product existence, URL reachability, or a READY deployment.
const OFFER_FAMILIES = Object.freeze([
  'consulting',
  'engineering',
  'documentation',
  'data_integration',
  'security_services',
  'marketing_sales_ops',
  'digital_operator_kits',
  'ai_subscriptions'
]);

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  return res.status(200).json({
    service: 'nebula-public-commerce-readiness',
    source: 'public_release_policy',
    checkout: 'RELEASE_HELD_PENDING_PROVIDER_EVIDENCE',
    collected_revenue: 'NOT_REPORTED_BY_THIS_ENDPOINT',
    payout_account: 'NOT_VERIFIED_BY_THIS_ENDPOINT',
    offers: OFFER_FAMILIES.map(id => ({ id, state: 'QUALIFICATION_ONLY' })),
    software_entitlements: 'RELEASE_GATED',
    supplier_commerce: 'PROVIDER_AND_FULFILLMENT_GATED',
    regulated_streams: 'LEGAL_AND_PROVIDER_GATED',
    note: 'This endpoint is not a live provider reconciliation or sale confirmation.',
    timestamp: new Date().toISOString()
  });
}
