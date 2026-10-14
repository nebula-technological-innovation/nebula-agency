// Run locally with: deno test --allow-none tests/canonical-entitlement-forwarder.test.ts
// No Stripe, Supabase, network, secrets, or live payment calls.
import { assertEquals, assertRejects } from "jsr:@std/assert@1.0.14";
import {
  CanonicalForwardError,
  forwardCanonicalEntitlement,
  type RpcClient,
  type FetchLike,
} from "../supabase/functions/_shared/canonical-entitlement-forwarder.ts";

const payment = {
  event_id: "evt_synthetic_checkout_001",
  event_type: "checkout.session.completed",
  paid: true,
  product_id: "ai-task-sprint",
  checkout_session_id: "cs_synthetic_001",
};
function client(url: string | null, token: string | null): RpcClient {
  return {
    rpc: async (name, args) => {
      assertEquals(name, "get_runtime_secret");
      const value = args.p_key === "canonical_entitlement_service_url" ? url
        : args.p_key === "canonical_entitlement_event_token" ? token : null;
      return { data: value, error: null };
    },
  };
}

Deno.test("missing event id fails closed before RPC or HTTP", async () => {
  let rpcCalls = 0;
  let httpCalls = 0;
  const admin: RpcClient = { rpc: async () => { rpcCalls++; return { data: "secret", error: null }; } };
  const fetchMock: FetchLike = async () => { httpCalls++; return new Response(null, { status: 200 }); };
  await assertRejects(
    () => forwardCanonicalEntitlement(admin, "/internal/payment-events", { paid: true }, fetchMock),
    CanonicalForwardError, "canonical_entitlement_forward_failed",
  );
  assertEquals(rpcCalls, 0);
  assertEquals(httpCalls, 0);
});

Deno.test("missing canonical URL fails closed without network call", async () => {
  let calls = 0;
  const fetchMock: FetchLike = async () => { calls++; return new Response(null, { status: 200 }); };
  await assertRejects(
    () => forwardCanonicalEntitlement(client(null, "test-token"), "/internal/payment-events", payment, fetchMock),
    CanonicalForwardError, "canonical_entitlement_forwarding_not_configured",
  );
  assertEquals(calls, 0);
});

Deno.test("missing token fails closed without network call", async () => {
  let calls = 0;
  const fetchMock: FetchLike = async () => { calls++; return new Response(null, { status: 200 }); };
  await assertRejects(
    () => forwardCanonicalEntitlement(client("https://canonical.example.test", null), "/internal/payment-events", payment, fetchMock),
    CanonicalForwardError, "canonical_entitlement_forwarding_not_configured",
  );
  assertEquals(calls, 0);
});

Deno.test("non-HTTPS remote origin is rejected", async () => {
  let calls = 0;
  const fetchMock: FetchLike = async () => { calls++; return new Response(null, { status: 200 }); };
  await assertRejects(
    () => forwardCanonicalEntitlement(client("http://canonical.example.test", "test-token"), "/internal/payment-events", payment, fetchMock),
    CanonicalForwardError, "canonical_entitlement_forwarding_not_configured",
  );
  assertEquals(calls, 0);
});

Deno.test("upstream 503 is not acknowledged as delivered", async () => {
  const fetchMock: FetchLike = async () => new Response("downstream unavailable", { status: 503 });
  const error = await assertRejects(
    () => forwardCanonicalEntitlement(client("https://canonical.example.test", "test-token"), "/internal/payment-events", payment, fetchMock),
    CanonicalForwardError, "canonical_entitlement_forward_failed",
  );
  assertEquals(error.status, 503);
});

Deno.test("successful forwarding carries stable event idempotency key", async () => {
  let calls = 0;
  const fetchMock: FetchLike = async (input, init) => {
    calls++;
    assertEquals(String(input), "https://canonical.example.test/internal/payment-events");
    assertEquals(init?.method, "POST");
    const headers = new Headers(init?.headers);
    assertEquals(headers.get("idempotency-key"), payment.event_id);
    assertEquals(headers.get("x-internal-token"), "test-token");
    assertEquals(JSON.parse(String(init?.body)), payment);
    return new Response(JSON.stringify({ status: "accepted" }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  };
  const result = await forwardCanonicalEntitlement(
    client("https://canonical.example.test", "test-token"),
    "/internal/payment-events", payment, fetchMock,
  );
  assertEquals(result, { status: "accepted" });
  assertEquals(calls, 1);
});

Deno.test("retry reuses the same idempotency key after transient failure", async () => {
  const seen: string[] = [];
  const fetchMock: FetchLike = async (_input, init) => {
    seen.push(new Headers(init?.headers).get("idempotency-key") ?? "");
    return new Response(null, { status: seen.length === 1 ? 503 : 200 });
  };
  const admin = client("https://canonical.example.test", "test-token");
  await assertRejects(
    () => forwardCanonicalEntitlement(admin, "/internal/payment-events", payment, fetchMock),
    CanonicalForwardError,
  );
  await forwardCanonicalEntitlement(admin, "/internal/payment-events", payment, fetchMock);
  assertEquals(seen, [payment.event_id, payment.event_id]);
});
