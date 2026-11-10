# nebularoe.com/offers — read-only route repair candidate

Source repository: nebula-technological-innovation/nebula-agency (NOT the Nebula monorepo).
Base commit: 1384a433bf015fcbba57cc171ebcd9bbe88eb5f0.
Deployment observed: Vercel project nebula-agency, alias nebularoe.com.
Live baseline: GET/HEAD /offers returned 404 before this change.

This isolated branch adds a static offers page and rewrites for /offers and /offers/.
The page links to existing service descriptions and requests confirmation rather than asserting unverified end-to-end sales readiness. It does not modify the existing checkout router or provider records.

Local validation:
- node --test tests/offers-route.test.mjs
- node tests/verify-live-offers.mjs (source mapping only, not live transaction proof)
- python3 -m http.server (isolated manual preview: /offers/; Vercel rewrite requires an authenticated preview check)

Release holds: no merge, deployment, promotion, Vercel settings, DNS, credentials, payment or real fulfillment action without owner approval.

Remaining gate: authenticate to the correct Vercel project, check preview response for both /offers and /offers/, confirm CSP/headers/accessibility and existing /api/go behavior; only then request production promotion.
