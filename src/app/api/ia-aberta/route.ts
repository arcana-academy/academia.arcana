import { NextResponse } from "next/server";
import {
  invokeOpenSourceAi,
} from "@/infrastructure/integrations/open-source-ai-gateway";
import {
  openSourceAiIntegrations,
  getOpenSourceAiStatus,
  isOpenSourceAiGatewayEligible,
} from "@/infrastructure/integrations/open-source-ai";
import {
  readBoundedJsonRequest,
  validateOpenSourceAiRequest,
} from "@/infrastructure/integrations/open-source-ai-request";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

type RateLimitResult = {
  allowed: boolean;
  rate_limit: number;
  remaining: number;
  retry_after_seconds: number;
};

function isRateLimitResult(value: unknown): value is RateLimitResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  return typeof result.allowed === "boolean" &&
    Number.isInteger(result.rate_limit) &&
    Number.isInteger(result.remaining) &&
    Number.isInteger(result.retry_after_seconds) &&
    (result.rate_limit as number) > 0 &&
    (result.remaining as number) >= 0 &&
    (result.remaining as number) <= (result.rate_limit as number) &&
    (result.retry_after_seconds as number) >= 1 &&
    (result.retry_after_seconds as number) <= 60;
}

export async function GET() {
  return NextResponse.json({
    integrations: openSourceAiIntegrations.map((integration) => ({
      id: integration.id,
      name: integration.name,
      product: integration.product,
      capabilities: integration.capabilities,
      runtime: integration.runtime,
      configured: getOpenSourceAiStatus(integration).configured,
      gatewaySupported: isOpenSourceAiGatewayEligible(integration.id),
      invocationEligible: isOpenSourceAiGatewayEligible(integration.id) &&
        getOpenSourceAiStatus(integration).configured,
    })),
  });
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const parsedBody = await readBoundedJsonRequest(request);
    if (!parsedBody.ok) {
      return NextResponse.json(
        { error: parsedBody.status === 413 ? "Solicitação excede o limite permitido." : "JSON inválido." },
        { status: parsedBody.status },
      );
    }

    const body = validateOpenSourceAiRequest(parsedBody.value);
    if (!body) {
      return NextResponse.json(
        { error: "Revise o provider, modelo, mensagens e limites solicitados." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    // PostgreSQL atomically grants a durable per-account slot before any
    // provider call. A limiter outage fails closed to avoid unmetered spend.
    let rateLimitData: unknown;
    let rateLimitError: unknown;
    try {
      const result = await supabase.rpc("consume_open_source_ai_rate_limit");
      rateLimitData = result.data;
      rateLimitError = result.error;
    } catch {
      rateLimitError = true;
    }
    const rateLimitRow = Array.isArray(rateLimitData) && rateLimitData.length === 1
      ? rateLimitData[0]
      : null;
    if (rateLimitError || !isRateLimitResult(rateLimitRow)) {
      return NextResponse.json(
        { error: "O limite de uso está temporariamente indisponível." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const rateLimitHeaders = {
      "Cache-Control": "private, no-store",
      "RateLimit-Limit": String(rateLimitRow.rate_limit),
      "RateLimit-Remaining": String(rateLimitRow.remaining),
    };
    if (!rateLimitRow.allowed) {
      return NextResponse.json(
        { error: "Limite de uso atingido. Tente novamente após o intervalo informado." },
        {
          status: 429,
          headers: {
            ...rateLimitHeaders,
            "Retry-After": String(rateLimitRow.retry_after_seconds),
          },
        },
      );
    }

    const result = await invokeOpenSourceAi(body);
    return NextResponse.json(result, { headers: rateLimitHeaders });
  } catch {
    // Do not echo provider error bodies, endpoint details, or runtime configuration.
    return NextResponse.json(
      { error: "Não foi possível concluir a solicitação ao provider." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
