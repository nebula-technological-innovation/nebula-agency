// Cloudflare Pages status: informational only, never a payment or settlement oracle.
export async function onRequestGet() {
  return Response.json({
    service: 'nebula-public-commerce-readiness',
    checkout: 'RELEASE_HELD_PENDING_PROVIDER_EVIDENCE',
    source: 'public_release_policy',
    collected_revenue: 'NOT_REPORTED_BY_THIS_ENDPOINT',
    payout_account: 'NOT_VERIFIED_BY_THIS_ENDPOINT',
    software_entitlements: 'RELEASE_GATED',
    supplier_commerce: 'PROVIDER_AND_FULFILLMENT_GATED',
    regulated_streams: 'LEGAL_AND_PROVIDER_GATED',
    note: 'Qualified inquiries are accepted. Payments require independent approval and reconciliation.'
  }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
