import { describe, expect, it } from "vitest";
import { DEMO_STORAGE_KEY } from "./demo-model";
import { QUESTIONS, READING_PAGES } from "./first-grimoire-content";
import {
  FIRST_GRIMOIRE_MAX_BYTES,
  FIRST_GRIMOIRE_STORAGE_KEY,
  MAX_REFLECTION_CHARS,
  allAnswersCorrect,
  allQuestionsAnswered,
  answerFirstGrimoireQuestion,
  awardFirstJourney,
  beginFirstGrimoire,
  changeFirstGrimoireReflection,
  completeReading,
  getUnlockedStep,
  isJourneyComplete,
  markFirstGrimoireFocus,
  newFirstGrimoireSnapshot,
  readFirstGrimoireSnapshot,
  saveFirstGrimoireReflection,
  visitReadingPage,
  type FirstGrimoireSnapshot,
} from "./first-grimoire-model";

/**
 * Testes focais do modelo; nova execução depende de autorização separada.
 * Referência: especificação funcional V1 de 05/11/2026, CA-02, CA-05–08 e CA-11–17.
 * Conteúdo editorial ainda provisório; três respostas enviadas liberam o foco,
 * mesmo com erros, preservando feedback e revisão voluntária.
 */
function finishedReading(): FirstGrimoireSnapshot {
  let state = beginFirstGrimoire(newFirstGrimoireSnapshot());
  for (let page = 1; page < READING_PAGES.length; page += 1) {
    state = visitReadingPage(state, page);
  }
  return completeReading(state);
}

function answeredCorrectly(state: FirstGrimoireSnapshot): FirstGrimoireSnapshot {
  return QUESTIONS.reduce<FirstGrimoireSnapshot>(
    (next, question, index) => answerFirstGrimoireQuestion(next, index, question.correct),
    state,
  );
}

function readyToFinish(): FirstGrimoireSnapshot {
  const focused = markFirstGrimoireFocus(answeredCorrectly(finishedReading()));
  return saveFirstGrimoireReflection(
    changeFirstGrimoireReflection(focused, "Recordar e revisar me ajudam a aprender."),
  );
}

describe("Primeiro Grimório — modelo local isolado (V1)", () => {
  it("inicia sem conquistas e preserva a chave da demo preexistente (CA-02/16)", () => {
    const initial = newFirstGrimoireSnapshot();
    expect(initial).toEqual({
      version: 1,
      started: false,
      readingLastIndex: 0,
      readingCompleted: false,
      answers: [null, null, null],
      focusCompleted: false,
      reflection: "",
      reflectionSaved: false,
      awardGranted: false,
    });
    expect(FIRST_GRIMOIRE_STORAGE_KEY).not.toBe(DEMO_STORAGE_KEY);
    expect(getUnlockedStep(initial)).toBe(0);
    expect(isJourneyComplete(initial)).toBe(false);
  });

  it("contém três questões e páginas de leitura sem depender de conta (CA-04/06)", () => {
    expect(READING_PAGES.length).toBeGreaterThanOrEqual(2);
    expect(QUESTIONS).toHaveLength(3);
    expect(new Set(QUESTIONS.map((question) => question.id)).size).toBe(3);
    for (const question of QUESTIONS) {
      expect(question.choices).toHaveLength(3);
      expect(question.prompt.trim().length).toBeGreaterThan(0);
      expect(question.explanation.trim().length).toBeGreaterThan(0);
      expect(question.retryHint.trim().length).toBeGreaterThan(0);
    }
  });

  it("não libera leitura antes de começar nem antes da última página (CA-05)", () => {
    const initial = newFirstGrimoireSnapshot();
    expect(visitReadingPage(initial, READING_PAGES.length - 1)).toBe(initial);
    expect(completeReading(initial)).toBe(initial);
    const started = beginFirstGrimoire(initial);
    expect(completeReading(started)).toBe(started);
    expect(visitReadingPage(started, -1)).toBe(started);
    expect(visitReadingPage(started, READING_PAGES.length)).toBe(started);
    const finished = finishedReading();
    expect(finished.readingLastIndex).toBe(READING_PAGES.length - 1);
    expect(finished.readingCompleted).toBe(true);
    expect(getUnlockedStep(finished)).toBe(1);
    expect(completeReading(finished)).toBe(finished);
  });

  it("mantém respostas incompletas sem liberar foco e permite correção (CA-06–08)", () => {
    const reading = finishedReading();
    expect(allAnswersCorrect(reading.answers)).toBe(false);
    expect(markFirstGrimoireFocus(reading)).toBe(reading);
    const wrongChoice = ((QUESTIONS[0].correct + 1) % 3) as 0 | 1 | 2;
    const wrong = answerFirstGrimoireQuestion(reading, 0, wrongChoice);
    expect(wrong.answers[0]).toBe(wrongChoice);
    expect(getUnlockedStep(wrong)).toBe(1);
    expect(answerFirstGrimoireQuestion(wrong, 0, wrongChoice)).toBe(wrong);
    expect(answerFirstGrimoireQuestion(wrong, -1, 0)).toBe(wrong);
    expect(answerFirstGrimoireQuestion(wrong, 3, 0)).toBe(wrong);
    expect(answerFirstGrimoireQuestion(wrong, 1, 99 as 0)).toBe(wrong);
    const corrected = answeredCorrectly(wrong);
    expect(allAnswersCorrect(corrected.answers)).toBe(true);
    expect(getUnlockedStep(corrected)).toBe(2);
    expect(isJourneyComplete(corrected)).toBe(false);
  });

  it("libera foco com três respostas enviadas mesmo com erro, inclusive após recarga (CA-06–08/10/14)", () => {
    let answered = finishedReading();
    const wrongChoice = ((QUESTIONS[0].correct + 1) % 3) as 0 | 1 | 2;
    answered = answerFirstGrimoireQuestion(answered, 0, wrongChoice);
    expect(allQuestionsAnswered(answered.answers)).toBe(false);
    expect(getUnlockedStep(answered)).toBe(1);

    for (let index = 1; index < QUESTIONS.length; index += 1) {
      answered = answerFirstGrimoireQuestion(answered, index, QUESTIONS[index].correct);
    }
    expect(allQuestionsAnswered(answered.answers)).toBe(true);
    expect(allAnswersCorrect(answered.answers)).toBe(false);
    expect(getUnlockedStep(answered)).toBe(2);

    const focused = markFirstGrimoireFocus(answered);
    expect(focused.focusCompleted).toBe(true);
    expect(getUnlockedStep(focused)).toBe(3);
    const restored = readFirstGrimoireSnapshot(JSON.stringify(focused));
    expect(restored.focusCompleted).toBe(true);
    expect(getUnlockedStep(restored)).toBe(3);

    const reflected = saveFirstGrimoireReflection(
      changeFirstGrimoireReflection(restored, "Uma síntese pessoal."),
    );
    const awarded = awardFirstJourney(reflected);
    expect(isJourneyComplete(awarded)).toBe(true);
    expect(awardFirstJourney(awarded)).toBe(awarded);
  });

  it("só registra foco após prática e não o duplica (CA-09/10/14)", () => {
    const unanswered = finishedReading();
    expect(markFirstGrimoireFocus(unanswered)).toBe(unanswered);
    const answered = answeredCorrectly(unanswered);
    const focused = markFirstGrimoireFocus(answered);
    expect(focused.focusCompleted).toBe(true);
    expect(getUnlockedStep(focused)).toBe(3);
    expect(markFirstGrimoireFocus(focused)).toBe(focused);
    expect(awardFirstJourney(focused)).toBe(focused);
  });

  it("recusa síntese vazia e limita o texto a 500 caracteres (CA-11/14)", () => {
    const focused = markFirstGrimoireFocus(answeredCorrectly(finishedReading()));
    expect(saveFirstGrimoireReflection(focused)).toBe(focused);
    const blanks = changeFirstGrimoireReflection(focused, "   ");
    expect(saveFirstGrimoireReflection(blanks)).toBe(blanks);
    const entered = changeFirstGrimoireReflection(focused, "a".repeat(MAX_REFLECTION_CHARS + 20));
    expect(entered.reflection).toHaveLength(MAX_REFLECTION_CHARS);
    expect(entered.reflectionSaved).toBe(false);
    const saved = saveFirstGrimoireReflection(entered);
    expect(saved.reflectionSaved).toBe(true);
    expect(getUnlockedStep(saved)).toBe(4);
  });

  it("só concede a conquista uma vez após todas as etapas (CA-08/14/16)", () => {
    const ready = readyToFinish();
    expect(ready.awardGranted).toBe(false);
    expect(isJourneyComplete(ready)).toBe(false);
    const awarded = awardFirstJourney(ready);
    expect(awarded.awardGranted).toBe(true);
    expect(isJourneyComplete(awarded)).toBe(true);
    expect(awardFirstJourney(awarded)).toBe(awarded);
  });

  it("editar a síntese revoga a confirmação e a conquista anterior (CA-11/16)", () => {
    const awarded = awardFirstJourney(readyToFinish());
    const changed = changeFirstGrimoireReflection(awarded, "Nova explicação.");
    expect(changed.reflectionSaved).toBe(false);
    expect(changed.awardGranted).toBe(false);
    expect(isJourneyComplete(changed)).toBe(false);
    expect(getUnlockedStep(changed)).toBe(3);
  });

  it("restaura progresso válido e mantém a conquista sem duplicá-la (CA-08/12/16)", () => {
    const awarded = awardFirstJourney(readyToFinish());
    const restored = readFirstGrimoireSnapshot(JSON.stringify(awarded));
    expect(restored).toEqual(awarded);
    expect(awardFirstJourney(restored)).toBe(restored);
    expect(isJourneyComplete(restored)).toBe(true);
  });

  it("rejeita JSON inválido, versão estranha e escolhas malformadas (CA-13)", () => {
    const initial = newFirstGrimoireSnapshot();
    expect(readFirstGrimoireSnapshot(null)).toEqual(initial);
    expect(readFirstGrimoireSnapshot("{não é JSON")).toEqual(initial);
    expect(readFirstGrimoireSnapshot("[]")).toEqual(initial);
    expect(readFirstGrimoireSnapshot(JSON.stringify({ ...initial, version: 2 }))).toEqual(initial);
    expect(readFirstGrimoireSnapshot(JSON.stringify({ ...initial, answers: [0, 1] }))).toEqual(initial);
    expect(readFirstGrimoireSnapshot(JSON.stringify({ ...initial, answers: [0, 1, 9] }))).toEqual(initial);
    expect(readFirstGrimoireSnapshot(JSON.stringify({ ...initial, readingLastIndex: 999 }))).toEqual(initial);
  });

  it("impõe limite por bytes UTF-8, mesmo com comprimento menor (CA-13)", () => {
    const raw = JSON.stringify({
      ...finishedReading(),
      campoDesconhecido: "🌿".repeat(2300),
    });
    expect(raw.length).toBeLessThan(FIRST_GRIMOIRE_MAX_BYTES);
    expect(new TextEncoder().encode(raw).byteLength).toBeGreaterThan(FIRST_GRIMOIRE_MAX_BYTES);
    expect(readFirstGrimoireSnapshot(raw)).toEqual(newFirstGrimoireSnapshot());
  });

  it("não confia em conclusão ou foco fabricados no armazenamento (CA-13/14)", () => {
    const forged = {
      ...newFirstGrimoireSnapshot(),
      started: true,
      readingCompleted: true,
      readingLastIndex: 0,
      answers: QUESTIONS.map((question) => question.correct),
      focusCompleted: true,
      reflection: "Síntese inexistente",
      reflectionSaved: true,
      awardGranted: true,
    };
    const restored = readFirstGrimoireSnapshot(JSON.stringify(forged));
    expect(restored.readingCompleted).toBe(false);
    expect(restored.focusCompleted).toBe(false);
    expect(restored.reflectionSaved).toBe(false);
    expect(restored.awardGranted).toBe(false);
    expect(isJourneyComplete(restored)).toBe(false);
  });

  it("permite voltar ao estado inicial sem alterar o modelo da demo antiga (CA-17)", () => {
    const awarded = awardFirstJourney(readyToFinish());
    expect(isJourneyComplete(awarded)).toBe(true);
    const reset = newFirstGrimoireSnapshot();
    expect(reset).toEqual(readFirstGrimoireSnapshot(null));
    expect(reset).not.toBe(awarded);
    expect(FIRST_GRIMOIRE_STORAGE_KEY).not.toBe(DEMO_STORAGE_KEY);
  });
});
