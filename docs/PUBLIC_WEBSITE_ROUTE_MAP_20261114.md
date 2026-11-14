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

## Remaining public route and asset work

- `www.nebulahq.work`: created proxied Cloudflare CNAME to the apex and reassigned existing www Worker routes to `nebula-www-redirect`. Public resolver returned A records; forced-resolution probe returned a 308 apex redirect. Local resolver caches may lag.
- `nebulahq.work/hardware/`, `/refunds.html`, `/policies/refunds.html`, `/favicon.svg`, and `/robots.txt`: 404 in the live Worker asset deployment despite relevant source files in canonical `nebula-monorepo`. Deploy only after validating the combined Worker and static assets without disrupting eBay data-deletion handlers, approval policies, payment or authentication paths.
- `roeacquisitions.net`: public Squarespace endpoint is 404; Vercel project is separately READY, but its domain mapping does not override current DNS/hosting. Do not repoint before registrar authority and mail/DNS risk review. See canonical monorepo issue #1198.
