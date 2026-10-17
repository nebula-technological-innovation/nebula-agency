# Nebula Stripe dual-webhook authority — October 15, 2026

## Verified production state (read-only provider inventory)

Stripe account: Nebula Technological Innovation live
(`acct_1T7akJIyBnnUtutX`).

Two **enabled** webhook endpoints currently subscribe to overlapping
`checkout.session.completed` and `checkout.session.async_payment_succeeded`:

| Endpoint ID | Destination | Observed handler |
|---|---|---|
| `we_1UBiRjIyBnnUtutX76QcNg3I` | `https://zndolvezweaqwpigvwyw.supabase.co/functions/v1/stripe-revenue-webhook` | Active Supabase v12, can acknowledge recognized paid events without forwarding if canonical transport is unconfigured |
| `we_1TDtyMIyBnnUtutXfIzD65Me` | `https://nebula-agency-sigma.vercel.app/api/stripe-webhook` | Main Vercel handler intentionally returns HTTP 503 for all verified paid Checkout events because durable order repository is not implemented |

The Vercel project is `nebula-agency`, with a READY **production**
deployment sourced from `main` commit
`1384a433bf015fcbba57cc171ebcd9bbe88eb5f0`.
Its handler `api/stripe-webhook.js` is blob
`d05138fa272f85bebd70a2a3c12b06b65367c7c4`.
The GitHub repair branch's newer Vercel deployments are **preview**
deployments, not evidence that production changed.

The secondary Vercel handler contains **no successful paid fulfillment path**;
its hard-coded 503 avoids double grant but can produce failed deliveries and
Stripe retries. Noncheckout events return `not_applicable`, not economic
processing. It is not safe to treat either endpoint's HTTP 200 alone as a
completed paid order.

## Desired authority and release sequence

1. Preserve the existing Supabase webhook as the candidate canonical Stripe
   ingress. Reconcile exact deployed v12 against the proposed handler,
   including offer allowlist aliases, metadata, signed timestamp HMAC,
   customer/payment identity, atomic persistence, replay, outbox and
   downstream entitlement/service lifecycle.
2. Run **offline** HMAC-signed event replays, exercising actual candidate
   handler, mock database and canonical forwarder. Cover bad/stale signature,
   missing provider identity, missing payment amount/currency, slow or failed
   downstream transport, unknown offer, duplicate event, asynchronous
   settlement, subscription invoices, refunds and reversals.
3. The canonical downstream acknowledgment must include a matching
   `event_id`, positive integer `order_id`, and terminal
   `processed`/`duplicate` state. Return retryable 5xx on missing
   configuration or delivery failure. A generic 200/empty body is not enough.
4. Independently verify Stripe **test/sandbox** events and account-scoped
   provider destinations without live charges, as well as durable ledger
   idempotency and exactly-once economic effect.
5. Review the second Vercel webhook subscription with the operator. **Only
   after the first ingress has verified complete coverage** may the
   redundant paid-checkout subscription be disabled or event selections
   changed in Stripe. The second endpoint must not be silently promoted
   to a merchant-of-record or entitlement authority.
6. Reconcile the newly verified payment-to-order path with Revenue OS,
   exact-head GitHub CI/security/governance, rollback and explicit production
   approval.

## Candidate tests (no network or live payment)

```sh
node --experimental-transform-types --test \
  tests/canonical-forwarding-behavior.test.mjs \
  tests/vercel-stripe-webhook-contract.test.mjs \
  tests/stripe-webhook-signed-replay.test.mjs
node tests/stripe-ingress-contract.test.mjs
```

The HMAC replay harness uses only an in-memory fake Supabase client and
mocked `fetch`; it never sends the generated live-shaped events to Stripe,
Supabase or Vercel. The current exact-head CI admission blocker means these
new combined tests have **not** been verified on the independent runner.

**Current state: DRAFT / HOLD.** No Stripe endpoint configuration, DNS,
credentials, payment intent, price, customer order, production deployment or
subscription was changed by this document.
