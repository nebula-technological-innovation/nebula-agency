export type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export class CanonicalForwardError extends Error {
  constructor(
    public readonly code:
      | "canonical_entitlement_forwarding_not_configured"
      | "canonical_entitlement_forward_failed",
    public readonly status: number | null = null,
  ) {
    super(code);
  }
}

async function runtimeSecret(admin: RpcClient, key: string): Promise<string | null> {
  const { data, error } = await admin.rpc("get_runtime_secret", { p_key: key });
  if (error || typeof data !== "string" || !data.trim()) return null;
  return data.trim();
}

export async function forwardCanonicalEntitlement(
  admin: RpcClient,
  path: "/internal/payment-events" | "/internal/subscription-events",
  payload: Record<string, unknown>,
  fetchImpl: FetchLike = fetch,
): Promise<Record<string, unknown>> {
  const [baseUrl, token] = await Promise.all([
    runtimeSecret(admin, "canonical_entitlement_service_url"),
    runtimeSecret(admin, "canonical_entitlement_event_token"),
  ]);
  if (!baseUrl || !token) {
    throw new CanonicalForwardError("canonical_entitlement_forwarding_not_configured");
  }

  let origin: URL;
  try {
    origin = new URL(baseUrl);
  } catch {
    throw new CanonicalForwardError("canonical_entitlement_forwarding_not_configured");
  }
  if (origin.protocol !== "https:" && origin.hostname !== "127.0.0.1" && origin.hostname !== "localhost") {
    throw new CanonicalForwardError("canonical_entitlement_forwarding_not_configured");
  }

  const target = new URL(path, origin.toString().replace(/\/?$/, "/"));
  const response = await fetchImpl(target, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-token": token,
      "idempotency-key": String(payload.event_id ?? ""),
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new CanonicalForwardError("canonical_entitlement_forward_failed", response.status);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return { status: "accepted" };
  const body = await response.json();
  return body && typeof body === "object" ? body as Record<string, unknown> : { status: "accepted" };
}
