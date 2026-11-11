import type {
  ObjectiveScoringPolicy,
  PracticeOutcome,
} from "./contracts";

export const NORMALIZED_EXACT_MATCH_CRITERION =
  "A resposta deve corresponder à resposta de referência após normalização de caixa e espaços.";

export const NORMALIZED_EXACT_MATCH_CRITERION_VERSION = "criterion_exact_match_v1";

export type ObjectiveEvaluation = {
  outcome: PracticeOutcome;
  evidenceScore: number;
  confidence: "strong";
  criterionResult: "pass" | "fail";
  feedback: string;
};

/** Normalizes the bounded V1 objective answer criterion deterministically. */
export function normalizeObjectiveAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Evaluates the canonical normalized exact-match criterion. */
export function evaluateObjectiveExactMatch(
  answer: string,
  referenceAnswer: string,
  scoringPolicy: ObjectiveScoringPolicy,
): ObjectiveEvaluation {
  if (scoringPolicy !== "normalized-exact-match") {
    throw new Error("Política objetiva não suportada.");
  }

  const passed =
    normalizeObjectiveAnswer(answer) === normalizeObjectiveAnswer(referenceAnswer);

  return {
    outcome: passed ? "strong" : "insufficient",
    evidenceScore: passed ? 1 : 0,
    confidence: "strong",
    criterionResult: passed ? "pass" : "fail",
    feedback: passed
      ? "A resposta atendeu ao critério objetivo desta atividade por correspondência exata normalizada."
      : "A resposta não atendeu ao critério objetivo desta atividade. Isso é evidência sobre esta tarefa, não uma conclusão global sobre sua aprendizagem.",
  };
}
