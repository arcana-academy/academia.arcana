import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArcanaExperience } from "./ArcanaExperience";
import { DEMO_STORAGE_KEY, readDemoSnapshot } from "./demo-model";
import { QUESTIONS, READING_PAGES } from "./first-grimoire-content";
import { FirstGrimoireJourney } from "./FirstGrimoireJourney";
import {
  FIRST_GRIMOIRE_STORAGE_KEY,
  newFirstGrimoireSnapshot,
  readFirstGrimoireSnapshot,
} from "./first-grimoire-model";

/**
 * Testes de UI preparados, NÃO executados.
 * Especificação V1: CA-01–03, 05–08, 09–17 (cobertura focal, não homologação).
 * Acessibilidade assistiva, mobile e segurança de rede exigem verificações separadas.
 */
beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

function advanceToQuestions() {
  fireEvent.click(screen.getByRole("button", { name: /Iniciar o Primeiro Grimório/ }));
  for (let page = 1; page < READING_PAGES.length; page += 1) {
    fireEvent.click(screen.getByRole("button", { name: /Próxima página/ }));
  }
  fireEvent.click(screen.getByRole("button", { name: /Concluir leitura/ }));
}

function sendAnswer(index: number, choice: 0 | 1 | 2) {
  expect(screen.getByText(new RegExp("Pergunta " + (index + 1) + " de 3"))).toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: QUESTIONS[index].choices[choice] }));
  fireEvent.click(screen.getByRole("button", { name: "Enviar resposta" }));
}

function submitCorrectAnswers() {
  QUESTIONS.forEach((question, index) => {
    sendAnswer(index, question.correct);
    if (index < QUESTIONS.length - 1) {
      fireEvent.click(screen.getByRole("button", { name: /Próxima pergunta/ }));
    }
  });
}

function readStoredJourney() {
  return readFirstGrimoireSnapshot(window.localStorage.getItem(FIRST_GRIMOIRE_STORAGE_KEY));
}

function recoverStorageAfterFailure(view: ReturnType<typeof render>) {
  vi.restoreAllMocks();
  // A successful reset write also clears the module-level memory fallback between tests.
  view.rerender(<FirstGrimoireJourney focusSignal={0} resetSignal={1} demoXp={0} />);
}

describe("Primeiro Grimório — jornada demonstrativa (V1)", () => {
  it("informa caráter local, apresenta etapas e mantém começo protegido (CA-01/03/15)", () => {
    render(<FirstGrimoireJourney focusSignal={0} resetSignal={0} demoXp={0} />);
    expect(screen.getByRole("heading", { name: /Primeiro Grimório/ })).toBeInTheDocument();
    expect(screen.getByText(/Apenas dados sintéticos neste dispositivo/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Três perguntas/ })).toBeDisabled();
    expect(screen.getByRole("heading", { name: "Resumo da jornada demonstrativa" })).toBeInTheDocument();
    expect(screen.getByText(/não é histórico de estudante/)).toBeInTheDocument();
    expect(readStoredJourney()).toEqual(newFirstGrimoireSnapshot());
  });

  it("navega e revisita páginas sem concluir prematuramente (CA-04/05)", () => {
    render(<FirstGrimoireJourney focusSignal={0} resetSignal={0} demoXp={0} />);
    fireEvent.click(screen.getByRole("button", { name: /Iniciar o Primeiro Grimório/ }));
    expect(screen.getByText("Página 1 de " + READING_PAGES.length)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Concluir leitura/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Próxima página/ }));
    expect(screen.getByText("Página 2 de " + READING_PAGES.length)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Página anterior/ }));
    expect(screen.getByText("Página 1 de " + READING_PAGES.length)).toBeInTheDocument();
    expect(readStoredJourney().readingCompleted).toBe(false);
    for (let page = 1; page < READING_PAGES.length; page += 1) {
      fireEvent.click(screen.getByRole("button", { name: /Próxima página/ }));
    }
    fireEvent.click(screen.getByRole("button", { name: /Concluir leitura/ }));
    expect(readStoredJourney().readingCompleted).toBe(true);
    expect(screen.getByRole("heading", { name: "Três perguntas para recordar" })).toBeInTheDocument();
  });

  it("separa seleção de envio e oferece feedback de erro e correção (CA-06–08/15)", () => {
    render(<FirstGrimoireJourney focusSignal={0} resetSignal={0} demoXp={0} />);
    advanceToQuestions();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Enviar resposta" })).toBeDisabled();
    const question = QUESTIONS[0];
    const incorrect = ((question.correct + 1) % 3) as 0 | 1 | 2;
    fireEvent.click(screen.getByRole("radio", { name: question.choices[incorrect] }));
    expect(screen.queryByText(/Vamos revisar\./)).not.toBeInTheDocument();
    expect(readStoredJourney().answers[0]).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Enviar resposta" }));
    expect(screen.getByText(/Vamos revisar\./)).toBeInTheDocument();
    expect(readStoredJourney().answers[0]).toBe(incorrect);
    expect(screen.getByRole("button", { name: "Enviar resposta" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: question.choices[question.correct] }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar resposta" }));
    expect(screen.getByText(/Correto\./)).toBeInTheDocument();
    expect(readStoredJourney().answers[0]).toBe(question.correct);
    expect(screen.getByRole("button", { name: /Próxima pergunta/ })).toBeEnabled();
    expect(readStoredJourney().awardGranted).toBe(false);
  });

  it("libera foco com três respostas mesmo quando uma está incorreta (CA-06–08/10/14)", () => {
    const view = render(<FirstGrimoireJourney focusSignal={0} resetSignal={0} demoXp={0} />);
    advanceToQuestions();
    const wrongChoice = ((QUESTIONS[0].correct + 1) % 3) as 0 | 1 | 2;
    sendAnswer(0, wrongChoice);
    for (let index = 1; index < QUESTIONS.length; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: /Próxima pergunta/ }));
      sendAnswer(index, QUESTIONS[index].correct);
    }
    expect(screen.getByText(/Você já pode seguir para o foco/)).toBeInTheDocument();
    const proceed = screen.getByRole("button", { name: /Continuar para foco/ });
    expect(proceed).toBeEnabled();
    fireEvent.click(proceed);
    expect(screen.getByRole("heading", { name: "Um momento de concentração" })).toBeInTheDocument();

    view.rerender(<FirstGrimoireJourney focusSignal={1} resetSignal={0} demoXp={0} />);
    expect(readStoredJourney().answers[0]).toBe(wrongChoice);
    expect(readStoredJourney().focusCompleted).toBe(true);
    expect(screen.getByRole("textbox", { name: "O que levo desta leitura?" })).toBeInTheDocument();
  });

  it("respeita sinal de foco, salva síntese, conquista e reset local (CA-10–17)", () => {
    const originalDemo = JSON.stringify({ missions: [], focusSessions: 2 });
    window.localStorage.setItem(DEMO_STORAGE_KEY, originalDemo);
    const view = render(<FirstGrimoireJourney focusSignal={0} resetSignal={0} demoXp={40} />);
    view.rerender(<FirstGrimoireJourney focusSignal={1} resetSignal={0} demoXp={40} />);
    expect(readStoredJourney().focusCompleted).toBe(false);
    advanceToQuestions();
    submitCorrectAnswers();
    expect(screen.getByRole("button", { name: /Continuar para foco/ })).toBeEnabled();
    view.rerender(<FirstGrimoireJourney focusSignal={2} resetSignal={0} demoXp={40} />);
    expect(readStoredJourney().focusCompleted).toBe(true);
    expect(screen.getByRole("textbox", { name: "O que levo desta leitura?" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "O que levo desta leitura?" }), {
      target: { value: "Recordar é diferente de reler." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Salvar síntese localmente/ }));
    expect(readStoredJourney().reflectionSaved).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Concluir jornada/ }));
    expect(readStoredJourney().awardGranted).toBe(true);
    expect(screen.getByRole("heading", { name: "Primeira Jornada conquistada!" })).toBeInTheDocument();
    expect(screen.getByText(/não adiciona pontos/)).toBeInTheDocument();
    expect(window.localStorage.getItem(DEMO_STORAGE_KEY)).toBe(originalDemo);

    view.rerender(<FirstGrimoireJourney focusSignal={2} resetSignal={1} demoXp={40} />);
    expect(readStoredJourney()).toEqual(newFirstGrimoireSnapshot());
    expect(window.localStorage.getItem(DEMO_STORAGE_KEY)).toBe(originalDemo);
    expect(screen.getByText("O percurso ainda não começou.")).toBeInTheDocument();
  });

  it("recupera respostas locais após desmontar e montar novamente (CA-08/12/15)", () => {
    const view = render(<FirstGrimoireJourney focusSignal={0} resetSignal={0} demoXp={0} />);
    advanceToQuestions();
    sendAnswer(0, QUESTIONS[0].correct);
    view.unmount();
    render(<FirstGrimoireJourney focusSignal={0} resetSignal={0} demoXp={0} />);
    expect(readStoredJourney().answers[0]).toBe(QUESTIONS[0].correct);
    expect(screen.getByRole("heading", { name: /Respostas enviadas \(1 de 3\)/ })).toBeInTheDocument();
    expect(screen.getAllByText(/Pendente: nenhuma resposta enviada/)).toHaveLength(2);
  });

  it("rejeita estado corrompido sem travar a interface (CA-13 parcial)", () => {
    window.localStorage.setItem(FIRST_GRIMOIRE_STORAGE_KEY, "{json corrompido");
    render(<FirstGrimoireJourney focusSignal={0} resetSignal={0} demoXp={0} />);
    expect(screen.getByRole("button", { name: /Iniciar o Primeiro Grimório/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Iniciar o Primeiro Grimório/ }));
    expect(readStoredJourney().started).toBe(true);
  });

  it("mantém progresso em memória quando a escrita falha mas a leitura funciona (CA-13)", () => {
    const storedBeforeFailure = JSON.stringify(newFirstGrimoireSnapshot());
    window.localStorage.setItem(FIRST_GRIMOIRE_STORAGE_KEY, storedBeforeFailure);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Gravação indisponível");
    });
    const view = render(<FirstGrimoireJourney focusSignal={0} resetSignal={0} demoXp={0} />);
    try {
      fireEvent.click(screen.getByRole("button", { name: /Iniciar o Primeiro Grimório/ }));
      expect(screen.getByText("Página 1 de " + READING_PAGES.length)).toBeInTheDocument();
      expect(screen.getByText(/O navegador bloqueou o armazenamento local/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /Próxima página/ }));
      expect(screen.getByText("Página 2 de " + READING_PAGES.length)).toBeInTheDocument();
      expect(window.localStorage.getItem(FIRST_GRIMOIRE_STORAGE_KEY)).toBe(storedBeforeFailure);

      vi.restoreAllMocks();
      fireEvent.click(screen.getByRole("button", { name: /Próxima página/ }));
      expect(screen.getByText("Página " + READING_PAGES.length + " de " + READING_PAGES.length)).toBeInTheDocument();
      expect(readStoredJourney().started).toBe(true);
      expect(readStoredJourney().readingLastIndex).toBe(READING_PAGES.length - 1);
      expect(screen.queryByText(/O navegador bloqueou o armazenamento local/)).not.toBeInTheDocument();
    } finally {
      recoverStorageAfterFailure(view);
    }
  });

  it("avisa quando leitura e escrita no armazenamento estão bloqueadas (CA-13)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Armazenamento indisponível");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Armazenamento indisponível");
    });
    const view = render(<FirstGrimoireJourney focusSignal={0} resetSignal={0} demoXp={0} />);
    try {
      expect(screen.getByText(/O navegador bloqueou o armazenamento local/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /Iniciar o Primeiro Grimório/ }));
      expect(screen.getByText("Página 1 de " + READING_PAGES.length)).toBeInTheDocument();
    } finally {
      recoverStorageAfterFailure(view);
    }
  });

  it("integra a sessão curta do temporizador existente, sem exigir cinco minutos (CA-02/09/10)", () => {
    vi.useFakeTimers();
    render(<ArcanaExperience />);
    advanceToQuestions();
    submitCorrectAnswers();
    expect(screen.getByRole("button", { name: "Registrar esta sessão" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Começar foco" }));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("timer")).toHaveTextContent("04:59");
    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
    fireEvent.click(screen.getByRole("button", { name: "Registrar esta sessão" }));
    const demo = readDemoSnapshot(window.localStorage.getItem(DEMO_STORAGE_KEY));
    expect(demo.focusSessions).toBe(1);
    expect(readStoredJourney().focusCompleted).toBe(true);
    expect(screen.getByRole("textbox", { name: "O que levo desta leitura?" })).toBeInTheDocument();
  });
});
