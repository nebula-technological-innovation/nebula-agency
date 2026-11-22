# Signed commercial release — operator review contract (2026-11-21)

**Default state: HOLD.** This source-level authorization mechanism is *not* Stripe transaction verification, customer consent, legal authorization, or a license to sell. Customer-facing purchases remain disabled until separate owner release.

## Required independent positive evidence (per Stripe offer)
1. Current legally authorized seller/merchant and an explicitly reviewed engagement, terms and customer remedy.
2. Exact live Stripe `acct_...` merchant identity, Payment Link, price, taxes/currency and active state.
3. Valid Stripe signature verification against the intended webhook endpoint and account.
4. Durable, idempotent payment event → order with concurrency/restart/replay coverage.
5. Verified work order/entitlement and customer delivery or supplier fulfillment; no cross-customer access.
6. Cancellation/refund/dispute and entitlement or service reversal evidence.
7. Reconciled payout/settlement ledger, including fees, net amount and discrepancy handling.

Preserve provider evidence IDs and test run links for all seven items. A synthetic test record cannot satisfy live evidence.

## Application-level authorization (additional defense in depth)
The route checks all of these before offering a Stripe redirect:
- `NEBULA_COMMERCIAL_RELEASE_MODE` equals `approved` **and** an exact account is specified with `NEBULA_COMMERCIAL_SELLER_ACCOUNT=acct_...`.
- Manifest version is **2** and exactly one entry matches the offer ID.
- Manifest bytes are authenticated by HMAC-SHA256 using `NEBULA_COMMERCIAL_RELEASE_HMAC_SECRET` (32+ bytes) and lower- or upper-case 64-digit hex `NEBULA_COMMERCIAL_RELEASE_HMAC_SHA256`.
- The signed entry specifies the same seller account and exact catalog-linked `book.stripe.com` / `buy.stripe.com` URL.
- Owner approval ID exists, `approved_at` is not in the future, `expires_at` is in the future and at most seven days after approval.
- All seven evidence-reference fields are populated. Actual external provider evidence must be reviewed independently.

The HMAC must be calculated over the **exact raw UTF-8 manifest string** stored in `NEBULA_COMMERCIAL_RELEASE_MANIFEST`. Reformatting the JSON after signing invalidates the signature. No secret, approval, or enabled manifest is supplied with this code. Do not put signing keys in Git, browser code, Pages `_worker.js`, PR comments or test output. A trusted owner-controlled signing workflow, key rotation and revocation process still need implementation before production.

## Rollback
Unset `NEBULA_COMMERCIAL_RELEASE_MODE` or set it to `held` to deny all paid redirects, then verify `/api/go?offer=...` returns **303** to `/offers?status=qualification_required`. Never disable webhook signature checks, RLS, settlement reconciliation or order idempotency to make a product appear purchasable. A preview built with `scripts/build-cloudflare-review.mjs` always denies checkout even if application environment variables are present.

## Verification
`node tests/verify-commercial-release-gate.mjs` exercises signature, seller binding, expiry, evidence and duplicate-denial cases. `node tests/verify-pages-routes.mjs` checks the Cloudflare Functions adapter. `node tests/verify-public-release-copy.mjs` rejects customer-facing static links that bypass the gate. `node tests/verify-cloudflare-preview-bundle.mjs` constructs and executes the entire 30-route review bundle offline.

**All tests are synthetic.** No real purchase, settlement or supplier delivery is inferred.
