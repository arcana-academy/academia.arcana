import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  Chapter,
  Grimoire,
  Notebook,
  Page,
} from "@/domains/learning";

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  createClient: vi.fn(),
  createGrimoireRepository: vi.fn(),
  createNotebookRepository: vi.fn(),
  createChapterRepository: vi.fn(),
  createPageRepository: vi.fn(),
  revalidateLearningViews: vi.fn(),
  setPageProgressStatus: vi.fn(),
}));

vi.mock("@/lib/auth/require-authenticated-user", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/infrastructure/supabase/workspace/grimoire-repository", () => ({
  createGrimoireRepository: mocks.createGrimoireRepository,
}));

vi.mock("@/infrastructure/supabase/workspace/notebook-repository", () => ({
  createNotebookRepository: mocks.createNotebookRepository,
}));

vi.mock("@/infrastructure/supabase/workspace/chapter-repository", () => ({
  createChapterRepository: mocks.createChapterRepository,
}));

vi.mock("@/infrastructure/supabase/workspace/page-repository", () => ({
  createPageRepository: mocks.createPageRepository,
}));

vi.mock("@/lib/learning/revalidate-learning-views", () => ({
  revalidateLearningViews: mocks.revalidateLearningViews,
}));

vi.mock("@/infrastructure/supabase/learning/page-progress-repository", () => ({
  SupabasePageProgressRepository: class {
    setStatus = mocks.setPageProgressStatus;
  },
}));

import {
  createWorkspaceChapter,
  createWorkspaceGrimoire,
  createWorkspaceNotebook,
  createWorkspacePage,
  deleteWorkspacePage,
  moveWorkspacePage,
  renameWorkspaceChapter,
  renameWorkspaceGrimoire,
  renameWorkspaceNotebook,
  updateWorkspacePage,
  setWorkspacePageProgress,
} from "./actions";

const supabaseClient = {};

const grimoireRepository = {
  create: vi.fn(),
  getById: vi.fn(),
  listByOwner: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const notebookRepository = {
  create: vi.fn(),
  listByGrimoire: vi.fn(),
  getById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  reorder: vi.fn(),
};

const chapterRepository = {
  create: vi.fn(),
  listByNotebook: vi.fn(),
  getById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  reorder: vi.fn(),
};

const pageRepository = {
  create: vi.fn(),
  listByChapter: vi.fn(),
  getById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  reorder: vi.fn(),
  move: vi.fn(),
};

const grimoire: Grimoire = {
  id: "grimoire-1",
  ownerId: "user-1",
  title: "Grimório",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const notebook: Notebook = {
  id: "notebook-1",
  grimoireId: "grimoire-1",
  title: "Caderno",
  position: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const chapter: Chapter = {
  id: "chapter-1",
  notebookId: "notebook-1",
  title: "Capítulo",
  position: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const page: Page = {
  id: "page-1",
  chapterId: "chapter-1",
  title: "Página",
  content: { type: "document", blocks: [] },
  position: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const secondPage: Page = {
  ...page,
  id: "page-2",
  title: "Segunda página",
  position: 1,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("crypto", {
    randomUUID: vi.fn(() => "generated-id"),
  });
  mocks.requireAuthenticatedUser.mockResolvedValue({ sub: "user-1" });
  mocks.createClient.mockResolvedValue(supabaseClient);
  mocks.createGrimoireRepository.mockReturnValue(grimoireRepository);
  mocks.createNotebookRepository.mockReturnValue(notebookRepository);
  mocks.createChapterRepository.mockReturnValue(chapterRepository);
  mocks.createPageRepository.mockReturnValue(pageRepository);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Workspace Server Actions", () => {
  it("does not create a Supabase client when authentication fails", async () => {
    const authError = new Error("unauthenticated");
    mocks.requireAuthenticatedUser.mockRejectedValueOnce(authError);

    await expect(
      createWorkspaceGrimoire({ title: "Grimório" }),
    ).rejects.toBe(authError);

    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.createGrimoireRepository).not.toHaveBeenCalled();
  });

  it("creates a grimoire for the authenticated subject", async () => {
    grimoireRepository.create.mockResolvedValueOnce(grimoire);

    const result = await createWorkspaceGrimoire({ title: "  Meu grimório  " });

    expect(mocks.requireAuthenticatedUser).toHaveBeenCalledOnce();
    expect(mocks.createClient).toHaveBeenCalledOnce();
    expect(mocks.createGrimoireRepository).toHaveBeenCalledWith(supabaseClient);
    expect(grimoireRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "generated-id",
        ownerId: "user-1",
        title: "Meu grimório",
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }),
    );
    expect(result).toEqual(grimoire);
    expect(mocks.revalidateLearningViews).toHaveBeenCalledExactlyOnceWith("learning-hierarchy-changed");
  });

  it("creates a notebook after the end of the existing hierarchy", async () => {
    notebookRepository.listByGrimoire.mockResolvedValueOnce([notebook]);
    notebookRepository.create.mockResolvedValueOnce(notebook);

    const result = await createWorkspaceNotebook({
      grimoireId: "grimoire-1",
      title: "  Novo caderno  ",
    });

    expect(notebookRepository.listByGrimoire).toHaveBeenCalledWith("grimoire-1");
    expect(notebookRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "generated-id",
        grimoireId: "grimoire-1",
        title: "Novo caderno",
        position: 1,
      }),
    );
    expect(result).toEqual(notebook);
    expect(mocks.revalidateLearningViews).toHaveBeenCalledExactlyOnceWith("learning-hierarchy-changed");
  });

  it("creates a chapter after the end of the existing hierarchy", async () => {
    chapterRepository.listByNotebook.mockResolvedValueOnce([chapter]);
    chapterRepository.create.mockResolvedValueOnce(chapter);

    const result = await createWorkspaceChapter({
      notebookId: "notebook-1",
      title: "  Novo capítulo  ",
    });

    expect(chapterRepository.listByNotebook).toHaveBeenCalledWith("notebook-1");
    expect(chapterRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "generated-id",
        notebookId: "notebook-1",
        title: "Novo capítulo",
        position: 1,
      }),
    );
    expect(result).toEqual(chapter);
    expect(mocks.revalidateLearningViews).toHaveBeenCalledExactlyOnceWith("learning-hierarchy-changed");
  });

  it("creates a page with an empty document at the end of its chapter", async () => {
    pageRepository.listByChapter.mockResolvedValueOnce([page]);
    pageRepository.create.mockResolvedValueOnce(page);

    const result = await createWorkspacePage({
      chapterId: "chapter-1",
      title: "  Nova página  ",
    });

    expect(pageRepository.listByChapter).toHaveBeenCalledWith("chapter-1");
    expect(pageRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "generated-id",
        chapterId: "chapter-1",
        title: "Nova página",
        content: { type: "document", blocks: [] },
        position: 1,
      }),
    );
    expect(result).toEqual(page);
  });

  it("updates a page with a trimmed title and the supplied content", async () => {
    const content = {
      type: "document" as const,
      blocks: [{ type: "paragraph", content: "Atualizado" }],
    };
    const updatedPage = { ...page, title: "Página atualizada", content };
    pageRepository.update.mockResolvedValueOnce(updatedPage);

    const result = await updateWorkspacePage({
      id: "page-1",
      title: "  Página atualizada  ",
      content,
    });

    expect(pageRepository.update).toHaveBeenCalledWith("page-1", {
      title: "Página atualizada",
      content,
      updatedAt: expect.any(String),
    });
    expect(result).toEqual(updatedPage);
  });

  it("deletes a page through the page repository", async () => {
    pageRepository.delete.mockResolvedValueOnce(undefined);

    await deleteWorkspacePage("page-1");

    expect(pageRepository.delete).toHaveBeenCalledWith("page-1");
  });

  it("renames each existing Workspace item with a trimmed title", async () => {
    grimoireRepository.update.mockResolvedValueOnce({ ...grimoire, title: "Novo grimório" });
    notebookRepository.update.mockResolvedValueOnce({ ...notebook, title: "Novo caderno" });
    chapterRepository.update.mockResolvedValueOnce({ ...chapter, title: "Novo capítulo" });

    await renameWorkspaceGrimoire({ id: "grimoire-1", title: "  Novo grimório  " });
    await renameWorkspaceNotebook({ id: "notebook-1", title: "  Novo caderno  " });
    await renameWorkspaceChapter({ id: "chapter-1", title: "  Novo capítulo  " });

    expect(grimoireRepository.update).toHaveBeenCalledWith("grimoire-1", {
      title: "Novo grimório",
      updatedAt: expect.any(String),
    });
    expect(notebookRepository.update).toHaveBeenCalledWith("notebook-1", {
      title: "Novo caderno",
      updatedAt: expect.any(String),
    });
    expect(chapterRepository.update).toHaveBeenCalledWith("chapter-1", {
      title: "Novo capítulo",
      updatedAt: expect.any(String),
    });
    expect(mocks.revalidateLearningViews).toHaveBeenCalledTimes(3);
    expect(mocks.revalidateLearningViews).toHaveBeenCalledWith("learning-hierarchy-changed");
  });

  it("rejects renaming when a title is blank", async () => {
    await expect(
      renameWorkspaceGrimoire({ id: "grimoire-1", title: "   " }),
    ).rejects.toThrow("O título do grimório é obrigatório.");
    await expect(
      renameWorkspaceNotebook({ id: "notebook-1", title: "   " }),
    ).rejects.toThrow("O título do caderno é obrigatório.");
    await expect(
      renameWorkspaceChapter({ id: "chapter-1", title: "   " }),
    ).rejects.toThrow("O título do capítulo é obrigatório.");
  });

  it.each(["up", "down"] as const)(
    "delegates a page move in the %s direction to one atomic repository call",
    async (direction) => {
      const moveResult = {
        movedPage: { ...page, position: direction === "down" ? 1 : 0 },
        swappedPage:
          direction === "down"
            ? { ...secondPage, position: 0 }
            : { ...secondPage, position: 1 },
      };
      pageRepository.move.mockResolvedValueOnce(moveResult);

      const result = await moveWorkspacePage({
        id: "page-1",
        direction,
      });

      expect(pageRepository.move).toHaveBeenCalledOnce();
      expect(pageRepository.move).toHaveBeenCalledWith("page-1", direction);
      expect(pageRepository.reorder).not.toHaveBeenCalled();
      expect(pageRepository.getById).not.toHaveBeenCalled();
      expect(pageRepository.listByChapter).not.toHaveBeenCalled();
      expect(result).toEqual(moveResult);
      expect(mocks.revalidateLearningViews).toHaveBeenCalledExactlyOnceWith("learning-hierarchy-changed");
    },
  );

  it.each([
    { direction: "up" as const, item: "primeiro item" },
    { direction: "down" as const, item: "último item" },
  ])(
    "returns the $item unchanged from the atomic operation",
    async ({ direction }) => {
      const boundaryResult = {
        movedPage: direction === "up" ? page : secondPage,
        swappedPage: null,
      };
      pageRepository.move.mockResolvedValueOnce(boundaryResult);

      const result = await moveWorkspacePage({ id: boundaryResult.movedPage.id, direction });

      expect(pageRepository.move).toHaveBeenCalledOnce();
      expect(pageRepository.move).toHaveBeenCalledWith(
        boundaryResult.movedPage.id,
        direction,
      );
      expect(pageRepository.reorder).not.toHaveBeenCalled();
      expect(result).toEqual(boundaryResult);
      expect(mocks.revalidateLearningViews).not.toHaveBeenCalled();
    },
  );


  it("propagates repository errors from the other mutating actions", async () => {
    const persistenceError = new Error("persistence failed");
    const cases = [
      () => {
        grimoireRepository.create.mockRejectedValueOnce(persistenceError);
        return createWorkspaceGrimoire({ title: "Grimório" });
      },
      () => {
        notebookRepository.listByGrimoire.mockRejectedValueOnce(persistenceError);
        return createWorkspaceNotebook({ grimoireId: "grimoire-1", title: "Caderno" });
      },
      () => {
        chapterRepository.listByNotebook.mockRejectedValueOnce(persistenceError);
        return createWorkspaceChapter({ notebookId: "notebook-1", title: "Capítulo" });
      },
      () => {
        pageRepository.listByChapter.mockRejectedValueOnce(persistenceError);
        return createWorkspacePage({ chapterId: "chapter-1", title: "Página" });
      },
      () => {
        pageRepository.update.mockRejectedValueOnce(persistenceError);
        return updateWorkspacePage({ id: "page-1", title: "Página", content: page.content });
      },
      () => {
        pageRepository.delete.mockRejectedValueOnce(persistenceError);
        return deleteWorkspacePage("page-1");
      },
      () => {
        grimoireRepository.update.mockRejectedValueOnce(persistenceError);
        return renameWorkspaceGrimoire({ id: "grimoire-1", title: "Grimório" });
      },
      () => {
        notebookRepository.update.mockRejectedValueOnce(persistenceError);
        return renameWorkspaceNotebook({ id: "notebook-1", title: "Caderno" });
      },
      () => {
        chapterRepository.update.mockRejectedValueOnce(persistenceError);
        return renameWorkspaceChapter({ id: "chapter-1", title: "Capítulo" });
      },
    ];

    for (const run of cases) {
      await expect(run()).rejects.toBe(persistenceError);
    }
    expect(mocks.revalidateLearningViews).not.toHaveBeenCalled();
  });

  it("rejects moving a page that cannot be found", async () => {
    pageRepository.move.mockResolvedValueOnce(null);

    await expect(
      moveWorkspacePage({ id: "missing-page", direction: "up" }),
    ).rejects.toThrow("Página não encontrada.");
    expect(pageRepository.move).toHaveBeenCalledOnce();
    expect(pageRepository.reorder).not.toHaveBeenCalled();
  });

  it("rejects an invalid movement direction before creating a client", async () => {
    await expect(
      moveWorkspacePage({
        id: "page-1",
        direction: "sideways" as "up",
      }),
    ).rejects.toThrow("Direção de movimento inválida.");

    expect(mocks.requireAuthenticatedUser).toHaveBeenCalledOnce();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(pageRepository.move).not.toHaveBeenCalled();
  });

  it("does not move a page when authentication fails", async () => {
    const authError = new Error("unauthenticated");
    mocks.requireAuthenticatedUser.mockRejectedValueOnce(authError);

    await expect(
      moveWorkspacePage({ id: "page-1", direction: "down" }),
    ).rejects.toBe(authError);

    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(pageRepository.move).not.toHaveBeenCalled();
  });

  it("propagates an error from the atomic move operation", async () => {
    const persistenceError = new Error("atomic move failed");
    pageRepository.move.mockRejectedValueOnce(persistenceError);

    await expect(
      moveWorkspacePage({ id: "page-1", direction: "down" }),
    ).rejects.toBe(persistenceError);

    expect(pageRepository.move).toHaveBeenCalledOnce();
    expect(pageRepository.reorder).not.toHaveBeenCalled();
  });

  it("refreshes chapter navigation after a page is persisted", async () => {
    pageRepository.listByChapter.mockResolvedValueOnce([]);
    pageRepository.create.mockResolvedValueOnce(page);

    await createWorkspacePage({ chapterId: "chapter-1", title: "Página" });

    expect(mocks.revalidateLearningViews).toHaveBeenCalledExactlyOnceWith(
      "learning-hierarchy-changed",
    );
  });

  it("refreshes the Sanctuary and Academia after a successful page update", async () => {
    pageRepository.update.mockResolvedValueOnce(page);

    await updateWorkspacePage({
      id: "page-1",
      title: "Página",
      content: page.content,
    });

    expect(mocks.revalidateLearningViews).toHaveBeenCalledWith("page-content-changed");
  });

  it("refreshes progress views only after status persistence succeeds", async () => {
    mocks.setPageProgressStatus.mockResolvedValueOnce(undefined);

    await setWorkspacePageProgress({
      pageId: "page-1",
      status: "completed",
    });

    expect(mocks.setPageProgressStatus).toHaveBeenCalledWith(
      "user-1",
      "page-1",
      "completed",
      expect.any(String),
    );
    expect(mocks.revalidateLearningViews).toHaveBeenCalledWith("page-progress-changed");
  });

  it("does not refresh progress when the repository rejects the write", async () => {
    mocks.setPageProgressStatus.mockRejectedValueOnce(new Error("progress not saved"));

    await expect(setWorkspacePageProgress({
      pageId: "page-1",
      status: "completed",
    })).rejects.toThrow("progress not saved");

    expect(mocks.revalidateLearningViews).not.toHaveBeenCalled();
  });

  it("does not refresh an unchanged page when update persistence fails", async () => {
    pageRepository.update.mockRejectedValueOnce(new Error("page not saved"));

    await expect(updateWorkspacePage({
      id: "page-1",
      title: "Página",
      content: page.content,
    })).rejects.toThrow("page not saved");

    expect(mocks.revalidateLearningViews).not.toHaveBeenCalled();
  });

});
