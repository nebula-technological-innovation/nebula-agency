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
    ready_for_signed_webhooks:
      present('STRIPE_WEBHOOK_SECRET') &&
      (present('DATABASE_URL') || present('POSTGRES_URL') || present('SUPABASE_URL') || present('NEON_DATABASE_URL')),
    note: 'Presence-only readiness check. Secret values are never returned.',
    timestamp: new Date().toISOString(),
  });
}
