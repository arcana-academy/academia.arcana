import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { executeMestreArcano } from "@/application/intelligence/execute-mestre-arcano";
import { resolveMestreArcanoHelpLevel } from "@/domains/intelligence";
import { createClient } from "@/lib/supabase/server";
import { runMestreArcano } from "@/infrastructure/openai/mestre-arcano";
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
import { readBoundedJsonRequest } from "@/lib/http/bounded-json-request";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const claims = await requireAuthenticatedUser();

  const parsedBody = await readBoundedJsonRequest(request);
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: parsedBody.status === 413 ? "Solicitação excede o limite permitido." : "JSON inválido." },
      { status: parsedBody.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  // JSON may be null, an array, or a primitive. Never dereference until validated.
  const body = parsedBody.value;
  const payload =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  const input = payload?.input;

  if (typeof input !== "string" || !input.trim()) {
    return NextResponse.json(
      { error: "Informe uma mensagem para o Mestre Arcano." },
      { status: 400 },
    );
  }

  if (input.length > 8000) {
    return NextResponse.json(
      { error: "A mensagem excede o limite permitido." },
      { status: 413 },
    );
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
