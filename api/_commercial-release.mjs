// Fail-closed, per-offer release contract. No provider calls or secrets here.
// A manifest is an approval pointer, not a substitute for independent reconciliation.
export const REQUIRED_EVIDENCE = Object.freeze([
  'identity_and_owner_approval',
  'live_payment_link_and_price',
  'signed_provider_ingress',
  'durable_idempotent_order',
  'fulfillment_or_entitlement',
  'refund_and_reversal',
  'payout_and_settlement'
]);

export function commercialRedirectApproved(offerId, destination, env = {}) {
  if (env.NEBULA_COMMERCIAL_RELEASE_MODE !== 'approved') return false;
  if (!offerId || typeof destination !== 'string' || !/^https:\/\/(?:book|buy)\.stripe\.com\//.test(destination)) return false;
  let manifest;
  try { manifest = JSON.parse(env.NEBULA_COMMERCIAL_RELEASE_MANIFEST || ''); }
  catch { return false; }
  if (manifest?.version !== 1 || !Array.isArray(manifest.offers)) return false;
  const entries = manifest.offers.filter(row => row?.id === offerId);
  if (entries.length !== 1) return false;
  const release = entries[0];
  if (release?.decision !== 'OWNER_APPROVED' || release?.stripe_url !== destination) return false;
  if (typeof release?.approval_id !== 'string' || release.approval_id.trim().length < 8) return false;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(release.approved_at || '') || !Number.isFinite(Date.parse(release.approved_at))) return false;
  if (!release?.evidence || typeof release.evidence !== 'object') return false;
  return REQUIRED_EVIDENCE.every(key => {
    const v = release.evidence[key];
    return typeof v === 'string' && v.trim().length >= 8;
  });
}
