import {
  isOpenSourceAiGatewayEligible,
  type OpenSourceAiId,
} from "./open-source-ai";

import { DEFAULT_JSON_REQUEST_BYTES } from "@/lib/http/bounded-json-request";

export const MAX_OPEN_SOURCE_AI_REQUEST_BYTES = DEFAULT_JSON_REQUEST_BYTES;
export const MAX_OPEN_SOURCE_AI_MESSAGE_CHARACTERS = 12_000;
export const MAX_OPEN_SOURCE_AI_TOTAL_CHARACTERS = 40_000;
export const MAX_OPEN_SOURCE_AI_OUTPUT_TOKENS = 4_096;

export type ValidatedOpenSourceAiRequest = {
  readonly provider: OpenSourceAiId;
  readonly model: string;
  readonly messages: readonly {
    readonly role: "system" | "user" | "assistant";
    readonly content: string;
  }[];
  readonly temperature: number;
  readonly maxTokens: number;
};

/** Validates untrusted JSON without trusting compile-time TypeScript types. */
export function validateOpenSourceAiRequest(
  value: unknown,
): ValidatedOpenSourceAiRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const body = value as Record<string, unknown>;
  if (
    typeof body.provider !== "string" ||
    !isOpenSourceAiGatewayEligible(body.provider as OpenSourceAiId) ||
    typeof body.model !== "string" ||
    !body.model.trim() ||
    body.model.length > 200 ||
    !Array.isArray(body.messages) ||
    body.messages.length === 0 ||
    body.messages.length > 20
  ) {
    return null;
  }

  let totalCharacters = 0;
  const messages: ValidatedOpenSourceAiRequest["messages"][number][] = [];

  for (const item of body.messages) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const message = item as Record<string, unknown>;
    if (
      (message.role !== "system" &&
        message.role !== "user" &&
        message.role !== "assistant") ||
      typeof message.content !== "string" ||
      message.content.length > MAX_OPEN_SOURCE_AI_MESSAGE_CHARACTERS
    ) {
      return null;
    }

    totalCharacters += message.content.length;
    if (totalCharacters > MAX_OPEN_SOURCE_AI_TOTAL_CHARACTERS) return null;
    messages.push({ role: message.role, content: message.content });
  }

  const temperature = body.temperature ?? 0.2;
  if (
    typeof temperature !== "number" ||
    !Number.isFinite(temperature) ||
    temperature < 0 ||
    temperature > 2
  ) {
    return null;
  }

  const maxTokens = body.maxTokens ?? 1_200;
  if (
    typeof maxTokens !== "number" ||
    !Number.isInteger(maxTokens) ||
    maxTokens < 1 ||
    maxTokens > MAX_OPEN_SOURCE_AI_OUTPUT_TOKENS
  ) {
    return null;
  }

  return {
    provider: body.provider as OpenSourceAiId,
    model: body.model.trim(),
    messages,
    temperature,
    maxTokens,
  };
}

// Keep the existing import surface for the IA Aberta route and tests.
export { readBoundedJsonRequest, type BoundedJsonResult } from "@/lib/http/bounded-json-request";
