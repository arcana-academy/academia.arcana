import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import {
  LEARNING_VIEW_PATHS,
  revalidateLearningViews,
} from "./revalidate-learning-views";

describe("learning journey route refresh contract", () => {
  beforeEach(() => {
    mocks.revalidatePath.mockReset();
  });

  it.each(Object.entries(LEARNING_VIEW_PATHS))(
    "revalidates only the affected authenticated views for %s",
    (event, paths) => {
      revalidateLearningViews(event as keyof typeof LEARNING_VIEW_PATHS);

      expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
        ...paths,
      ]);
      expect(new Set(paths).size).toBe(paths.length);
      expect(paths.every((path) => path.startsWith("/"))).toBe(true);
    },
  );

  it("refreshes the Grimórios library after a hierarchy write", () => {
    revalidateLearningViews("learning-hierarchy-changed");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/grimorios");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/workspace");
  });

  it("refreshes the mission view only for a persisted task completion", () => {
    revalidateLearningViews("study-task-created");
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/missoes");

    mocks.revalidatePath.mockReset();
    revalidateLearningViews("study-task-completed");

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/missoes");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/cronograma");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/santuario");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/academia");
  });

  it("refreshes the authenticated review queue after persisted practice evidence", () => {
    revalidateLearningViews("practice-evidence-recorded");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/revisoes");

    mocks.revalidatePath.mockReset();
    revalidateLearningViews("study-task-created");
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/revisoes");
  });

  it("does not invent missions when recording educational evidence", () => {
    revalidateLearningViews("practice-evidence-recorded");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/workspace");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/estatisticas");
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/missoes");
  });
});
