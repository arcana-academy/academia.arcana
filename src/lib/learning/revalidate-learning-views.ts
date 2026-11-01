import { revalidatePath } from "next/cache";

/**
 * Route projections affected by an authenticated learning write.
 *
 * This does not create tasks, missions, practice evidence or XP. Only the
 * corresponding domain operation may do so. Keep this in the application
 * delivery boundary rather than in repositories or database triggers.
 */
export const LEARNING_VIEW_PATHS = {
  "learning-hierarchy-changed": [
    "/workspace",
    "/grimorios",
    "/santuario",
    "/academia",
    "/pratica",
  ],
  "page-content-changed": [
    "/workspace",
    "/santuario",
    "/academia",
    "/pratica",
  ],
  "page-progress-changed": [
    "/workspace",
    "/santuario",
    "/academia",
    "/estatisticas",
  ],
  "practice-item-created": ["/pratica", "/estatisticas"],
  "practice-evidence-recorded": [
    "/pratica",
    "/revisoes",
    "/workspace",
    "/santuario",
    "/academia",
    "/estatisticas",
  ],
  "study-task-created": ["/cronograma", "/santuario", "/academia"],
  "practice-review-planned": [
    "/pratica",
    "/cronograma",
    "/santuario",
    "/academia",
    "/estatisticas",
  ],
  "study-task-completed": [
    "/cronograma",
    "/missoes",
    "/santuario",
    "/academia",
    "/estatisticas",
  ],
} as const;

export type LearningViewEvent = keyof typeof LEARNING_VIEW_PATHS;

/** Invoke only after the owning write completes successfully. */
export function revalidateLearningViews(event: LearningViewEvent): void {
  for (const path of LEARNING_VIEW_PATHS[event]) {
    revalidatePath(path);
  }
}
