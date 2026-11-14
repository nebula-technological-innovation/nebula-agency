# Public website and route map — November 14, 2026

This document records externally verified public navigation and its known source owner. It does **not** certify the health or security of private APIs, the readiness of paid checkout, or any revenue.

| Public destination | Website role | Hosting / source relationship | Current status or control |
| --- | --- | --- | --- |
| [nebulahq.work](https://nebulahq.work/) | Primary Nebula HQ | Cloudflare Worker asset site; canonical source is not automatically promoted | Homepage responds 200 |
| [nebulahq.work/offers](https://nebulahq.work/offers) | Primary offers link | Cloudflare exact-path redirect to [offers.nebulahq.work](https://offers.nebulahq.work/) | Inquiry-only destination responds 200 |
| [nebulahq.work/privacy.html](https://nebulahq.work/privacy.html) | Legacy privacy link | Cloudflare exact-path redirect to `/policies/privacy.html` | Final policy response 200 |
| [nebulahq.work/terms.html](https://nebulahq.work/terms.html) | Legacy terms link | Cloudflare exact-path redirect to `/policies/terms.html` | Final policy response 200 |
| [nebularoe.com](https://nebularoe.com/) | Business and services presentation | Vercel project `nebula-agency`, GitHub `nebula-agency` | Homepage responds 200 |
| [nebularoe.com/offers](https://nebularoe.com/offers) | Agency service categories | Vercel production `nebula-agency`, commit `9e814a7730b538ce142fab9c12a263e34f2ea01d` | `/offers`, `/offers/`, and www alias verified final 200 after promotion |
| [roeacquisitions.net](https://roeacquisitions.net/) | Holding-company public presence | Live public domain currently resolves to Squarespace; separate Vercel `roe-acquisitions` project is not serving the public hostname | Apex 301 to www, then Squarespace 404; requires Squarespace/DNS reconciliation |

**Production safeguards:** The Cloudflare rules apply only to GET/HEAD for exact paths and preserve unrelated routes. Do not override API, authentication, eBay, billing, webhook, or subscription routing to fix a brochure-page link.

**Verified source boundaries:** `nebula-monorepo` is the private canonical engineering repository. `nebula-agency` supplies the public Vercel agency website. The root `nebulahq.work` currently uses a separate Cloudflare Worker asset deployment and can lag canonical source.

**Release checks:** After any website change, test HTTP final status and content for home, offers, privacy, terms, main service links and unknown routes. Confirm deployed source commit, TLS, headers, and that inquiry-only product paths do not silently activate unverified checkout.

**Other public applications:** Nebula also publishes separately routed applications and research/demo websites. They should be evaluated for misleading sample metrics, Access protection and deployment provenance before being presented to investors as live products.

## Scoped static asset repair — verified live November 14, 2026

The isolated Cloudflare Worker `nebula-public-static-route-repair` was published from the canonical monorepo, [PR #1272](https://github.com/nebula-technological-innovation/nebula-monorepo/pull/1272), merge `38705299673a3b0cf291ff692b9fd97a354d282a`. It only accepts public GET/HEAD routes and leaves the main Worker and eBay integration unchanged.

- [Hardware overview](https://nebulahq.work/hardware/) and Dell AI, Dell Outlet, and mining RFQ subpages: final HTTP 200
- [Refund policy](https://nebulahq.work/policies/refunds.html) (both HTML and extensionless forms), `/refunds.html`, and `/refunds`: final HTTP 200
- [Favicon](https://nebulahq.work/favicon.svg), [robots.txt](https://nebulahq.work/robots.txt), [sitemap](https://nebulahq.work/sitemap.xml), and `/rum-web-vitals.js`: HTTP 200
- `www.nebulahq.work`: proxied Cloudflare CNAME to the apex, and dedicated `nebula-www-redirect` routes. Public DNS resolver resolves and forced-resolution probes return HTTP 308 to the apex. Local negative DNS cache can lag.
- Release evidence: 6/6 Node tests, 13/13 local runtime smoke checks, and 24/24 live route checks, including the unchanged eBay GET validation response and a public-path 404 negative test.
- Source legal entity and customer form copy were **not** revised; commercial/legal review and real-lead end-to-end lifecycle validation are still separate gates.

## Roe Acquisitions domain — separate release hold

`roeacquisitions.net` continues to redirect to `www.roeacquisitions.net`, where the Squarespace-served website returns HTTP 404.

Authoritative DNS is outside the connected Cloudflare zone. Public apex records are Squarespace addresses, and the www CNAME targets `ext-sq.squarespace.com`. Google-hosted MX records are in use and must be preserved.

The Vercel project `roe-acquisitions` is attached to this hostname inside Vercel but its live `roe-acquisitions.vercel.app` page is a **generic Next.js Enterprise Boilerplate**. **Do not repoint live DNS to that project.** The [Roe corporate static review](https://roe-corporate-static-review.vercel.app/) has now been restored from [canonical monorepo PR #1273](https://github.com/nebula-technological-innovation/nebula-monorepo/pull/1273) and redeployed as a **review-only Vercel website** (`dpl_AQ1XC4QDA1rqTrXBj8cZKMpwKUXh`). Its homepage, contact, privacy, terms, favicon, robots and sitemap, plus an invalid-path 404, passed 8/8 independent live HTTP checks. The legal-entity wording remains unverified and **the actual corporate domain has not been moved**.

No Squarespace/DNS changes were made. The connected Google Cloud project's DNS API is disabled, and account-level Squarespace editing access was not established. The smallest safe remaining step is authenticated registrar access, current legal identity/corporate disclosure review, and a tested static-site target that preserves MX/TXT records. See canonical monorepo issue #1198.
