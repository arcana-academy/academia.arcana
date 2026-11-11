import { NextResponse } from "next/server";
import { z } from "zod";

import { consumeApiRateLimit } from "@/application/security/api-rate-limit";
import {
  createFeedback,
  FeedbackAuthenticationError,
} from "@/infrastructure/supabase/feedback-repository";
import { SupabaseApiRateLimitRepository } from "@/infrastructure/supabase/security/api-rate-limit-repository";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { apiRateLimitResponse } from "@/lib/http/api-rate-limit-response";
import { createClient } from "@/lib/supabase/server";

const FeedbackSchema = z.object({
  name: z.string().trim().max(120).transform((value) => value || null),
  email: z.string().trim().email().max(320),
  feedback: z.string().trim().min(1).max(2000),
});

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Revise os campos do formulário." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const input = FeedbackSchema.parse(body);

    // Validate shape before spending quota. Feedback remains fail-open when the
    // limiter itself is unavailable so an infrastructure outage cannot silence
    // students; authentication is still enforced by createFeedback.
    const supabase = await createClient();
    const limitResponse = apiRateLimitResponse(
      await consumeApiRateLimit(
        new SupabaseApiRateLimitRepository(supabase),
        "feedback",
      ),
    );
    if (limitResponse) return limitResponse;

    const record = await createFeedback(input);
    if (record.userId) {
      captureServerEvent(record.userId, "feedback_submitted", {
        feedback_length: input.feedback.length,
      });
    }
    return NextResponse.json(
      { id: record.id, createdAt: record.createdAt },
      { status: 201, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Revise os campos do formulário." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (error instanceof FeedbackAuthenticationError) {
      return NextResponse.json(
        { error: "Entre na sua conta para enviar feedback." },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }

    // Never return the original exception, database details or credentials.
    return NextResponse.json(
      { error: "Não foi possível salvar o feedback." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
