import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SERVICE_OFFERS = new Set([
  "b2b_revenue_operations_sprint",
  "production_safe_security_assessment",
  "data_integration_analytics_assessment",
]);

const DIGITAL_OFFERS = new Set([
  "client-handoff-pack",
  "offer-math-workbook",
  "ship-gate-pack",
  "collections-pack",
  "agent-ops-pack",
]);

const JSON_HEADERS = { "content-type": "application/json", "cache-control": "no-store" };
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) throw new Error("invalid_hex");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function constantTimeEqualHex(a: string, b: string): boolean {
  try {
    const aa = hexToBytes(a);
    const bb = hexToBytes(b);
    if (aa.length !== bb.length) return false;
    let diff = 0;
    for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
    return diff === 0;
  } catch {
    return false;
  }
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyStripeSignature(raw: string, header: string | null, secret: string): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.trim());
  const timestampPart = parts.find((p) => p.startsWith("t="));
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!timestampPart || signatures.length === 0) return false;
  const timestamp = Number(timestampPart.slice(2));
  if (!Number.isFinite(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) return false;
  const expected = await hmacSha256Hex(secret, `${timestamp}.${raw}`);
  return signatures.some((sig) => constantTimeEqualHex(sig, expected));
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return json(503, { error: "supabase_runtime_not_configured" });

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: secret, error: secretError } = await admin.rpc("get_runtime_secret", {
    p_key: "stripe_webhook_secret",
  });
  if (secretError || typeof secret !== "string" || !secret) {
    return json(503, { error: "webhook_secret_not_configured" });
  }

  const raw = await req.text();
  if (!(await verifyStripeSignature(raw, req.headers.get("stripe-signature"), secret))) {
    return json(400, { error: "invalid_signature" });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return json(400, { error: "invalid_json" });
  }

  if (event?.livemode !== true) return json(200, { received: true, status: "non_live_ignored" });
  if (!new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]).has(event?.type)) {
    return json(200, { received: true, status: "event_ignored" });
  }

  const session = event?.data?.object ?? {};
  if (session.payment_status !== "paid") return json(200, { received: true, status: "unpaid_ignored" });
  if (typeof event.id !== "string" || !event.id || typeof session.id !== "string" || !session.id) {
    return json(400, { error: "missing_provider_identity" });
  }

  const metadata = session.metadata ?? {};
  const offer = String(metadata.offer ?? "").trim();
  const sku = String(metadata.sku ?? metadata.product_id ?? "").trim();
  const offerId = offer || sku || "unknown";
  const kind = SERVICE_OFFERS.has(offer) ? "service" : DIGITAL_OFFERS.has(sku) ? "digital" : "unknown";
  const fulfillmentStatus = kind === "service"
    ? "intake_required"
    : kind === "digital"
      ? "pending_configuration"
      : "pending_review";

  const email = String(session.customer_details?.email ?? session.customer_email ?? "").trim().toLowerCase();
  const emailHash = email ? await sha256Hex(email) : null;

  const safeMetadata: Record<string, unknown> = {};
  for (const key of ["offer", "sku", "product_id", "revenue_stream", "catalog", "mode"]) {
    if (metadata[key] != null) safeMetadata[key] = metadata[key];
  }

  const intakePayload: Record<string, unknown> = {};
  if (kind === "service" && Array.isArray(session.custom_fields)) {
    for (const field of session.custom_fields) {
      const value = field?.text?.value ?? field?.numeric?.value ?? field?.dropdown?.value;
      if (typeof field?.key === "string" && field.key && value != null) intakePayload[field.key] = value;
    }
  }

  const amountTotal = Number.isSafeInteger(session.amount_total) && session.amount_total >= 0
    ? session.amount_total
    : null;
  const currency = typeof session.currency === "string" && /^[a-z]{3}$/i.test(session.currency)
    ? session.currency.toLowerCase()
    : null;

  const { data: recorded, error: recordError } = await admin.rpc("record_revenue_checkout", {
    p_provider: "stripe",
    p_provider_event_id: event.id,
    p_provider_source_id: session.id,
    p_offer_id: offerId,
    p_offer_kind: kind,
    p_amount_total: amountTotal,
    p_currency: currency,
    p_payment_status: "paid",
    p_fulfillment_status: fulfillmentStatus,
    p_customer_email_hash: emailHash,
    p_metadata: safeMetadata,
    p_intake_payload: intakePayload,
  });

  if (recordError || !Array.isArray(recorded) || recorded.length !== 1) {
    return json(500, { error: "atomic_revenue_persistence_failed" });
  }

  const row = recorded[0] as { fulfillment_status?: string; duplicate?: boolean };
  return json(200, {
    received: true,
    verified: true,
    offer_id: offerId,
    fulfillment_status: row.fulfillment_status ?? fulfillmentStatus,
    duplicate: Boolean(row.duplicate),
  });
});
