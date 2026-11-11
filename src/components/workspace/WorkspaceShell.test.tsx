// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Chapter, Grimoire, Notebook, Page } from "@/domains/learning";
import { WorkspaceShell } from "./WorkspaceShell";

const createdGrimoire: Grimoire = {
  id: "g2",
  ownerId: "u1",
  title: "Novo grimório",
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-20T00:00:00.000Z",
};

const renamedNotebook: Notebook = {
  id: "n1",
  grimoireId: "g1",
  title: "Caderno renomeado",
  position: 0,
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-20T01:00:00.000Z",
};

const createdNotebook: Notebook = {
  id: "n2",
  grimoireId: "g1",
  title: "Novo caderno",
  position: 1,
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-20T00:00:00.000Z",
};

const createdChapter: Chapter = {
  id: "c1",
  notebookId: "n1",
  title: "Novo capítulo",
  position: 0,
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-20T00:00:00.000Z",
};

const createdPage: Page = {
  id: "p1",
  chapterId: "c1",
  title: "Nova página",
  content: {
    type: "document",
    blocks: [],
  },
  position: 0,
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-20T00:00:00.000Z",
};

/** Build the smallest hierarchy needed to exercise page creation. */
function createTree(): Parameters<typeof WorkspaceShell>[0]["tree"] {
  return {
    grimoires: [
      {
        id: "g1",
        ownerId: "u1",
        title: "Grimório",
        createdAt: "2026-09-20T00:00:00.000Z",
        updatedAt: "2026-09-20T00:00:00.000Z",
        notebooks: [
          {
            id: "n1",
            grimoireId: "g1",
            title: "Caderno",
            position: 0,
            createdAt: "2026-09-20T00:00:00.000Z",
            updatedAt: "2026-09-20T00:00:00.000Z",
            chapters: [
              {
                id: "c1",
                notebookId: "n1",
                title: "Capítulo",
                position: 0,
                createdAt: "2026-09-20T00:00:00.000Z",
                updatedAt: "2026-09-20T00:00:00.000Z",
                pages: [],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("WorkspaceShell", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/workspace?view=tree#current");
  });

  test("creates a grimoire and selects it", async () => {
    const onCreateGrimoire = vi.fn(() => Promise.resolve(createdGrimoire));
    const onCreateNotebook = vi.fn(() => Promise.resolve(createdNotebook));
    const onCreateChapter = vi.fn(() => Promise.resolve(createdChapter));
    const onCreatePage = vi.fn(() => Promise.resolve(createdPage));
    const onDeletePage = vi.fn(() => Promise.resolve());
    const onSavePage = vi.fn(() => Promise.resolve(createdPage));

    render(
      <WorkspaceShell
        tree={{ grimoires: [] }}
        initialState={{
          grimoireId: null,
          notebookId: null,
          chapterId: null,
          pageId: null,
        }}
        onCreateGrimoire={onCreateGrimoire}
        onRenameGrimoire={vi.fn(() => Promise.resolve(createdGrimoire))}
        onRenameNotebook={vi.fn(() => Promise.resolve(renamedNotebook))}
        onRenameChapter={vi.fn(() => Promise.resolve(createdChapter))}
        onCreateNotebook={onCreateNotebook}
        onCreateChapter={onCreateChapter}
        onCreatePage={onCreatePage}
        onMovePage={vi.fn(() =>
          Promise.resolve({
            movedPage: createdPage,
            swappedPage: null,
          }),
        )}
        onDeletePage={onDeletePage}
        onSavePage={onSavePage}
      />,
    );

    fireEvent.change(screen.getByLabelText("Novo grimório"), {
      target: { value: "Novo grimório" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar grimório" }));

    expect(await screen.findByLabelText("Novo caderno")).toBeTruthy();
    expect(onCreateGrimoire).toHaveBeenCalledWith({
      title: "Novo grimório",
    });
    expect(
      screen.getByRole("button", { name: "Novo grimório" }),
    ).toHaveAttribute("aria-current", "true");
    await waitFor(() =>
      expect(window.location.search).toBe("?view=tree&grimoire=g2"),
    );
  });

  test("creates a notebook and selects it", async () => {
    const onCreateGrimoire = vi.fn(() => Promise.resolve(createdGrimoire));
    const onCreateNotebook = vi.fn(() => Promise.resolve(createdNotebook));
    const onCreateChapter = vi.fn(() => Promise.resolve(createdChapter));
    const onCreatePage = vi.fn(() => Promise.resolve(createdPage));
    const onDeletePage = vi.fn(() => Promise.resolve());
    const onSavePage = vi.fn(() => Promise.resolve(createdPage));

    const tree = createTree();
    tree.grimoires[0].notebooks = [];

    render(
      <WorkspaceShell
        tree={tree}
        initialState={{
          grimoireId: "g1",
          notebookId: null,
          chapterId: null,
          pageId: null,
        }}
        onCreateGrimoire={onCreateGrimoire}
        onRenameGrimoire={vi.fn(() => Promise.resolve(createdGrimoire))}
        onRenameNotebook={vi.fn(() => Promise.resolve(renamedNotebook))}
        onRenameChapter={vi.fn(() => Promise.resolve(createdChapter))}
        onCreateNotebook={onCreateNotebook}
        onCreateChapter={onCreateChapter}
        onCreatePage={onCreatePage}
        onMovePage={vi.fn(() =>
          Promise.resolve({
            movedPage: createdPage,
            swappedPage: null,
          }),
        )}
        onDeletePage={onDeletePage}
        onSavePage={onSavePage}
      />,
    );

    fireEvent.change(screen.getByLabelText("Novo caderno"), {
      target: { value: "Novo caderno" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar caderno" }));

    expect(await screen.findByLabelText("Novo capítulo")).toBeTruthy();
    expect(onCreateNotebook).toHaveBeenCalledWith({
      grimoireId: "g1",
      title: "Novo caderno",
    });
    expect(
      screen.getByRole("button", { name: "Novo caderno" }),
    ).toHaveAttribute("aria-current", "true");
    await waitFor(() =>
      expect(window.location.search).toBe("?view=tree&notebook=n2"),
    );
  });

  test("renames the selected notebook and updates its title", async () => {
    const onRenameNotebook = vi.fn(() => Promise.resolve(renamedNotebook));

    render(
      <WorkspaceShell
        tree={createTree()}
        initialState={{
          grimoireId: "g1",
          notebookId: "n1",
          chapterId: null,
          pageId: null,
        }}
        onCreateGrimoire={vi.fn(() => Promise.resolve(createdGrimoire))}
        onRenameGrimoire={vi.fn(() => Promise.resolve(createdGrimoire))}
        onRenameNotebook={onRenameNotebook}
        onRenameChapter={vi.fn(() => Promise.resolve(createdChapter))}
        onCreateNotebook={vi.fn(() => Promise.resolve(createdNotebook))}
        onCreateChapter={vi.fn(() => Promise.resolve(createdChapter))}
        onCreatePage={vi.fn(() => Promise.resolve(createdPage))}
        onMovePage={vi.fn(() =>
          Promise.resolve({
            movedPage: createdPage,
            swappedPage: null,
          }),
        )}
        onDeletePage={vi.fn(() => Promise.resolve())}
        onSavePage={vi.fn(() => Promise.resolve(createdPage))}
      />,
    );

    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Caderno renomeado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar título" }));

    expect(onRenameNotebook).toHaveBeenCalledWith({
      id: "n1",
      title: "Caderno renomeado",
    });
    expect(await screen.findByRole("heading", { name: "Caderno renomeado" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Caderno renomeado" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  test("creates a chapter and selects it", async () => {
    const onCreateGrimoire = vi.fn(() => Promise.resolve(createdGrimoire));
    const onCreateChapter = vi.fn(() => Promise.resolve(createdChapter));
    const onCreatePage = vi.fn(() => Promise.resolve(createdPage));
    const onDeletePage = vi.fn(() => Promise.resolve());
    const onSavePage = vi.fn(() => Promise.resolve(createdPage));

    const tree = createTree();
    tree.grimoires[0]!.notebooks![0]!.chapters = [];

    render(
      <WorkspaceShell
        tree={tree}
        initialState={{
          grimoireId: "g1",
          notebookId: "n1",
          chapterId: null,
          pageId: null,
        }}
        onCreateGrimoire={onCreateGrimoire}
        onRenameGrimoire={vi.fn(() => Promise.resolve(createdGrimoire))}
        onRenameNotebook={vi.fn(() => Promise.resolve(renamedNotebook))}
        onRenameChapter={vi.fn(() => Promise.resolve(createdChapter))}
        onCreateNotebook={vi.fn(() => Promise.resolve(createdNotebook))}
        onCreateChapter={onCreateChapter}
        onCreatePage={onCreatePage}
        onMovePage={vi.fn(() =>
          Promise.resolve({
            movedPage: createdPage,
            swappedPage: null,
          }),
        )}
        onDeletePage={onDeletePage}
        onSavePage={onSavePage}
      />,
    );

    fireEvent.change(screen.getByLabelText("Novo capítulo"), {
      target: { value: "Novo capítulo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar capítulo" }));

    expect(await screen.findByLabelText("Nova página")).toBeTruthy();
    expect(onCreateChapter).toHaveBeenCalledWith({
      notebookId: "n1",
      title: "Novo capítulo",
    });
    expect(screen.getByRole("button", { name: "Novo capítulo" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await waitFor(() =>
      expect(window.location.search).toBe("?view=tree&chapter=c1"),
    );
  });

  test("creates a page and opens it in the editor", async () => {
    const onCreateGrimoire = vi.fn(() => Promise.resolve(createdGrimoire));
    const onCreatePage = vi.fn(() => Promise.resolve(createdPage));
    const onDeletePage = vi.fn(() => Promise.resolve());
    const onSavePage = vi.fn(() => Promise.resolve(createdPage));

    render(
      <WorkspaceShell
        tree={createTree()}
        initialState={{
          grimoireId: "g1",
          notebookId: "n1",
          chapterId: "c1",
          pageId: null,
        }}
        onCreateGrimoire={onCreateGrimoire}
        onRenameGrimoire={vi.fn(() => Promise.resolve(createdGrimoire))}
        onRenameNotebook={vi.fn(() => Promise.resolve(renamedNotebook))}
        onRenameChapter={vi.fn(() => Promise.resolve(createdChapter))}
        onCreateNotebook={vi.fn(() => Promise.resolve(createdNotebook))}
        onCreateChapter={vi.fn(() => Promise.resolve(createdChapter))}
        onCreatePage={onCreatePage}
        onMovePage={vi.fn(() =>
          Promise.resolve({
            movedPage: createdPage,
            swappedPage: null,
          }),
        )}
        onDeletePage={onDeletePage}
        onSavePage={onSavePage}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nova página"), {
      target: { value: "Nova página" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Criar página" }),
    );

    expect(await screen.findByDisplayValue("Nova página")).toBeTruthy();
    expect(onCreatePage).toHaveBeenCalledWith({
      chapterId: "c1",
      title: "Nova página",
    });
    expect(screen.getByRole("button", { name: "Nova página" })).toBeTruthy();
  });


  test("preserves a normalized deep-linked page path and chapter movement context", () => {
    const pageOne: Page = {
      ...createdPage,
      id: "p1",
      title: "Primeira página",
      position: 0,
    };
    const pageTwo: Page = {
      ...createdPage,
      id: "p2",
      title: "Segunda página",
      position: 1,
    };
    const tree = createTree();
    tree.grimoires[0]!.notebooks![0]!.chapters![0]!.pages = [
      pageOne,
      pageTwo,
    ];

    render(
      <WorkspaceShell
        tree={tree}
        initialState={{
          grimoireId: "g1",
          notebookId: "n1",
          chapterId: "c1",
          pageId: "p2",
        }}
        onCreateGrimoire={vi.fn(() => Promise.resolve(createdGrimoire))}
        onRenameGrimoire={vi.fn(() => Promise.resolve(createdGrimoire))}
        onRenameNotebook={vi.fn(() => Promise.resolve(renamedNotebook))}
        onRenameChapter={vi.fn(() => Promise.resolve(createdChapter))}
        onCreateNotebook={vi.fn(() => Promise.resolve(createdNotebook))}
        onCreateChapter={vi.fn(() => Promise.resolve(createdChapter))}
        onCreatePage={vi.fn(() => Promise.resolve(createdPage))}
        onMovePage={vi.fn(() =>
          Promise.resolve({
            movedPage: pageTwo,
            swappedPage: pageOne,
          }),
        )}
        onDeletePage={vi.fn(() => Promise.resolve())}
        onSavePage={vi.fn(() => Promise.resolve(pageTwo))}
      />,
    );

    expect(screen.getByDisplayValue("Segunda página")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Grimório" }))
      .toHaveAttribute("data-active-path", "true");
    expect(screen.getByRole("button", { name: "Caderno" }))
      .toHaveAttribute("data-active-path", "true");
    expect(screen.getByRole("button", { name: "Capítulo" }))
      .toHaveAttribute("data-active-path", "true");
    expect(screen.getByRole("button", { name: "Segunda página" }))
      .toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Mover página para cima" }))
      .not.toBeDisabled();
  });

  test("reflects a saved page title and restores its canonical URL after revalidation", async () => {
    const onSavePage = vi.fn(async () => {
      // Reproduce the URL replacement that Next.js may apply while consuming a
      // server-action revalidation response for the current route.
      window.history.replaceState(window.history.state, "", "/workspace");
      return {
        ...createdPage,
        title: "Página renomeada",
      };
    });
    const tree = createTree();
    tree.grimoires[0]!.notebooks![0]!.chapters![0]!.pages = [createdPage];

    render(
      <WorkspaceShell
        tree={tree}
        initialState={{
          grimoireId: "g1",
          notebookId: "n1",
          chapterId: "c1",
          pageId: "p1",
        }}
        onCreateGrimoire={vi.fn(() => Promise.resolve(createdGrimoire))}
        onRenameGrimoire={vi.fn(() => Promise.resolve(createdGrimoire))}
        onRenameNotebook={vi.fn(() => Promise.resolve(renamedNotebook))}
        onRenameChapter={vi.fn(() => Promise.resolve(createdChapter))}
        onCreateNotebook={vi.fn(() => Promise.resolve(createdNotebook))}
        onCreateChapter={vi.fn(() => Promise.resolve(createdChapter))}
        onCreatePage={vi.fn(() => Promise.resolve(createdPage))}
        onMovePage={vi.fn(() =>
          Promise.resolve({
            movedPage: createdPage,
            swappedPage: null,
          }),
        )}
        onDeletePage={vi.fn(() => Promise.resolve())}
        onSavePage={onSavePage}
      />,
    );

    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Página renomeada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar página" }));

    expect(await screen.findByRole("button", { name: "Página renomeada" })).toBeTruthy();
    await waitFor(() =>
      expect(
        window.location.pathname + window.location.search + window.location.hash,
      ).toBe("/workspace?view=tree&page=p1#current"),
    );
  });

  test("recovers an authorized page URL after a stale server-action revalidation remount", async () => {
    const tree = createTree();
    tree.grimoires[0]!.notebooks![0]!.chapters![0]!.pages = [createdPage];
    window.history.replaceState({}, "", "/workspace?view=tree&page=p1#current");

    render(
      <WorkspaceShell
        tree={tree}
        initialState={{
          grimoireId: null,
          notebookId: null,
          chapterId: null,
          pageId: null,
        }}
        onCreateGrimoire={vi.fn(() => Promise.resolve(createdGrimoire))}
        onRenameGrimoire={vi.fn(() => Promise.resolve(createdGrimoire))}
        onRenameNotebook={vi.fn(() => Promise.resolve(renamedNotebook))}
        onRenameChapter={vi.fn(() => Promise.resolve(createdChapter))}
        onCreateNotebook={vi.fn(() => Promise.resolve(createdNotebook))}
        onCreateChapter={vi.fn(() => Promise.resolve(createdChapter))}
        onCreatePage={vi.fn(() => Promise.resolve(createdPage))}
        onMovePage={vi.fn(() =>
          Promise.resolve({ movedPage: createdPage, swappedPage: null }),
        )}
        onDeletePage={vi.fn(() => Promise.resolve())}
        onSavePage={vi.fn(() => Promise.resolve(createdPage))}
      />,
    );

    await waitFor(() =>
      expect(window.location.pathname + window.location.search + window.location.hash)
        .toBe("/workspace?view=tree&page=p1#current"),
    );
    expect(screen.getByRole("article", { name: "Editor da página" })).toBeInTheDocument();
  });

  test("does not select a page requested by URL unless present in the authorized hierarchy", async () => {
    window.history.replaceState({}, "", "/workspace?view=tree&page=foreign#current");

    render(
      <WorkspaceShell
        tree={createTree()}
        initialState={{
          grimoireId: null,
          notebookId: null,
          chapterId: null,
          pageId: null,
        }}
        onCreateGrimoire={vi.fn(() => Promise.resolve(createdGrimoire))}
        onRenameGrimoire={vi.fn(() => Promise.resolve(createdGrimoire))}
        onRenameNotebook={vi.fn(() => Promise.resolve(renamedNotebook))}
        onRenameChapter={vi.fn(() => Promise.resolve(createdChapter))}
        onCreateNotebook={vi.fn(() => Promise.resolve(createdNotebook))}
        onCreateChapter={vi.fn(() => Promise.resolve(createdChapter))}
        onCreatePage={vi.fn(() => Promise.resolve(createdPage))}
        onMovePage={vi.fn(() =>
          Promise.resolve({ movedPage: createdPage, swappedPage: null }),
        )}
        onDeletePage={vi.fn(() => Promise.resolve())}
        onSavePage={vi.fn(() => Promise.resolve(createdPage))}
      />,
    );

    await waitFor(() =>
      expect(window.location.pathname + window.location.search + window.location.hash)
        .toBe("/workspace?view=tree#current"),
    );
    expect(screen.queryByRole("article", { name: "Editor da página" })).not.toBeInTheDocument();
  });

  test("canonicalizes a normalized initial selection without creating a new history entry", async () => {
    window.history.replaceState(
      { preserved: true },
      "",
      "/workspace?view=tree&page=stale#current",
    );

    render(
      <WorkspaceShell
        tree={createTree()}
        initialState={{
          grimoireId: "g1",
          notebookId: "n1",
          chapterId: "c1",
          pageId: null,
        }}
        onCreateGrimoire={vi.fn(() => Promise.resolve(createdGrimoire))}
        onRenameGrimoire={vi.fn(() => Promise.resolve(createdGrimoire))}
        onRenameNotebook={vi.fn(() => Promise.resolve(renamedNotebook))}
        onRenameChapter={vi.fn(() => Promise.resolve(createdChapter))}
        onCreateNotebook={vi.fn(() => Promise.resolve(createdNotebook))}
        onCreateChapter={vi.fn(() => Promise.resolve(createdChapter))}
        onCreatePage={vi.fn(() => Promise.resolve(createdPage))}
        onMovePage={vi.fn(() =>
          Promise.resolve({ movedPage: createdPage, swappedPage: null }),
        )}
        onDeletePage={vi.fn(() => Promise.resolve())}
        onSavePage={vi.fn(() => Promise.resolve(createdPage))}
      />,
    );

    await waitFor(() =>
      expect(
        window.location.pathname + window.location.search + window.location.hash,
      ).toBe("/workspace?view=tree&chapter=c1#current"),
    );
    expect(window.history.state).toEqual({ preserved: true });
  });

  test("updates the canonical URL as the user moves between hierarchy levels", async () => {
    const pageOne: Page = {
      ...createdPage,
      id: "p1",
      title: "Primeira página",
      position: 0,
    };
    const pageTwo: Page = {
      ...createdPage,
      id: "p2",
      title: "Segunda página",
      position: 1,
    };
    const tree = createTree();
    tree.grimoires[0]!.notebooks![0]!.chapters![0]!.pages = [
      pageOne,
      pageTwo,
    ];

    render(
      <WorkspaceShell
        tree={tree}
        initialState={{
          grimoireId: "g1",
          notebookId: "n1",
          chapterId: "c1",
          pageId: "p1",
        }}
        onCreateGrimoire={vi.fn(() => Promise.resolve(createdGrimoire))}
        onRenameGrimoire={vi.fn(() => Promise.resolve(createdGrimoire))}
        onRenameNotebook={vi.fn(() => Promise.resolve(renamedNotebook))}
        onRenameChapter={vi.fn(() => Promise.resolve(createdChapter))}
        onCreateNotebook={vi.fn(() => Promise.resolve(createdNotebook))}
        onCreateChapter={vi.fn(() => Promise.resolve(createdChapter))}
        onCreatePage={vi.fn(() => Promise.resolve(createdPage))}
        onMovePage={vi.fn(() =>
          Promise.resolve({ movedPage: pageTwo, swappedPage: pageOne }),
        )}
        onDeletePage={vi.fn(() => Promise.resolve())}
        onSavePage={vi.fn(() => Promise.resolve(pageTwo))}
      />,
    );

    await waitFor(() =>
      expect(window.location.search).toBe("?view=tree&page=p1"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Segunda página" }));
    await waitFor(() =>
      expect(window.location.search).toBe("?view=tree&page=p2"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Capítulo" }));
    await waitFor(() =>
      expect(window.location.search).toBe("?view=tree&chapter=c1"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Caderno" }));
    await waitFor(() =>
      expect(window.location.search).toBe("?view=tree&notebook=n1"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Grimório" }));
    await waitFor(() =>
      expect(window.location.search).toBe("?view=tree&grimoire=g1"),
    );
    expect(window.location.hash).toBe("#current");
  });

  test("updates the URL when a newly created page becomes selected and after it is deleted", async () => {
    const onDeletePage = vi.fn(() => Promise.resolve());

    render(
      <WorkspaceShell
        tree={createTree()}
        initialState={{
          grimoireId: "g1",
          notebookId: "n1",
          chapterId: "c1",
          pageId: null,
        }}
        onCreateGrimoire={vi.fn(() => Promise.resolve(createdGrimoire))}
        onRenameGrimoire={vi.fn(() => Promise.resolve(createdGrimoire))}
        onRenameNotebook={vi.fn(() => Promise.resolve(renamedNotebook))}
        onRenameChapter={vi.fn(() => Promise.resolve(createdChapter))}
        onCreateNotebook={vi.fn(() => Promise.resolve(createdNotebook))}
        onCreateChapter={vi.fn(() => Promise.resolve(createdChapter))}
        onCreatePage={vi.fn(() => Promise.resolve(createdPage))}
        onMovePage={vi.fn(() =>
          Promise.resolve({ movedPage: createdPage, swappedPage: null }),
        )}
        onDeletePage={onDeletePage}
        onSavePage={vi.fn(() => Promise.resolve(createdPage))}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nova página"), {
      target: { value: "Nova página" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar página" }));

    expect(await screen.findByDisplayValue("Nova página")).toBeTruthy();
    await waitFor(() =>
      expect(window.location.search).toBe("?view=tree&page=p1"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Excluir página" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar exclusão" }));

    await waitFor(() => expect(onDeletePage).toHaveBeenCalledWith("p1"));
    await waitFor(() =>
      expect(window.location.search).toBe("?view=tree&chapter=c1"),
    );
    expect(screen.getByRole("region", { name: "Área de trabalho" })).toHaveFocus();
    const deletionStatus = screen.getByText("Página excluída. Retorno ao capítulo.");
    expect(deletionStatus.closest('[role="status"]')).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

});
