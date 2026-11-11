import { describe, expect, it } from "vitest";
import {
  MAX_OPEN_SOURCE_AI_REQUEST_BYTES,
  readBoundedJsonRequest,
  validateOpenSourceAiRequest,
} from "./open-source-ai-request";

const validRequest = {
  provider: "ollama",
  model: "llama3.2",
  messages: [{ role: "user", content: "Olá" }],
};

describe("open-source AI request security boundaries", () => {
  it("accepts valid requests with bounded defaults", () => {
    expect(validateOpenSourceAiRequest(validRequest)).toEqual({
      provider: "ollama",
      model: "llama3.2",
      messages: [{ role: "user", content: "Olá" }],
      temperature: 0.2,
      maxTokens: 1200,
    });
  });

  it.each([
    { ...validRequest, provider: "https://attacker.example" },
    { ...validRequest, provider: "langchain" },
    { ...validRequest, provider: "weaviate" },
    { ...validRequest, provider: "bentoml" },
    { ...validRequest, model: "  " },
    { ...validRequest, messages: [{ role: "developer", content: "x" }] },
    { ...validRequest, messages: [{ role: "user", content: "x".repeat(12_001) }] },
    { ...validRequest, messages: [{ role: "user", content: "x".repeat(40_001) }] },
    { ...validRequest, temperature: 2.01 },
    { ...validRequest, temperature: Number.NaN },
    { ...validRequest, maxTokens: 4_097 },
    { ...validRequest, maxTokens: 1.5 },
  ])("rejects malformed or resource-amplifying values", (input) => {
    expect(validateOpenSourceAiRequest(input)).toBeNull();
  });

  it("drops unrecognized message fields instead of forwarding arbitrary data", () => {
    expect(
      validateOpenSourceAiRequest({
        ...validRequest,
        messages: [{ role: "user", content: "hello", tool_call: { secret: true } }],
      }),
    ).toEqual({
      provider: "ollama",
      model: "llama3.2",
      messages: [{ role: "user", content: "hello" }],
      temperature: 0.2,
      maxTokens: 1200,
    });
  });

  it("reads bounded JSON and rejects a payload over the stream limit", async () => {
    const accepted = await readBoundedJsonRequest(
      new Request("https://app.example/api/ia-aberta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validRequest),
      }),
    );
    expect(accepted).toEqual({ ok: true, value: validRequest });

    const tooLarge = await readBoundedJsonRequest(
      new Request("https://app.example/api/ia-aberta", {
        method: "POST",
        body: JSON.stringify({ value: "x".repeat(MAX_OPEN_SOURCE_AI_REQUEST_BYTES) }),
      }),
    );
    expect(tooLarge).toEqual({ ok: false, status: 413 });
  });
});
