# Cloudflare-free agency preview — 2026-11-21

## Scope / status

- Existing commercial site: `https://nebularoe.com` (Vercel Hobby; needs migration before commercial production).
- **Read-only, noindex preview**: `https://nebula-agency-cloudflare-review.pages.dev/`.
- Cloudflare Pages project: `nebula-agency-cloudflare-review`, deployment `f773e801-7c47-48db-b95b-c41d03b508f5`.
- Origin: direct-upload advanced-mode Worker (not Git-linked). A new Git-linked project was rejected because the Cloudflare Pages Git installation returned API error `8000011`. Do not assume pushing this branch updates Pages automatically.
- Preview contains only home, offers, contact, Strategy Discovery and Atlas Assessment pages, plus a release-held offer redirect and informational status. The full catalog, legal text, and payments are **not** released.
- The live `nebularoe.com` custom domain remains unchanged; no mail DNS records were modified.
- A Cloudflare Pages commercial launch is blocked pending complete content, legal review, branch/commit provenance, mobile and keyboard testing, form delivery, production security headers, and rollback proof.

## Evidence

Exact file blob SHA snapshots used to build the preview:

| Source | Blob SHA |
| --- | --- |
| `index.html` | `b8b7e105cf6dcdf4ca1a335c461e6bd1fbd64d1b` |
| `offers/index.html` | `104cbd1f08fde1ccf41dc0385df376f00be3e842` |
| `landing-pages/services/strategy-architecture-discovery.html` | `b6330b0d4ae9a19500e125719d78c2f4ca268575` |
| `landing-pages/services/atlas-ai-automation-assessment.html` | `d2a5f6e4b40e5e36f87961392922f6a667e0db11` |

Independent HTTP probes: `/`, `/offers`, `/contact`, and `/landing-pages/services/strategy-architecture-discovery.html` returned 200. The `/api/go?offer=atlas-assessment` route redirected 303 back to the qualification page; `/api/revenue-status` returned 200 informational JSON; a nonexistent path returned 404. Preview responses include noindex protection.

## Purchase / governance

1. The mapping of 16 Stripe URLs in `api/_offer-catalog.mjs` is not an authorization to take payment.
2. The primary Nebula live Stripe account had **zero active payment links** during the November 21 check.
3. `api/_commercial-release.mjs` now requires a **version-2 HMAC-signed manifest** plus explicit release mode, exact Stripe seller account, unexpired owner approval and seven evidence references. Details: [`SIGNED_COMMERCIAL_RELEASE_20261121.md`](SIGNED_COMMERCIAL_RELEASE_20261121.md). No signing secret or approved manifest was provisioned; default state is HOLD.
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

## Expanded source-pinned live review (2026-11-21)

- Deterministic 30-route Cloudflare Worker build implemented in `scripts/build-cloudflare-review.mjs`, covering homepage, offers, full service/digital-kit catalogs, all nine individual kit pages, nine guides, and seven service pages. The script allowlists public HTML only; it does not expose `api/`, `supabase/`, GitHub configuration or secrets. The build rejects direct checkout links and unverified availability claims.
- Source marketing cleanup removed direct Stripe links and `/api/go` purchase links from catalog/service/kit/guide pages, eliminated unverified InStock schema, and made requests qualification-first. New regression `tests/verify-public-release-copy.mjs` scans the entire marketing source tree. No claim of a live customer order or paid delivery.
- A one-time exact-source public review snapshot for the 30 files is preserved on the separate `review/cloudflare-pages-exact-snapshot-20261121` branch, with a partial compiled source bundle at `review-artifacts/cloudflare-preview-snapshot-part-a.json` and immutable content blob SHA entries. This source-snapshot branch is not intended for merge.
- Actual Cloudflare direct-upload deployment `8fc0f0e3-8e54-4699-aacb-850d2f0bf03a` at `https://nebula-agency-cloudflare-review.pages.dev/` uses the 30 source page contents and the same reviewed preview-only request handler. Independent HTTP probes: root, offers, revenue catalog, operator kit index and details, service pages, guides and guide detail all returned HTTP 200; unknown path 404; `/api/go?offer=atlas-assessment` responded HTTP 303 back to qualification. Tested responses retain noindex, CSP and HSTS. No branded DNS or live checkout changed.
- GitHub Actions run [44973853013](https://github.com/nebula-technological-innovation/nebula-agency/actions/runs/44973853013) passed all five checks including the full 30-route offline Worker simulation. A subsequent signed-release policy change passed [run 44974108813](https://github.com/nebula-technological-innovation/nebula-agency/actions/runs/44974108813). These are source/preview tests, not legal, provider, browser-device or settlement certification.
- Remaining before branded commercial migration: owner-approved legal/corporate copy and policies, complete authoritative DNS snapshot/rollback, production web route and email validation, reliable repeatable Cloudflare deployment authorization, mobile and accessibility QA and verified opt-in lead delivery. The actual `nebularoe.com` production site remains unchanged.
