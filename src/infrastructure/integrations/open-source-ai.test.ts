import { describe, expect, it } from "vitest";
import { getOpenSourceAiIntegration, getOpenSourceAiStatus, isOpenSourceAiGatewayEligible, openSourceAiIntegrations } from "./open-source-ai";

describe("open source AI integration catalog", () => {
  it("contains the complete validated provider set", () => {
    expect(openSourceAiIntegrations).toHaveLength(10);
    expect(getOpenSourceAiIntegration("ollama")?.license).toBe("MIT");
    expect(getOpenSourceAiIntegration("vllm")?.license).toBe("Apache-2.0");
    expect(getOpenSourceAiIntegration("huggingface")?.endpointEnv).toBe("HUGGINGFACE_BASE_URL");
  });

  it("separates catalog entries from the gateway's declared chat adapter support", () => {
    expect(isOpenSourceAiGatewayEligible("ollama")).toBe(true);
    expect(isOpenSourceAiGatewayEligible("vllm")).toBe(true);
    for (const provider of ["langchain", "weaviate", "huggingface", "bentoml"] as const) {
      expect(isOpenSourceAiGatewayEligible(provider)).toBe(false);
    }
  });

  it("reports runtime configuration from environment only", () => {
    const integration = getOpenSourceAiIntegration("ollama")!;
    const status = getOpenSourceAiStatus(integration, { OLLAMA_BASE_URL: "http://localhost:11434" });
    expect(status.configured).toBe(true);
    expect(status.endpointConfigured).toBe(true);
  });

  it("does not pretend non-runtime frameworks are connected", () => {
    const integration = getOpenSourceAiIntegration("langchain")!;
    expect(getOpenSourceAiStatus(integration).configured).toBe(false);
  });
});
