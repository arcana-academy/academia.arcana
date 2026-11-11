import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  NORMALIZED_EXACT_MATCH_CRITERION,
  NORMALIZED_EXACT_MATCH_CRITERION_VERSION,
} from "@/domains/education";
import { SupabaseEducationalPracticeRepository } from "./practice-repository";

const ownerId = "c1000000-0000-4000-8000-000000000001";
const pageId = "c5000000-0000-4000-8000-000000000001";

function makeClient() {
  const insert = vi.fn((values: Record<string, unknown>) => ({
    select: () => ({
      single: async () => ({
        data: {
          ...values,
          id: "c6000000-0000-4000-8000-000000000001",
          active: true,
          created_at: "2026-10-28T00:00:00Z",
          updated_at: "2026-10-28T00:00:00Z",
        },
        error: null,
      }),
    }),
  }));

  const from = vi.fn((table: string) => {
    if (table === "educational_practice_items") {
      return { insert };
    }
    if (table === "pages") {
      return {
        select: () => ({
          order: async () => ({
            data: [{ id: pageId, title: "Página sintética" }],
            error: null,
          }),
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    client: { from } as unknown as SupabaseClient,
    insert,
  };
}

describe("SupabaseEducationalPracticeRepository objective contract", () => {
  it("uses the objective version required by the PostgreSQL constraint", async () => {
    const { client, insert } = makeClient();
    const repository = new SupabaseEducationalPracticeRepository(client);

    const created = await repository.createPracticeItem({
      ownerId,
      pageId,
      prompt: "Qual é a referência?",
      referenceAnswer: "Resposta",
      difficulty: 3,
      evidenceMode: "criterion_exact_match",
    });

    expect(NORMALIZED_EXACT_MATCH_CRITERION_VERSION).toBe(
      "criterion_exact_match_v1",
    );
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        evidence_mode: "criterion_exact_match",
        criterion: NORMALIZED_EXACT_MATCH_CRITERION,
        criterion_version: "criterion_exact_match_v1",
      }),
    );
    expect(created.criterionVersion).toBe("criterion_exact_match_v1");
  });

  it("keeps self-assessment objective metadata null", async () => {
    const { client, insert } = makeClient();
    const repository = new SupabaseEducationalPracticeRepository(client);

    await repository.createPracticeItem({
      ownerId,
      pageId,
      prompt: "Descreva uma ideia.",
      referenceAnswer: "Referência",
      difficulty: 2,
      evidenceMode: "self_assessment",
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        evidence_mode: "self_assessment",
        criterion: null,
        criterion_version: null,
      }),
    );
  });
});
