// This is a fail-closed release *authorization* check, not a provider reconciliation.
// Production manifests need a valid HMAC, exact seller account and unexpired owner
// approval. The signing secret is set in protected runtime configuration, never in code.
export const REQUIRED_EVIDENCE = Object.freeze([
  'identity_and_owner_approval',
  'live_payment_link_and_price',
  'signed_provider_ingress',
  'durable_idempotent_order',
  'fulfillment_or_entitlement',
  'refund_and_reversal',
  'payout_and_settlement'
]);

const encoder = new TextEncoder();
const asHexBytes = value => new Uint8Array(value.match(/.{2}/g).map(byte => Number.parseInt(byte, 16)));

async function verifiedManifestHmac(raw, secret, signature) {
  if (typeof raw !== 'string' || typeof secret !== 'string' || encoder.encode(secret).byteLength < 32) return false;
  if (typeof signature !== 'string' || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  if (!globalThis.crypto?.subtle) return false; // no fallback that skips authentication
  try {
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['verify']);
    return await crypto.subtle.verify('HMAC', key, asHexBytes(signature), encoder.encode(raw));
  } catch { return false; }
}

export async function commercialRedirectApproved(offerId, destination, env = {}) {
  if (env.NEBULA_COMMERCIAL_RELEASE_MODE !== 'approved') return false;
  if (typeof offerId !== 'string' || !offerId || typeof destination !== 'string') return false;
  if (!/^https:\/\/(?:book|buy)\.stripe\.com\/[A-Za-z0-9_-]+$/.test(destination)) return false;
  const account = env.NEBULA_COMMERCIAL_SELLER_ACCOUNT;
  if (typeof account !== 'string' || !/^acct_[A-Za-z0-9]{12,}$/.test(account)) return false;
  const raw = env.NEBULA_COMMERCIAL_RELEASE_MANIFEST;
  if (!await verifiedManifestHmac(raw,env.NEBULA_COMMERCIAL_RELEASE_HMAC_SECRET,env.NEBULA_COMMERCIAL_RELEASE_HMAC_SHA256)) return false;
  let manifest;
  try { manifest = JSON.parse(raw); }
  catch { return false; }
  if (manifest?.version !== 2 || !Array.isArray(manifest.offers)) return false;
  const entries = manifest.offers.filter(row => row?.id === offerId);
  if (entries.length !== 1) return false;
  const release = entries[0];
  if (release.decision !== 'OWNER_APPROVED' || release.stripe_url !== destination || release.seller_account !== account) return false;
  if (typeof release.approval_id !== 'string' || release.approval_id.trim().length < 8) return false;
  const approvedAt = Date.parse(release.approved_at);
  const expiresAt = Date.parse(release.expires_at);
  const now = Date.now();
  if (![approvedAt,expiresAt].every(Number.isFinite)) return false;
  if (approvedAt > now || expiresAt <= now || expiresAt <= approvedAt || expiresAt - approvedAt > 7*24*60*60*1000) return false;
  if (!release.evidence || typeof release.evidence !== 'object' || Array.isArray(release.evidence)) return false;
  return REQUIRED_EVIDENCE.every(key => typeof release.evidence[key] === 'string' && release.evidence[key].trim().length >= 8);
}
