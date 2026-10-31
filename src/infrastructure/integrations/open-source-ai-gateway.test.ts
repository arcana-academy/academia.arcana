import { afterEach, describe, expect, it, vi } from "vitest";
import { invokeOpenSourceAi } from "./open-source-ai-gateway";

const input = {
  provider: "ollama" as const,
  model: "llama3.2",
  messages: [{ role: "user" as const, content: "Olá" }],
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("open-source AI gateway outbound boundary", () => {
  it("uses a timeout, disables redirects, and returns only provider content", async () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://ollama.internal:11434/");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "Resposta" } }] }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(invokeOpenSourceAi(input)).resolves.toEqual({
      provider: "ollama",
      model: "llama3.2",
      content: "Resposta",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://ollama.internal:11434/v1/chat/completions");
    expect(init.redirect).toBe("error");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("rejects catalog-only providers without a gateway adapter before fetch", async () => {
    vi.stubEnv("WEAVIATE_URL", "https://example.test");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(invokeOpenSourceAi({ ...input, provider: "weaviate" })).rejects.toThrow("provider_not_eligible");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects malformed endpoints before making an outbound request", async () => {
    vi.stubEnv("OLLAMA_BASE_URL", "https://user:password@example.test/?token=secret");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(invokeOpenSourceAi(input)).rejects.toThrow("provider_endpoint_invalid");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not include provider response text in errors", async () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://ollama.internal:11434");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("credential=private", { status: 500 })),
    );

    await expect(invokeOpenSourceAi(input)).rejects.not.toThrow("credential=private");
  });

  it("rejects oversized provider responses", async () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://ollama.internal:11434");
    const huge = "x".repeat(1024 * 1024 + 1);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(huge, { headers: { "Content-Length": String(huge.length) } }),
      ),
    );

    await expect(invokeOpenSourceAi(input)).rejects.toThrow("provider_response_too_large");
  });
});
