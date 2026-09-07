import { offerSummary } from './_offers.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const catalog = offerSummary();
  const attributionConfigured = Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  res.status(200).json({
    service: 'nebula-revenue-backend',
    checkout: 'live',
    payout_account: 'configured',
    commercial_readiness: {
      ...catalog,
      verified_realized_revenue_only: true
    },
    marketing_attribution: {
      configured: attributionConfigured,
      authoritative_for_revenue: false,
      mode: 'fail_soft'
    },
    software_entitlements: 'DEPLOYMENT_GATED',
    supplier_commerce: 'PROVIDER_GATED',
    regulated_streams: 'LEGAL_PROVIDER_GATED',
    timestamp: new Date().toISOString()
  });
}
