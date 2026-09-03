import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SERVICE_OFFERS: Record<string, string> = {
  b2b_revenue_operations_sprint: "service",
  production_safe_security_assessment: "service",
  data_integration_analytics_assessment: "service",
};

const DIGITAL_OFFERS = new Set([
  "client-handoff-pack",
  "offer-math-workbook",
  "ship-gate-pack",
  "collections-pack",
  "agent-ops-pack",
]);

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2) throw new Error("invalid_hex");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
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
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyStripeSignature(raw: string, header: string | null, secret: string): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = header.split(",").map((part) => part.trim());
  const timestampPart = parts.find((part) => part.startsWith("t="));
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestampPart || signatures.length === 0) return false;
  const timestamp = Number(timestampPart.slice(2));
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) return false;
  const expected = await hmacSha256Hex(secret, `${timestamp}.${raw}`);
  return signatures.some((signature) => constantTimeEqualHex(signature, expected));
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const jsonHeaders = { "content-type": "application/json", "cache-control": "no-store" };
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: jsonHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) {
    return new Response(JSON.stringify({ error: "database_runtime_not_configured" }), { status: 503, headers: jsonHeaders });
  }
  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

  const { data: secretRow, error: secretError } = await admin
    .schema("revenue_private")
    .from("runtime_secrets")
    .select("value")
    .eq("key", "stripe_webhook_secret")
    .maybeSingle();
  if (secretError || !secretRow?.value) {
    return new Response(JSON.stringify({ error: "webhook_secret_not_configured" }), { status: 503, headers: jsonHeaders });
  }

  const raw = await req.text();
  if (!(await verifyStripeSignature(raw, req.headers.get("stripe-signature"), secretRow.value))) {
    return new Response(JSON.stringify({ error: "invalid_signature" }), { status: 400, headers: jsonHeaders });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: jsonHeaders });
  }

  const supported = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);
  if (!supported.has(event.type)) {
    return new Response(JSON.stringify({ received: true, status: "ignored" }), { status: 200, headers: jsonHeaders });
  }

  const session = event?.data?.object ?? {};
  if (session.payment_status !== "paid") {
    return new Response(JSON.stringify({ received: true, status: "unpaid_ignored" }), { status: 200, headers: jsonHeaders });
  }

  const metadata = session.metadata ?? {};
  const offer = String(metadata.offer ?? "").trim();
  const sku = String(metadata.sku ?? metadata.product_id ?? "").trim();
  const offerId = offer || sku || "unknown";
  const kind = SERVICE_OFFERS[offer] ?? (DIGITAL_OFFERS.has(sku) ? "digital" : "unknown");
  const fulfillmentStatus = kind === "service" ? "intake_required" : kind === "digital" ? "pending_configuration" : "pending_review";

  const email = String(session.customer_details?.email ?? session.customer_email ?? "").toLowerCase().trim();
  const customerEmailHash = email ? await sha256Hex(email) : null;
  const safeMetadata: Record<string, unknown> = {};
  for (const key of ["offer", "sku", "product_id", "revenue_stream", "catalog", "mode"]) {
    if (metadata[key] != null) safeMetadata[key] = metadata[key];
  }

  const { data: order, error: orderError } = await admin
    .from("revenue_orders")
    .upsert({
      provider: "stripe",
      provider_event_id: String(event.id),
      provider_source_id: String(session.id),
      offer_id: offerId,
      offer_kind: kind,
      amount_total: Number.isFinite(session.amount_total) ? session.amount_total : null,
      currency: session.currency ?? null,
      payment_status: session.payment_status,
      fulfillment_status: fulfillmentStatus,
      customer_email_hash: customerEmailHash,
      customer_name: session.customer_details?.name ?? null,
      metadata: safeMetadata,
      updated_at: new Date().toISOString(),
    }, { onConflict: "provider,provider_event_id", ignoreDuplicates: false })
    .select("id,fulfillment_status")
    .single();

  if (orderError || !order) {
    return new Response(JSON.stringify({ error: "order_persistence_failed" }), { status: 500, headers: jsonHeaders });
  }

  if (kind === "service") {
    const intakePayload: Record<string, unknown> = {};
    if (Array.isArray(session.custom_fields)) {
      for (const field of session.custom_fields) {
        const value = field?.text?.value ?? field?.numeric?.value ?? field?.dropdown?.value;
        if (field?.key && value != null) intakePayload[field.key] = value;
      }
    }
    const { error: intakeError } = await admin.from("revenue_service_intake").upsert({
      order_id: order.id,
      offer_id: offerId,
      status: "intake_required",
      intake_payload: intakePayload,
      updated_at: new Date().toISOString(),
    }, { onConflict: "order_id" });
    if (intakeError) {
      return new Response(JSON.stringify({ error: "service_intake_persistence_failed" }), { status: 500, headers: jsonHeaders });
    }
  }

  return new Response(JSON.stringify({
    received: true,
    verified: true,
    offer_id: offerId,
    fulfillment_status: fulfillmentStatus,
  }), { status: 200, headers: jsonHeaders });
});
