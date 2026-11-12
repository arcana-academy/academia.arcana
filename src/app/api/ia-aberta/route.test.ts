import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  consumeRateLimit: vi.fn(),
  invokeOpenSourceAi: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.consumeRateLimit,
  }),
}));
vi.mock("@/infrastructure/integrations/open-source-ai-gateway", () => ({
  invokeOpenSourceAi: mocks.invokeOpenSourceAi,
}));

import { GET, POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("https://app.example/api/ia-aberta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  provider: "ollama",
  model: "llama3.2",
  messages: [{ role: "user", content: "Olá" }],
};

describe("POST /api/ia-aberta security contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mocks.consumeRateLimit.mockResolvedValue({
      data: [{ allowed: true, rate_limit: 20, remaining: 19, retry_after_seconds: 60 }],
      error: null,
    });
  });

  it("exposes catalog status without claiming unsupported gateways are invocable", async () => {
    const response = await GET();
    const body = await response.json();
    const integrations = body.integrations as Array<{
      id: string;
      gatewaySupported: boolean;
      invocationEligible: boolean;
    }>;
    expect(integrations.find((item) => item.id === "ollama")?.gatewaySupported).toBe(true);
    expect(integrations.find((item) => item.id === "weaviate")?.gatewaySupported).toBe(false);
    expect(integrations.find((item) => item.id === "weaviate")?.invocationEligible).toBe(false);
  });

  it("rejects a catalog-only provider before consuming an AI quota", async () => {
    const response = await POST(jsonRequest({ ...validBody, provider: "langchain" }));
    expect(response.status).toBe(400);
    expect(mocks.consumeRateLimit).not.toHaveBeenCalled();
    expect(mocks.invokeOpenSourceAi).not.toHaveBeenCalled();
  });

  it("requires an authenticated user before parsing or invoking a provider", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await POST(jsonRequest(validBody));

    expect(response.status).toBe(401);
    expect(mocks.consumeRateLimit).not.toHaveBeenCalled();
    expect(mocks.invokeOpenSourceAi).not.toHaveBeenCalled();
  });

  it("rejects invalid or over-budget generation inputs", async () => {
    const response = await POST(jsonRequest({ ...validBody, maxTokens: 100_000 }));

    expect(response.status).toBe(400);
    expect(mocks.consumeRateLimit).not.toHaveBeenCalled();
    expect(mocks.invokeOpenSourceAi).not.toHaveBeenCalled();
  });

  it("returns 429 and Retry-After without contacting a provider when limited", async () => {
    mocks.consumeRateLimit.mockResolvedValue({
      data: [{ allowed: false, rate_limit: 20, remaining: 0, retry_after_seconds: 37 }],
      error: null,
    });

    const response = await POST(jsonRequest(validBody));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("37");
    expect(response.headers.get("RateLimit-Limit")).toBe("20");
    expect(response.headers.get("RateLimit-Remaining")).toBe("0");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.invokeOpenSourceAi).not.toHaveBeenCalled();
  });

  it("fails closed with 503 when the durable limiter is unavailable", async () => {
    mocks.consumeRateLimit.mockResolvedValue({ data: null, error: new Error("database unavailable") });

    const response = await POST(jsonRequest(validBody));

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.invokeOpenSourceAi).not.toHaveBeenCalled();
  });

  it("fails closed when the limiter RPC throws", async () => {
    mocks.consumeRateLimit.mockRejectedValue(new Error("database transport failure"));

    const response = await POST(jsonRequest(validBody));

    expect(response.status).toBe(503);
    expect(mocks.invokeOpenSourceAi).not.toHaveBeenCalled();
  });

  it("fails closed for malformed limiter results", async () => {
    mocks.consumeRateLimit.mockResolvedValue({
      data: [{ allowed: true, rate_limit: 20, remaining: 19, retry_after_seconds: 999 }],
      error: null,
    });

    const response = await POST(jsonRequest(validBody));

    expect(response.status).toBe(503);
    expect(mocks.invokeOpenSourceAi).not.toHaveBeenCalled();
  });

  it("returns a private non-cacheable result for valid requests", async () => {
    mocks.invokeOpenSourceAi.mockResolvedValue({
      provider: "ollama",
      model: "llama3.2",
      content: "Resposta de teste",
    });

    const response = await POST(jsonRequest(validBody));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("RateLimit-Limit")).toBe("20");
    expect(response.headers.get("RateLimit-Remaining")).toBe("19");
    expect(mocks.consumeRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.invokeOpenSourceAi.mock.invocationCallOrder[0],
    );
    expect(await response.json()).toEqual({
      provider: "ollama",
      model: "llama3.2",
      content: "Resposta de teste",
    });
  });

  it("does not reflect upstream errors or secrets", async () => {
    mocks.invokeOpenSourceAi.mockRejectedValue(
      new Error("api-key=synthetic-secret provider trace"),
    );

    const response = await POST(jsonRequest(validBody));
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(JSON.stringify(payload)).not.toContain("synthetic-secret");
  });
});
