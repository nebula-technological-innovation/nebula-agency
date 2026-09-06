import {
  CanonicalForwardError,
  forwardCanonicalEntitlement,
} from "./canonical-entitlement-forwarder.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function adminWith(secrets: Record<string, string>) {
  return {
    async rpc(_name: string, args: Record<string, unknown>) {
      const key = String(args.p_key ?? "");
      return { data: secrets[key] ?? null, error: null };
    },
  };
}

Deno.test("forwarder fails closed when canonical config is missing", async () => {
  let called = false;
  try {
    await forwardCanonicalEntitlement(
      adminWith({}),
      "/internal/payment-events",
      { event_id: "evt_1" },
      async () => {
        called = true;
        return new Response("{}", { status: 200 });
      },
    );
    throw new Error("expected forward failure");
  } catch (error) {
    assert(error instanceof CanonicalForwardError, "expected CanonicalForwardError");
    assert(error.code === "canonical_entitlement_forwarding_not_configured", "wrong error code");
    assert(called === false, "fetch must not run without runtime secrets");
  }
});

Deno.test("forwarder sends internal token and idempotency key to HTTPS canonical endpoint", async () => {
  const seen: { url?: string; init?: RequestInit } = {};
  const result = await forwardCanonicalEntitlement(
    adminWith({
      canonical_entitlement_service_url: "https://entitlements.nebulahq.work/",
      canonical_entitlement_event_token: "internal-token",
    }),
    "/internal/payment-events",
    { event_id: "evt_paid_1", paid: true },
    async (input, init) => {
      seen.url = String(input);
      seen.init = init;
      return new Response(JSON.stringify({ status: "processed" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  );
  assert(seen.url === "https://entitlements.nebulahq.work/internal/payment-events", "wrong target URL");
  const headers = new Headers(seen.init?.headers);
  assert(headers.get("x-internal-token") === "internal-token", "missing internal token");
  assert(headers.get("idempotency-key") === "evt_paid_1", "missing idempotency key");
  assert(result.status === "processed", "unexpected response body");
});

Deno.test("forwarder rejects non-HTTPS remote target", async () => {
  try {
    await forwardCanonicalEntitlement(
      adminWith({
        canonical_entitlement_service_url: "http://example.com",
        canonical_entitlement_event_token: "internal-token",
      }),
      "/internal/subscription-events",
      { event_id: "evt_2" },
    );
    throw new Error("expected URL rejection");
  } catch (error) {
    assert(error instanceof CanonicalForwardError, "expected CanonicalForwardError");
    assert(error.code === "canonical_entitlement_forwarding_not_configured", "wrong error code");
  }
});
