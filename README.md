# Nebula AI Infrastructure & Security Automation Agency

## Commercial status

Nebula's governed service offers and digital operator kits are active through the production Stripe → Supabase revenue path.

### Service offers

Paid service checkouts are signature-verified, written to the durable revenue ledger, and atomically create intake + Customer Ops work-order state. Duplicate Stripe deliveries converge safely rather than creating duplicate work.

### Operator kits

Eight digital products are live with verified automated fulfillment:

| Product | Price | Checkout |
|---|---:|---|
| Agent Ops Pack | $79 | https://buy.stripe.com/14A4gA01d46M9xo4ZnbMQ0m |
| Collections Pack | $39 | https://buy.stripe.com/eVqaEY3dp0UAcJAcrPbMQ0n |
| Ship Gate Pack | $49 | https://buy.stripe.com/eVq9AUg0beLqaBsdvTbMQ0o |
| Offer Math Workbook | $29 | https://buy.stripe.com/3cIdRa8xJfPubFw77vbMQ0p |
| Client Handoff Pack | $49 | https://buy.stripe.com/eVq28sdS30UA7pg1NbbMQ0q |
| Review Relay | See Stripe | https://buy.stripe.com/28EdRa15hdHm6lcbnLbMQ0t |
| After Hours Kit | See Stripe | https://buy.stripe.com/8x2dRabJV1YEeRIezXbMQ0s |
| Site Sprint Kit | $149 | https://buy.stripe.com/6oU14o7tFavadNEdvTbMQ0r |

After successful Checkout, Stripe redirects the buyer to Nebula secure delivery with the Checkout Session ID. The delivery endpoint requires the same checkout email, validates it against the stored hash, serves only the bundle associated with that paid session, marks the order delivered, and records a fulfillment outbox event.

A Stripe-signed non-revenue validation event exercised the real delivery HTTP path successfully (`200`, `application/zip`) and the isolated validation order was removed afterward.

### Recurring software

Recurring software Payment Links remain intentionally disabled until the consuming applications enforce the production entitlement ledger. Backend entitlement lifecycle support is implemented: `invoice.paid` grants/renews access; failed invoices move access to `past_due`; cancellation/negative subscription changes update entitlement state. Trial or merely-active subscription state does not count as paid revenue.

---

**Status**: Revenue activation / governed commercialization

## Quick Links

- **[Execution Plan](./docs/AGENCY_EXECUTION_PLAN.md)** - 30-day roadmap
- **[GitHub Security Audit](./sales-ops/GITHUB_SECURITY_AUDIT_CHECKLIST.md)** - Lead generation tool
- **[Lead Tracking](./sales-ops/LEAD_TRACKING_TEMPLATE.md)** - Sales operations
- **[Discovery Calls](./sales-ops/DISCOVERY_CALL_GUIDE.md)** - Sales script
- **[Content Plan](./sales-ops/FIRST_WEEK_CONTENT_PLAN.md)** - LinkedIn posts
- **[Landing Page](./landing-pages/agency/)** - Agency website
- **[Operator kits](./landing-pages/operator-kits.html)** - live secure digital fulfillment
