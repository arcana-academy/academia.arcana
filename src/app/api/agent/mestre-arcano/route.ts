import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { executeMestreArcano } from "@/application/intelligence/execute-mestre-arcano";
import { resolveMestreArcanoHelpLevel } from "@/domains/intelligence";
import { createClient } from "@/lib/supabase/server";
import {
  runMestreArcano,
  runMestreArcanoSourceComparison,
} from "@/infrastructure/openai/mestre-arcano";
import { createMestreArcanoToolContext } from "@/infrastructure/openai/mestre-arcano-tool-context";
import {
  decryptMicrosoftSharePointCredentials,
  encryptMicrosoftSharePointCredentials,
  getValidMicrosoftSharePointCredentials,
  MICROSOFT_SHAREPOINT_CREDENTIALS_COOKIE,
} from "@/infrastructure/integrations/microsoft-sharepoint";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { consumeApiRateLimit } from "@/application/security/api-rate-limit";
import { SupabaseApiRateLimitRepository } from "@/infrastructure/supabase/security/api-rate-limit-repository";
import { apiRateLimitResponse } from "@/lib/http/api-rate-limit-response";

export const dynamic = "force-dynamic";

const MAX_MESSAGE_LENGTH = 8000;
const MAX_SOURCE_TEXT_LENGTH = 3000;
const MAX_SOURCE_ORIGIN_LENGTH = 500;
const MAX_COMPARISON_INPUT_LENGTH = 16000;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type JsonErrorResponse = ReturnType<typeof NextResponse.json>;

type MestreArcanoHelpLevelValue = NonNullable<
  ReturnType<typeof resolveMestreArcanoHelpLevel>
>;

/**
 * Resultado de uma etapa de parsing/validação: ou o valor pronto para uso
 * (`ok: true`) ou a resposta de erro que deve ser devolvida ao cliente
 * (`ok: false`).
 */
type StepResult<T> =
  | { ok: true; value: T }
  | { ok: false; response: JsonErrorResponse };

/**
 * Restringe um corpo JSON já parseado a um objeto simples (ou `null`):
 * JSON pode ser `null`, array ou primitivo, e nada deve ser dereferenciado
 * antes dessa validação.
 */
function asPayloadObject(body: unknown): Record<string, unknown> | null {
  return typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
}

/**
 * Monta o payload JSON determinístico da tarefa de comparação de fontes,
 * identificando os trechos como F01-A (v1.0) e F01-B (v1.1) e incluindo a
 * origem opcional somente quando informada.
 */
function buildSourceComparisonInput(
  sourceA: string,
  sourceB: string,
  origin?: string,
): string {
  return JSON.stringify({
    task: "compare-source-texts",
    sources: [
      { id: "F01-A", title: "Seção 3.2 da v1.0", text: sourceA },
      { id: "F01-B", title: "Seção 3.2 da v1.1", text: sourceB },
    ],
    ...(origin ? { origin } : {}),
  });
}

/**
 * Lê o corpo da requisição como JSON e valida o campo `mode`, devolvendo o
 * payload (possivelmente `null`) e se a requisição é uma comparação de
 * fontes. Corpo malformado ou modo desconhecido viram resposta 400.
 */
async function parseValidatedPayload(
  request: Request,
): Promise<
  StepResult<{
    payload: Record<string, unknown> | null;
    isSourceComparison: boolean;
  }>
> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "JSON inválido." }, { status: 400 }),
    };
  }

  const payload = asPayloadObject(body);
  const mode = payload?.mode;
  const isSourceComparison = mode === "source-comparison";
  if (mode !== undefined && !isSourceComparison) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Modo de consulta inválido." },
        { status: 400 },
      ),
    };
  }

  return { ok: true, value: { payload, isSourceComparison } };
}

/**
 * Indica se o valor recebido é um texto não vazio (após trim), usado para
 * validar campos obrigatórios sem repetir checagens de tipo.
 */
function hasNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Valida os textos das duas fontes da comparação: obrigatórios, não vazios e
 * com no máximo 3.000 caracteres cada. Devolve os textos normalizados (trim)
 * e a origem ainda não validada, preservando a ordem original das respostas
 * (400 para tipo/conteúdo, 413 para tamanho).
 */
function validateComparisonSourceTexts(
  payload: Record<string, unknown> | null,
): StepResult<{ sourceA: string; sourceB: string; origin: unknown }> {
  const sourceA = payload?.sourceA;
  const sourceB = payload?.sourceB;

  if (!hasNonEmptyText(sourceA) || !hasNonEmptyText(sourceB)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Informe o texto de F01-A e F01-B para comparar." },
        { status: 400 },
      ),
    };
  }

  const normalizedSourceA = sourceA.trim();
  const normalizedSourceB = sourceB.trim();
  if (
    normalizedSourceA.length > MAX_SOURCE_TEXT_LENGTH ||
    normalizedSourceB.length > MAX_SOURCE_TEXT_LENGTH
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Cada texto deve ter no máximo 3.000 caracteres." },
        { status: 413 },
      ),
    };
  }

  return {
    ok: true,
    value: {
      sourceA: normalizedSourceA,
      sourceB: normalizedSourceB,
      origin: payload?.origin,
    },
  };
}

/**
 * Valida a origem opcional da comparação: quando informada deve ser texto
 * (400 caso contrário) com no máximo 500 caracteres (413 quando excedido).
 * Devolve a origem normalizada, ou string vazia quando ausente.
 */
function validateComparisonOrigin(origin: unknown): StepResult<string> {
  if (origin !== undefined && typeof origin !== "string") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "A origem deve ser um texto, quando informada." },
        { status: 400 },
      ),
    };
  }

  const normalizedOrigin = typeof origin === "string" ? origin.trim() : "";
  if (normalizedOrigin.length > MAX_SOURCE_ORIGIN_LENGTH) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "A origem deve ter no máximo 500 caracteres." },
        { status: 413 },
      ),
    };
  }

  return { ok: true, value: normalizedOrigin };
}

/**
 * Monta o input JSON da comparação e garante que o payload final não excede
 * o limite combinado de 16.000 caracteres (413 quando excedido).
 */
function buildValidatedComparisonInput(
  sourceA: string,
  sourceB: string,
  normalizedOrigin: string,
): StepResult<string> {
  const input = buildSourceComparisonInput(
    sourceA,
    sourceB,
    normalizedOrigin || undefined,
  );
  if (input.length > MAX_COMPARISON_INPUT_LENGTH) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "O conteúdo excede o limite permitido para comparação." },
        { status: 413 },
      ),
    };
  }

  return { ok: true, value: input };
}

/**
 * Valida a mensagem livre enviada ao Mestre Arcano: texto obrigatório, não
 * vazio e com no máximo 8.000 caracteres. O valor original (sem trim) é
 * preservado como input do agente.
 */
function validateMessageInput(
  payload: Record<string, unknown> | null,
): StepResult<string> {
  const message = payload?.input;
  if (typeof message !== "string" || !message.trim()) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Informe uma mensagem para o Mestre Arcano." },
        { status: 400 },
      ),
    };
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "A mensagem excede o limite permitido." },
        { status: 413 },
      ),
    };
  }

  return { ok: true, value: message };
}

/**
 * Resolve o input da requisição conforme o modo: comparação de fontes
 * (textos, origem e payload JSON validados em sequência) ou mensagem livre.
 * Devolve a resposta de erro correspondente quando alguma etapa falha.
 */
function resolveAgentInput(parsed: {
  payload: Record<string, unknown> | null;
  isSourceComparison: boolean;
}): StepResult<string> {
  if (!parsed.isSourceComparison) {
    return validateMessageInput(parsed.payload);
  }

  const sources = validateComparisonSourceTexts(parsed.payload);
  if (!sources.ok) {
    return sources;
  }

  const origin = validateComparisonOrigin(sources.value.origin);
  if (!origin.ok) {
    return origin;
  }

  return buildValidatedComparisonInput(
    sources.value.sourceA,
    sources.value.sourceB,
    origin.value,
  );
}

/**
 * Valida o nível de ajuda informado no payload, convertendo valor ausente ou
 * inválido em resposta 400 e devolvendo o nível resolvido quando válido.
 */
function validateHelpLevel(
  payload: Record<string, unknown> | null,
): StepResult<MestreArcanoHelpLevelValue> {
  const helpLevel = resolveMestreArcanoHelpLevel(payload?.helpLevel);
  if (helpLevel === null) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Nível de ajuda inválido." },
        { status: 400 },
      ),
    };
  }

  return { ok: true, value: helpLevel };
}

/**
 * Orquestra o parsing e toda a validação da requisição (payload, modo,
 * input e nível de ajuda), devolvendo os valores prontos para execução ou a
 * resposta de erro da primeira etapa que falhar.
 */
async function validateRequest(
  request: Request,
): Promise<
  StepResult<{
    input: string;
    helpLevel: MestreArcanoHelpLevelValue;
    isSourceComparison: boolean;
  }>
> {
  const parsed = await parseValidatedPayload(request);
  if (!parsed.ok) {
    return parsed;
  }

  const resolvedInput = resolveAgentInput(parsed.value);
  if (!resolvedInput.ok) {
    return resolvedInput;
  }

  const helpLevel = validateHelpLevel(parsed.value.payload);
  if (!helpLevel.ok) {
    return helpLevel;
  }

  return {
    ok: true,
    value: {
      input: resolvedInput.value,
      helpLevel: helpLevel.value,
      isSourceComparison: parsed.value.isSourceComparison,
    },
  };
}

/**
 * Consome uma unidade da cota de rate limit do Mestre Arcano e devolve a
 * resposta de bloqueio quando o limite foi atingido (ou quando o limitador
 * não consegue responder), ou `null` quando a requisição pode prosseguir.
 */
async function consumeMestreArcanoQuota(
  supabase: SupabaseServerClient,
): Promise<JsonErrorResponse | null> {
  return apiRateLimitResponse(
    await consumeApiRateLimit(
      new SupabaseApiRateLimitRepository(supabase),
      "mestre-arcano",
    ),
  );
}

/**
 * Obtém as credenciais SharePoint válidas do usuário a partir do cookie
 * criptografado, renovando o token quando necessário e persistindo o novo
 * valor no cookie. Qualquer falha devolve `null`, mantendo a requisição sem
 * integração SharePoint.
 */
async function refreshSharePointCredentials(
  subjectId: string,
): Promise<Awaited<
  ReturnType<typeof getValidMicrosoftSharePointCredentials>
> | null> {
  const cookieStore = await cookies();
  const rawSharePointCredentials = cookieStore.get(
    MICROSOFT_SHAREPOINT_CREDENTIALS_COOKIE,
  )?.value;
  const sharePointCredentials = await decryptMicrosoftSharePointCredentials(
    rawSharePointCredentials,
  );

  if (sharePointCredentials?.subjectId !== subjectId) {
    return null;
  }

  try {
    const validCredentials = await getValidMicrosoftSharePointCredentials(
      sharePointCredentials,
    );

    if (validCredentials.accessToken !== sharePointCredentials.accessToken) {
      cookieStore.set(
        MICROSOFT_SHAREPOINT_CREDENTIALS_COOKIE,
        await encryptMicrosoftSharePointCredentials(validCredentials),
        {
          httpOnly: true,
          maxAge: 30 * 24 * 60 * 60,
          path: "/",
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        },
      );
    }

    return validCredentials;
  } catch {
    return null;
  }
}

/**
 * Executa o modo de comparação de fontes: consome a cota de rate limit e,
 * se liberado, chama o modelo com o payload JSON montado, devolvendo o
 * resultado sem cache.
 */
async function executeSourceComparison(
  supabase: SupabaseServerClient,
  input: string,
): Promise<JsonErrorResponse> {
  const limitResponse = await consumeMestreArcanoQuota(supabase);
  if (limitResponse) {
    return limitResponse;
  }

  const result = await runMestreArcanoSourceComparison(input);
  return NextResponse.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Executa a conversa com o agente (mensagem livre): resolve as credenciais
 * SharePoint do usuário, consome a cota de rate limit e só então chama o
 * modelo com o contexto de ferramentas autorizado.
 */
async function executeAgentConversation(options: {
  supabase: SupabaseServerClient;
  subjectId: string;
  input: string;
  helpLevel: MestreArcanoHelpLevelValue;
}): Promise<JsonErrorResponse> {
  const { supabase, subjectId, input, helpLevel } = options;
  const microsoftSharePointCredentials =
    await refreshSharePointCredentials(subjectId);

  // Metered surface: only validated requests that would actually reach the
  // model consume the quota, and an unbounded request is refused when the
  // limiter cannot answer.
  const limitResponse = await consumeMestreArcanoQuota(supabase);
  if (limitResponse) {
    return limitResponse;
  }

  const toolContext = createMestreArcanoToolContext({
    supabase,
    ownerId: subjectId,
    microsoftSharePointCredentials,
  });

  const result = await executeMestreArcano(
    {
      execute: (agentInput) =>
        runMestreArcano(agentInput, {
          toolContext,
          helpLevel,
        }),
    },
    input,
  );
  return NextResponse.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Converte exceções da execução do agente em respostas HTTP: 503 quando a
 * integração OpenAI não está configurada e 502 para as demais falhas, sem
 * vazar detalhes internos do erro.
 */
function agentErrorResponse(error: unknown): JsonErrorResponse {
  const message =
    error instanceof Error ? error.message : "Falha na execução do agente.";

  // Server-side breadcrumb for triage (same pattern as the other API routes);
  // the client only receives the generic messages below, without internal
  // error details.
  console.error("Mestre Arcano agent execution failed:", message);

  if (message === "OpenAI integration is not configured.") {
    return NextResponse.json(
      { error: "O Mestre Arcano ainda não está configurado no ambiente." },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { error: "Não foi possível executar o Mestre Arcano." },
    { status: 502 },
  );
}

/**
 * Handler POST do Mestre Arcano: autentica o usuário, delega a validação
 * completa do payload e executa o fluxo correspondente (mensagem livre ou
 * comparação de fontes), sempre com rate limiting.
 */
export async function POST(request: Request) {
  const claims = await requireAuthenticatedUser();

  const validated = await validateRequest(request);
  if (!validated.ok) {
    return validated.response;
  }

  const { input, helpLevel, isSourceComparison } = validated.value;

  try {
    const supabase = await createClient();

    return isSourceComparison
      ? await executeSourceComparison(supabase, input)
      : await executeAgentConversation({
          supabase,
          subjectId: claims.sub,
          input,
          helpLevel,
        });
  } catch (error) {
    return agentErrorResponse(error);
  }
}
