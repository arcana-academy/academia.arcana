import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  executeMestreArcano: vi.fn(),
  consume: vi.fn(),
  createClient: vi.fn(),
  toolContext: vi.fn(),
  decryptCredentials: vi.fn(),
  getValidCredentials: vi.fn(),
}));

vi.mock("@/lib/auth/require-authenticated-user", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/application/intelligence/execute-mestre-arcano", () => ({
  executeMestreArcano: mocks.executeMestreArcano,
}));

vi.mock("@/infrastructure/openai/mestre-arcano", () => ({
  runMestreArcano: vi.fn(),
}));

vi.mock("@/infrastructure/openai/mestre-arcano-tool-context", () => ({
  createMestreArcanoToolContext: mocks.toolContext,
}));

vi.mock("@/infrastructure/integrations/microsoft-sharepoint", () => ({
  MICROSOFT_SHAREPOINT_CREDENTIALS_COOKIE: "aa_sharepoint_credentials",
  decryptMicrosoftSharePointCredentials: mocks.decryptCredentials,
  encryptMicrosoftSharePointCredentials: vi.fn(),
  getValidMicrosoftSharePointCredentials: mocks.getValidCredentials,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: vi.fn() }),
}));

vi.mock(
  "@/infrastructure/supabase/security/api-rate-limit-repository",
  () => ({
    SupabaseApiRateLimitRepository: class {
      consume = mocks.consume;
    },
  }),
);

import { POST } from "./route";

function post(body: unknown) {
  return new Request("https://example.test/api/agent/mestre-arcano", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/agent/mestre-arcano", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthenticatedUser.mockResolvedValue({
      sub: "97000000-0000-4000-8000-000000000001",
    });
    mocks.createClient.mockResolvedValue({ from: vi.fn() });
    mocks.decryptCredentials.mockResolvedValue(null);
    mocks.toolContext.mockReturnValue({ tools: [] });
    mocks.executeMestreArcano.mockResolvedValue({ answer: "O Círculo Dourado." });
    mocks.consume.mockResolvedValue({
      allowed: true,
      remaining: 9,
      retryAfterSeconds: 0,
    });
  });

  it("reaches the model only when the quota allows it", async () => {
    const response = await POST(post({ input: "O que é o Círculo Dourado?" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      answer: "O Círculo Dourado.",
    });
    expect(mocks.consume).toHaveBeenCalledWith("mestre-arcano");
    expect(mocks.executeMestreArcano).toHaveBeenCalledTimes(1);
  });

  it("refuses with 429 and never calls the model once the quota is exhausted", async () => {
    mocks.consume.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 17,
    });

    const response = await POST(post({ input: "O que é o Círculo Dourado?" }));
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("17");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(payload.error).not.toMatch(/mestre-arcano|quota|10/);
    expect(mocks.executeMestreArcano).not.toHaveBeenCalled();
    expect(mocks.toolContext).not.toHaveBeenCalled();
  });

  it("stays fail-closed with 503 when the limiter cannot answer", async () => {
    mocks.consume.mockRejectedValue(new Error("permission denied for function"));

    const response = await POST(post({ input: "O que é o Círculo Dourado?" }));

    expect(response.status).toBe(503);
    expect(mocks.executeMestreArcano).not.toHaveBeenCalled();
  });

  it("does not consume the quota for an empty message", async () => {
    const response = await POST(post({ input: "   " }));

    expect(response.status).toBe(400);
    expect(mocks.consume).not.toHaveBeenCalled();
    expect(mocks.executeMestreArcano).not.toHaveBeenCalled();
  });

  it("does not consume the quota for an oversized message", async () => {
    const response = await POST(post({ input: "a".repeat(8001) }));

    expect(response.status).toBe(413);
    expect(mocks.consume).not.toHaveBeenCalled();
    expect(mocks.executeMestreArcano).not.toHaveBeenCalled();
  });

  it("rejects an oversized JSON body even when the input text is short", async () => {
    const response = await POST(post({ input: "Olá", padding: "x".repeat(256 * 1024) }));

    expect(response.status).toBe(413);
    expect(mocks.consume).not.toHaveBeenCalled();
    expect(mocks.executeMestreArcano).not.toHaveBeenCalled();
    expect(mocks.toolContext).not.toHaveBeenCalled();
  });

  it("does not consume the quota for malformed JSON", async () => {
    const response = await POST(
      new Request("https://example.test/api/agent/mestre-arcano", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.consume).not.toHaveBeenCalled();
  });
});

describe("Mestre Arcano POST JSON validation", () => {
  it.each([
    ["null", "null"],
    ["array", "[]"],
    ["numeric primitive", "42"],
    ["boolean primitive", "false"],
    ["string primitive", '"hello"'],
    ["missing input", "{}"],
    ["null input", '{"input":null}'],
    ["whitespace input", '{"input":"  "}'],
  ])("returns 400 for %s without accessing provider state", async (_name, raw) => {
    const response = await POST(
      new Request("https://example.test/api/agent/mestre-arcano", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: raw,
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Informe uma mensagem para o Mestre Arcano.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.consume).not.toHaveBeenCalled();
    expect(mocks.executeMestreArcano).not.toHaveBeenCalled();
  });
});
