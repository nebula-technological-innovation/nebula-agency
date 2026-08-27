import crypto from 'node:crypto';

function timingSafeEqualHex(a, b) {
  try {
    const ab = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

function verifyStripeSignature(rawBody, header, secret, toleranceSeconds = 300) {
  if (!header || !secret) return false;
  const parts = header.split(',').map((part) => part.trim());
  const timestampPart = parts.find((part) => part.startsWith('t='));
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  if (!timestampPart || signatures.length === 0) return false;

  const timestamp = Number(timestampPart.slice(2));
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > toleranceSeconds) return false;

  const payload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  return signatures.some((sig) => timingSafeEqualHex(sig, expected));
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const databaseConfigured = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_URL || process.env.NEON_DATABASE_URL);
  if (!secret || !databaseConfigured) {
    return res.status(503).json({ error: 'fulfillment_not_configured' });
  }

  const signature = req.headers['stripe-signature'];
  const rawBody = await readRawBody(req);
  if (!verifyStripeSignature(rawBody, signature, secret)) {
    return res.status(400).json({ error: 'invalid_signature' });
  }

  let event;
  try { event = JSON.parse(rawBody); } catch { return res.status(400).json({ error: 'invalid_json' }); }

  const supported = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded']);
  if (!supported.has(event.type)) return res.status(200).json({ received: true, fulfillment: 'not_applicable' });

  const session = event?.data?.object || {};
  if (session.payment_status !== 'paid') return res.status(200).json({ received: true, fulfillment: 'unpaid_ignored' });

  // Fail closed until the durable order repository adapter is configured.
  return res.status(503).json({ received: true, verified: true, error: 'durable_order_repository_not_ready' });
}
