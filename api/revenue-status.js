const LIVE_OFFERS = [
  { id: 'consulting', state: 'ACTIVE', fulfillment: 'manual_professional_service' },
  { id: 'engineering', state: 'ACTIVE', fulfillment: 'manual_professional_service' },
  { id: 'documentation', state: 'ACTIVE', fulfillment: 'manual_professional_service' },
  { id: 'data_integration', state: 'ACTIVE', fulfillment: 'manual_professional_service' },
  { id: 'security_services', state: 'ACTIVE', fulfillment: 'manual_professional_service' },
  { id: 'marketing_sales_ops', state: 'ACTIVE', fulfillment: 'manual_professional_service' }
];

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    service: 'nebula-revenue-backend',
    checkout: 'live',
    payout_account: 'configured',
    offers: LIVE_OFFERS,
    software_entitlements: 'DEPLOYMENT_GATED',
    supplier_commerce: 'PROVIDER_GATED',
    regulated_streams: 'LEGAL_PROVIDER_GATED',
    timestamp: new Date().toISOString()
  });
}
