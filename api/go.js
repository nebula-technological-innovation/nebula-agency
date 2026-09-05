import crypto from 'node:crypto';

const OFFERS = {
  strategy_architecture_discovery: 'https://book.stripe.com/8x2cN6bJV5aQfVM77vbMQ0c',
  automation_integration_sprint: 'https://book.stripe.com/00w9AU9BNeLqeRI77vbMQ0d',
  technical_documentation_sprint: 'https://book.stripe.com/5kQ4gAeW7gTycJAbnLbMQ0e',
  data_integration_assessment: 'https://book.stripe.com/cNi4gAg0b5aQaBsdvTbMQ0j',
  security_assessment: 'https://book.stripe.com/8x23cw15h0UAfVMcrPbMQ0k',
  b2b_revenue_operations_sprint: 'https://book.stripe.com/3cI7sM9BNcDi24W77vbMQ0l'
};

function clean(value, fallback='unknown', max=120) {
  const text = String(value || '').trim().toLowerCase();
  return (text || fallback).replace(/[^a-z0-9._:-]/g, '-').slice(0, max);
}

function referrerHost(req) {
  try { return new URL(req.headers.referer || '').host.slice(0, 160) || null; }
  catch { return null; }
}

function uaFamily(req) {
  const ua = String(req.headers['user-agent'] || '').toLowerCase();
  if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
  if (ua.includes('android')) return 'android';
  if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) return 'bot';
  if (ua.includes('windows')) return 'windows';
  if (ua.includes('macintosh')) return 'mac';
  return ua ? 'other' : 'unknown';
}

async function recordEvent(req, payload) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { recorded: false, reason: 'analytics_unconfigured' };

  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/marketing_attribution_events`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      prefer: 'return=minimal'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(1200)
  });
  if (!response.ok) throw new Error(`supabase_${response.status}`);
  return { recorded: true };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const offerId = clean(req.query.offer, '', 80);
  const destination = OFFERS[offerId];
  if (!destination) return res.status(404).json({ error: 'unknown_offer' });

  const existing = String(req.headers.cookie || '').match(/(?:^|; )nebula_anon=([a-zA-Z0-9_-]{12,80})/);
  const anonymousId = existing?.[1] || crypto.randomBytes(12).toString('base64url');
  if (!existing) {
    res.setHeader('Set-Cookie', `nebula_anon=${anonymousId}; Path=/; Max-Age=31536000; SameSite=Lax; Secure; HttpOnly`);
  }

  const payload = {
    event_type: 'offer_click',
    offer_id: offerId,
    channel: clean(req.query.channel),
    campaign: clean(req.query.campaign),
    landing_page: String(req.query.page || '').slice(0, 240) || null,
    referrer_host: referrerHost(req),
    anonymous_id: anonymousId,
    user_agent_family: uaFamily(req)
  };

  try { await recordEvent(req, payload); } catch {}

  // Marketing attribution is intentionally fail-soft: it must never block checkout.
  return res.redirect(302, destination);
}
