import type { OpenSourceAiId } from "./open-source-ai";
import { getRuntimeSecret } from "@/infrastructure/runtime-secrets";
import { getOpenSourceAiIntegration, isOpenSourceAiGatewayEligible } from "./open-source-ai";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type GatewayRequest = {
  provider: OpenSourceAiId;
  model: string;
  messages: readonly ChatMessage[];
  temperature?: number;
  maxTokens?: number;
};

const PROVIDER_TIMEOUT_MS = 30_000;
const MAX_PROVIDER_RESPONSE_BYTES = 1024 * 1024;

function endpointFor(provider: OpenSourceAiId): string {
  // Defense in depth: direct gateway callers cannot skip route eligibility.
  if (!isOpenSourceAiGatewayEligible(provider)) throw new Error("provider_not_eligible");
  const integration = getOpenSourceAiIntegration(provider);
  if (!integration?.endpointEnv) throw new Error("provider_endpoint_not_configured");
  const configuredEndpoint = process.env[integration.endpointEnv];
  if (!configuredEndpoint) throw new Error("provider_endpoint_not_configured");

  let endpoint: URL;
  try {
    endpoint = new URL(configuredEndpoint);
  } catch {
    throw new Error("provider_endpoint_invalid");
  }

  if (
    (endpoint.protocol !== "https:" && endpoint.protocol !== "http:") ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  ) {
    throw new Error("provider_endpoint_invalid");
  }

  return endpoint.toString().replace(/\/$/, "");
}

async function readProviderResponse(response: Response): Promise<unknown> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_PROVIDER_RESPONSE_BYTES) {
    throw new Error("provider_response_too_large");
  }
  if (!response.body) throw new Error("provider_response_invalid");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PROVIDER_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("provider_response_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error("provider_response_invalid");
  }
}

export async function invokeOpenSourceAi(request: GatewayRequest) {
  const endpoint = endpointFor(request.provider);
  const integration = getOpenSourceAiIntegration(request.provider);
  const apiKey = integration?.apiKeyEnv
    ? getRuntimeSecret(integration.apiKeyEnv)
    : getRuntimeSecret("OPEN_SOURCE_AI_API_KEY");
  const response = await fetch(endpoint + "/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: "Bearer " + apiKey } : {}),
    },
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? 1200,
    }),
    cache: "no-store",
    // A gateway should not redirect a request carrying a server-side API key.
    redirect: "error",
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("provider_request_failed");
  }

  const payload = (await readProviderResponse(response)) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content) {
    throw new Error("provider_response_invalid");
  }

  return { provider: request.provider, model: request.model, content };
}
