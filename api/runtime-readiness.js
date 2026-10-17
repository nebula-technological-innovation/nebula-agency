export default function handler(req, res) {
  const present = (name) => Boolean(process.env[name]);

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    service: 'nebula-revenue-backend',
    configuration: {
      stripe_webhook_secret: present('STRIPE_WEBHOOK_SECRET'),
      stripe_secret_key: present('STRIPE_SECRET_KEY'),
      database_url: present('DATABASE_URL') || present('POSTGRES_URL') || present('SUPABASE_URL') || present('NEON_DATABASE_URL'),
      entitlement_event_token: present('ENTITLEMENT_EVENT_TOKEN'),
    },
    // This compatibility handler validates signatures, but cannot durably
    // persist or acknowledge paid Checkout events. Configuration presence is
    // not payment fulfillment readiness; never green-light revenue from it.
    stripe_signature_verification_configured: present('STRIPE_WEBHOOK_SECRET'),
    ready_for_signed_webhooks: false,
    durable_order_repository_ready: false,
    ready_for_paid_checkout: false,
    note: 'Compatibility only: signed paid checkouts fail closed with HTTP 503. Credential presence is not an economic release gate. Secret values are never returned.',
    timestamp: new Date().toISOString(),
  });
}
