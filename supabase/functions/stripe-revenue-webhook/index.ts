import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  CanonicalForwardError,
  forwardCanonicalEntitlement,
} from "../_shared/canonical-entitlement-forwarder.ts";

const SERVICE_OFFERS = new Set([
  "ai_automation_assessment",
  "atlas-assessment",
  "atlas_ai_automation_pilot",
  "atlas-pilot",
  "b2b_revenue_operations_sprint",
  "production_safe_security_assessment",
  "data_integration_analytics_assessment",
  "defensive_security_assessment",
  "security_assessment",
  "integration_analytics_assessment",
  "data_integration_assessment",
  "technical_documentation_sprint",
  "automation_integration_sprint_deposit",
  "automation_integration_sprint",
  "strategy_architecture_discovery",
  "ai-task-sprint",
  "ai-native-website-launch-sprint",
]);

// Preserve the legacy checkout identifier accepted by deployed v11.
const OFFER_ALIASES: Record<string, string> = {
  "ai_native_website_launch_sprint": "ai-native-website-launch-sprint",
};
const canonicalOffer = (value: string): string => OFFER_ALIASES[value] ?? value;

const DIGITAL_OFFERS = new Set([
  "ai-automation-starter-kit",
  "client-handoff-pack",
  "offer-math-workbook",
  "ship-gate-pack",
  "collections-pack",
  "agent-ops-pack",
  "review-relay",
  "after-hours-kit",
  "site-sprint-kit",
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
  // Stripe timestamps are decimal integer seconds, not JS numeric expressions or fractions.
  const rawTimestamp = timestampPart.slice(2);
  if (!/^[0-9]{1,12}$/.test(rawTimestamp)) return false;
  const timestamp = Number(rawTimestamp);
  if (!Number.isSafeInteger(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) return false;
  // Refuse malformed/truncated hex instead of relying on permissive conversion.
  if (signatures.some((signature) => !/^[0-9a-f]{64}$/i.test(signature))) return false;
  const expected = await hmacSha256Hex(secret, `${rawTimestamp}.${raw}`);
  return signatures.some((sig) => constantTimeEqualHex(sig, expected));
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function stringId(value: any): string | null {
  return typeof value === "string" && value ? value : value && typeof value.id === "string" ? value.id : null;
}

function subscriptionIdFromInvoice(invoice: any): string | null {
  return stringId(invoice.subscription)
    ?? stringId(invoice.parent?.subscription_details?.subscription)
    ?? stringId(invoice.lines?.data?.[0]?.subscription);
}

function priceFromLine(line: any): any {
  return line?.price ?? line?.pricing?.price_details?.price ?? line?.pricing?.price_details ?? null;
}

type SoftwareIdentity = {
  sku: string;
  tier: string;
  periodEnd: string | null;
  providerPriceId: string | null;
  canonicalPriceId: string | null;
  fulfillment: string | null;
};

function softwareIdentityFromInvoice(invoice: any): SoftwareIdentity | null {
  for (const line of invoice?.lines?.data ?? []) {
    const price = priceFromLine(line);
    const metadata = price?.metadata ?? line?.metadata ?? {};
    const sku = String(metadata.nebula_sku ?? "").trim();
    if (!sku) continue;
    const tier = String(metadata.nebula_tier ?? "basic").trim() || "basic";
    const periodEnd = Number(line?.period?.end);
    const providerPriceId = stringId(price);
    const lookupKey = typeof price?.lookup_key === "string" ? price.lookup_key.trim() : "";
    const canonicalPriceId = String(metadata.canonical_price_id ?? lookupKey).trim() || null;
    const fulfillment = String(metadata.nebula_fulfillment ?? metadata.fulfillment_type ?? "").trim() || null;
    return {
      sku,
      tier,
      periodEnd: Number.isFinite(periodEnd) ? new Date(periodEnd * 1000).toISOString() : null,
      providerPriceId,
      canonicalPriceId,
      fulfillment,
    };
  }
  return null;
}

function canonicalForwardFailure(error: unknown): Response {
  if (error instanceof CanonicalForwardError) {
    return json(503, {
      error: error.code,
      retryable: true,
      upstream_status: error.status,
    });
  }
  return json(503, { error: "canonical_entitlement_forward_failed", retryable: true });
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

  const eventType = String(event?.type ?? "");
  const eventObject = event?.data?.object ?? {};

  if (new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]).has(eventType)) {
    const session = eventObject;
    if (session.payment_status !== "paid") return json(200, { received: true, status: "unpaid_ignored" });
    if (typeof event.id !== "string" || !event.id || typeof session.id !== "string" || !session.id) {
      return json(400, { error: "missing_provider_identity" });
    }

    const metadata = session.metadata ?? {};
    // Prefer verified checkout/offer identities without creating authority from an unknown SKU.
    const offer = canonicalOffer(String(
      metadata.commercial_offer_id ?? metadata.offer_id ?? metadata.offer ?? metadata.nebula_offer_id ?? "",
    ).trim());
    const sku = canonicalOffer(String(metadata.sku ?? metadata.product_id ?? "").trim());
    const kind = SERVICE_OFFERS.has(offer) || SERVICE_OFFERS.has(sku)
      ? "service"
      : DIGITAL_OFFERS.has(sku) || DIGITAL_OFFERS.has(offer)
        ? "digital"
        : "unknown";
    const offerId = kind === "service"
      ? SERVICE_OFFERS.has(offer) ? offer : sku
      : kind === "digital"
        ? DIGITAL_OFFERS.has(sku) ? sku : offer
        : offer || sku || "unknown";
    const fulfillmentStatus = kind === "service"
      ? "intake_required"
      : kind === "digital"
        ? "delivery_ready"
        : "pending_review";

    const email = String(session.customer_details?.email ?? session.customer_email ?? "").trim().toLowerCase();
    const emailHash = email ? await sha256Hex(email) : null;

    const safeMetadata: Record<string, unknown> = {};
    for (const key of [
      "offer",
      "sku",
      "product_id",
      "revenue_stream",
      "catalog",
      "mode",
      "payment_stage",
      "business_unit",
      "business_owner",
      "commercial_offering_id",
      "commercial_offer_id",
      "canonical_price_id",
      "entitlement_tier",
      "provider_price_id",
      "payment_role",
      "fulfillment",
      "fulfillment_type",
    ]) {
      if (metadata[key] != null) safeMetadata[key] = metadata[key];
    }
    // Match the deployed v11 canonical economic identity on replay and audit.
    safeMetadata.canonical_offer_id = offerId;

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
    // Persist first, then acknowledge only when canonical paid-event delivery succeeds.
    // Retries converge on record_revenue_checkout's provider-event idempotency key.
    if (kind !== "unknown") {
      if (!email) {
        return json(503, { error: "customer_email_unresolved", retryable: true });
      }
      if (amountTotal === null || currency === null) {
        return json(503, { error: "payment_amount_or_currency_unresolved", retryable: true });
      }
      const paymentIntentId = stringId(session.payment_intent);
      const subscriptionId = stringId(session.subscription);
      if (!paymentIntentId && !subscriptionId) {
        return json(503, { error: "payment_identity_unresolved", retryable: true });
      }
      try {
        await forwardCanonicalEntitlement(admin, "/internal/payment-events", {
          event_id: event.id,
          event_type: eventType,
          paid: true,
          customer_email: email,
          product_id: offerId,
          product_name: String(metadata.product_name ?? offerId),
          tier: String(metadata.entitlement_tier ?? (kind === "service" ? "service" : "digital")),
          fulfillment_type: kind === "service" ? "professional_service" : "digital_delivery",
          amount: amountTotal,
          currency,
          payment_intent_id: paymentIntentId,
          subscription_id: subscriptionId,
          checkout_session_id: session.id,
          needs_license_key: false,
          needs_api_key: false,
          commercial_offering_id: metadata.commercial_offering_id ?? null,
          commercial_offer_id: offerId,
          canonical_price_id: metadata.canonical_price_id ?? null,
          entitlement_tier: metadata.entitlement_tier ?? null,
          payment_provider: "stripe",
          provider_price_id: metadata.provider_price_id ?? null,
        });
      } catch (error) {
        return canonicalForwardFailure(error);
      }
    }

    return json(200, {
      received: true,
      verified: true,
      canonical_forwarding: kind !== "unknown",
      canonical_status: kind === "unknown" ? "pending_review" : "forwarded",
      offer_id: offerId,
      fulfillment_status: row.fulfillment_status ?? fulfillmentStatus,
      duplicate: Boolean(row.duplicate),
    });
  }

  if (eventType === "invoice.paid") {
    const subscriptionId = subscriptionIdFromInvoice(eventObject);
    const identity = softwareIdentityFromInvoice(eventObject);
    // Invoices with no Nebula product identity cannot grant access.
    if (!identity) return json(200, { received: true, status: "non_nebula_invoice_ignored" });
    // Once a Nebula product is identified, do not permanently acknowledge
    // missing source/customer/payment identities. Stripe must be able to retry.
    if (!subscriptionId) return json(503, { error: "subscription_identity_unresolved", retryable: true });
    if (typeof event.id !== "string" || !event.id) return json(400, { error: "missing_provider_identity" });

    const email = String(eventObject.customer_email ?? "").trim().toLowerCase();
    if (!email) return json(503, { error: "customer_email_unresolved", retryable: true });

    const amount = Number.isSafeInteger(eventObject.amount_paid) && eventObject.amount_paid >= 0
      ? eventObject.amount_paid : null;
    const currency = typeof eventObject.currency === "string" && /^[a-z]{3}$/i.test(eventObject.currency)
      ? eventObject.currency.toLowerCase() : null;
    if (amount === null || currency === null) {
      return json(503, { error: "invoice_payment_amount_or_currency_unresolved", retryable: true });
    }
    const needsApiKey = identity.fulfillment === "api_key" || identity.sku.includes("api");

    try {
      await forwardCanonicalEntitlement(admin, "/internal/payment-events", {
        event_id: event.id,
        event_type: eventType,
        paid: true,
        customer_email: email,
        product_id: identity.sku,
        product_name: identity.sku,
        tier: identity.tier,
        fulfillment_type: "software_entitlement",
        amount,
        currency,
        payment_intent_id: stringId(eventObject.payment_intent),
        subscription_id: subscriptionId,
        needs_license_key: false,
        needs_api_key: needsApiKey,
        canonical_price_id: identity.canonicalPriceId,
        entitlement_tier: identity.tier,
        payment_provider: "stripe",
        provider_price_id: identity.providerPriceId,
      });
    } catch (error) {
      return canonicalForwardFailure(error);
    }

    const { data, error } = await admin.rpc("process_software_entitlement_event", {
      p_event_id: event.id,
      p_event_type: eventType,
      p_action: "active",
      p_subscription_id: subscriptionId,
      p_customer_id: stringId(eventObject.customer),
      p_customer_email_hash: await sha256Hex(email),
      p_product_sku: identity.sku,
      p_tier: identity.tier,
      p_period_end: identity.periodEnd,
    });
    if (error) return json(500, { error: "entitlement_event_failed" });
    return json(200, {
      received: true,
      canonical_forwarding: true,
      entitlement: data?.[0]?.result ?? "processed",
      product_sku: identity.sku,
    });
  }

  if (eventType === "invoice.payment_failed") {
    const subscriptionId = subscriptionIdFromInvoice(eventObject);
    if (!subscriptionId) return json(200, { received: true, status: "subscription_unresolved" });
    try {
      await forwardCanonicalEntitlement(admin, "/internal/subscription-events", {
        event_id: event.id,
        event_type: eventType,
        subscription_id: subscriptionId,
        action: "past_due",
      });
    } catch (error) {
      return canonicalForwardFailure(error);
    }
    const { data, error } = await admin.rpc("process_software_entitlement_event", {
      p_event_id: event.id,
      p_event_type: eventType,
      p_action: "past_due",
      p_subscription_id: subscriptionId,
    });
    if (error) return json(500, { error: "entitlement_event_failed" });
    return json(200, { received: true, canonical_forwarding: true, entitlement: data?.[0]?.result ?? "processed", status: "past_due" });
  }

  if (eventType === "customer.subscription.deleted") {
    const subscriptionId = stringId(eventObject.id);
    if (!subscriptionId) return json(400, { error: "subscription_identity_missing" });
    try {
      await forwardCanonicalEntitlement(admin, "/internal/subscription-events", {
        event_id: event.id,
        event_type: eventType,
        subscription_id: subscriptionId,
        action: "cancelled",
      });
    } catch (error) {
      return canonicalForwardFailure(error);
    }
    const { data, error } = await admin.rpc("process_software_entitlement_event", {
      p_event_id: event.id,
      p_event_type: eventType,
      p_action: "cancelled",
      p_subscription_id: subscriptionId,
    });
    if (error) return json(500, { error: "entitlement_event_failed" });
    return json(200, { received: true, canonical_forwarding: true, entitlement: data?.[0]?.result ?? "processed", status: "cancelled" });
  }

  if (eventType === "customer.subscription.updated") {
    const subscriptionId = stringId(eventObject.id);
    const subscriptionStatus = String(eventObject.status ?? "");
    const action = subscriptionStatus === "past_due" || subscriptionStatus === "unpaid"
      ? "past_due"
      : subscriptionStatus === "paused"
        ? "paused"
        : subscriptionStatus === "canceled"
          ? "cancelled"
          : null;
    if (!subscriptionId || !action) return json(200, { received: true, status: "subscription_update_ignored" });
    try {
      await forwardCanonicalEntitlement(admin, "/internal/subscription-events", {
        event_id: event.id,
        event_type: eventType,
        subscription_id: subscriptionId,
        action,
      });
    } catch (error) {
      return canonicalForwardFailure(error);
    }
    const { data, error } = await admin.rpc("process_software_entitlement_event", {
      p_event_id: event.id,
      p_event_type: eventType,
      p_action: action,
      p_subscription_id: subscriptionId,
    });
    if (error) return json(500, { error: "entitlement_event_failed" });
    return json(200, { received: true, canonical_forwarding: true, entitlement: data?.[0]?.result ?? "processed", status: action });
  }

  return json(200, { received: true, status: "event_ignored" });
});
