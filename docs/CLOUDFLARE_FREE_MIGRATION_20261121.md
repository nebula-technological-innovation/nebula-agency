# Cloudflare-free agency preview — 2026-11-21

## Scope / status

- Existing commercial site: `https://nebularoe.com` (Vercel Hobby; needs migration before commercial production).
- **Read-only, noindex preview**: `https://nebula-agency-cloudflare-review.pages.dev/`.
- Cloudflare Pages project: `nebula-agency-cloudflare-review`, deployment `af13a4c6-e3e6-43f2-9e82-0d67a6ff4162`.
- Origin: direct-upload advanced-mode Worker (not Git-linked). A new Git-linked project was rejected because the Cloudflare Pages Git installation returned API error `8000011`. Do not assume pushing this branch updates Pages automatically.
- Preview contains only home, offers, contact, Strategy Discovery and Atlas Assessment pages, plus a release-held offer redirect and informational status. The full catalog, legal text, and payments are **not** released.
- The live `nebularoe.com` custom domain remains unchanged; no mail DNS records were modified.
- A Cloudflare Pages commercial launch is blocked pending complete content, legal review, branch/commit provenance, mobile and keyboard testing, form delivery, production security headers, and rollback proof.

## Evidence

Exact file blob SHA snapshots used to build the preview:

| Source | Blob SHA |
| --- | --- |
| `index.html` | `155f242ca98f48f64a4dfdbdceec3b4ced117e75` |
| `offers/index.html` | `104cbd1f08fde1ccf41dc0385df376f00be3e842` |
| `landing-pages/services/strategy-architecture-discovery.html` | `419ac5f0c2b15e5b35a4b54ba0f047c63b1e9125` |
| `landing-pages/services/atlas-ai-automation-assessment.html` | `71212c46e48776ee66f40edffce6eb615faef783` |

Independent HTTP probes: `/`, `/offers`, `/contact`, and `/landing-pages/services/strategy-architecture-discovery.html` returned 200. The `/api/go?offer=atlas-assessment` route redirected 303 back to the qualification page; `/api/revenue-status` returned 200 informational JSON; a nonexistent path returned 404. Preview responses include noindex protection.

## Purchase / governance

1. The mapping of 16 Stripe URLs in `api/_offer-catalog.mjs` is not an authorization to take payment.
2. The primary Nebula live Stripe account had **zero active payment links** during the November 21 check.
3. `api/_commercial-release.mjs` requires the explicit `NEBULA_COMMERCIAL_RELEASE_MODE=approved` flag and exact owner-approved per-offer manifest with seven evidence references; unset by default.
4. A manifest is a policy pointer, not independently verified payment proof. Before enabling, check provider account identity, product, price, legal terms, signed ingress, order persistence/idempotency, fulfillment, refunds/reversals, settlement and explicit owner sign-off.
5. Do not auto-publish the existing inactive links, activate subscriptions, or make assumptions from a test redirect.
6. Qualifying consulting inquiry may be collected via known business email without taking payment.
7. The Shopify development store is not a valid shortcut for customer orders; partner supplier costs and merchant eligibility need validation.

## Domain cutover checklist (hold)

- Confirm the intended public legal entity and policy owner.
- Export authoritative external DNS for `nebularoe.com`, including MX, DKIM, SPF, DMARC and verification records.
- Verify full preview content and customer journeys.
- Reconcile production source SHA, CSP/CORS, TLS, apex+www routing, canonical metadata, robots/sitemap and external integration dependencies.
- Confirm only public endpoints move; keep all owner-only administration protected by Access.
- Obtain explicit owner release approval and maintain a measured rollback plan.
- Migrate to commercially eligible hosting; verify customer-facing route status, email delivery, analytics and no sale/no delivery side effects.

No canonical DNS, Stripe, Shopify, GitHub main branch, or production customer entitlement was modified by this review work.
