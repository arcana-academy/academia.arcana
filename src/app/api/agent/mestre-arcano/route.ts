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

export async function POST(request: Request) {
  const claims = await requireAuthenticatedUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  // JSON may be null, an array, or a primitive. Never dereference until validated.
  const payload =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;

  const mode = payload?.mode;
  const isSourceComparison = mode === "source-comparison";
  if (mode !== undefined && !isSourceComparison) {
    return NextResponse.json({ error: "Modo de consulta inválido." }, { status: 400 });
  }

  let input: string;
  if (isSourceComparison) {
    const sourceA = payload?.sourceA;
    const sourceB = payload?.sourceB;
    const origin = payload?.origin;

    if (
      typeof sourceA !== "string" || !sourceA.trim() ||
      typeof sourceB !== "string" || !sourceB.trim()
    ) {
      return NextResponse.json(
        { error: "Informe o texto de F01-A e F01-B para comparar." },
        { status: 400 },
      );
    }

    const normalizedSourceA = sourceA.trim();
    const normalizedSourceB = sourceB.trim();
    if (
      normalizedSourceA.length > MAX_SOURCE_TEXT_LENGTH ||
      normalizedSourceB.length > MAX_SOURCE_TEXT_LENGTH
    ) {
      return NextResponse.json(
        { error: "Cada texto deve ter no máximo 3.000 caracteres." },
        { status: 413 },
      );
    }

    if (origin !== undefined && typeof origin !== "string") {
      return NextResponse.json(
        { error: "A origem deve ser um texto, quando informada." },
        { status: 400 },
      );
    }

    const normalizedOrigin = typeof origin === "string" ? origin.trim() : "";
    if (normalizedOrigin.length > MAX_SOURCE_ORIGIN_LENGTH) {
      return NextResponse.json(
        { error: "A origem deve ter no máximo 500 caracteres." },
        { status: 413 },
      );
    }

    input = buildSourceComparisonInput(
      normalizedSourceA,
      normalizedSourceB,
      normalizedOrigin || undefined,
    );
    if (input.length > MAX_COMPARISON_INPUT_LENGTH) {
      return NextResponse.json(
        { error: "O conteúdo excede o limite permitido para comparação." },
        { status: 413 },
      );
    }
  } else {
    const message = payload?.input;
    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "Informe uma mensagem para o Mestre Arcano." },
        { status: 400 },
      );
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: "A mensagem excede o limite permitido." },
        { status: 413 },
      );
    }
    input = message;
  }

  const helpLevel = resolveMestreArcanoHelpLevel(payload?.helpLevel);
  if (helpLevel === null) {
    return NextResponse.json(
      { error: "Nível de ajuda inválido." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();

    if (isSourceComparison) {
      const limitResponse = apiRateLimitResponse(
        await consumeApiRateLimit(
          new SupabaseApiRateLimitRepository(supabase),
          "mestre-arcano",
        ),
      );

      if (limitResponse) {
        return limitResponse;
      }

      const result = await runMestreArcanoSourceComparison(input);
      return NextResponse.json(result, {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      });
    }

    let microsoftSharePointCredentials = null;
    const cookieStore = await cookies();
    const rawSharePointCredentials = cookieStore.get(
      MICROSOFT_SHAREPOINT_CREDENTIALS_COOKIE,
    )?.value;
    const sharePointCredentials = await decryptMicrosoftSharePointCredentials(
      rawSharePointCredentials,
    );

    if (sharePointCredentials?.subjectId === claims.sub) {
      try {
        microsoftSharePointCredentials =
          await getValidMicrosoftSharePointCredentials(sharePointCredentials);

        if (
          microsoftSharePointCredentials.accessToken !==
          sharePointCredentials.accessToken
        ) {
          cookieStore.set(
            MICROSOFT_SHAREPOINT_CREDENTIALS_COOKIE,
            await encryptMicrosoftSharePointCredentials(
              microsoftSharePointCredentials,
            ),
            {
              httpOnly: true,
              maxAge: 30 * 24 * 60 * 60,
              path: "/",
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
            },
          );
        }
      } catch {
        microsoftSharePointCredentials = null;
      }
    }

    // Metered surface: only validated requests that would actually reach the
    // model consume the quota, and an unbounded request is refused when the
    // limiter cannot answer.
    const limitResponse = apiRateLimitResponse(
      await consumeApiRateLimit(
        new SupabaseApiRateLimitRepository(supabase),
        "mestre-arcano",
      ),
    );

    if (limitResponse) {
      return limitResponse;
    }

    const toolContext = createMestreArcanoToolContext({
      supabase,
      ownerId: claims.sub,
      microsoftSharePointCredentials,
    });

    const result = await executeMestreArcano(
      {
        execute: (input) =>
          runMestreArcano(input, {
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha na execução do agente.";

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
}
