import { QUESTIONS, READING_PAGES } from "./first-grimoire-content";

export const FIRST_GRIMOIRE_STORAGE_KEY = "academia-arcana-primeiro-grimorio-v1";
export const FIRST_GRIMOIRE_STORE_EVENT = "academia-arcana-primeiro-grimorio-atualizado";
export const FIRST_GRIMOIRE_MAX_BYTES = 8192;
export const MAX_REFLECTION_CHARS = 500;

export type Choice = 0 | 1 | 2 | null;
export type JourneyAnswers = [Choice, Choice, Choice];

export type FirstGrimoireSnapshot = {
  version: 1;
  started: boolean;
  readingLastIndex: number;
  readingCompleted: boolean;
  answers: JourneyAnswers;
  focusCompleted: boolean;
  reflection: string;
  reflectionSaved: boolean;
  awardGranted: boolean;
};

export function newFirstGrimoireSnapshot(): FirstGrimoireSnapshot {
  return {
    version: 1,
    started: false,
    readingLastIndex: 0,
    readingCompleted: false,
    answers: [null, null, null],
    focusCompleted: false,
    reflection: "",
    reflectionSaved: false,
    awardGranted: false,
  };
}

function validChoice(value: unknown): value is Choice {
  return value === null || value === 0 || value === 1 || value === 2;
}

export function allQuestionsAnswered(answers: JourneyAnswers): boolean {
  return answers.length === QUESTIONS.length && answers.every((choice) => choice !== null);
}

export function allAnswersCorrect(answers: JourneyAnswers): boolean {
  return QUESTIONS.every((question, index) => answers[index] === question.correct);
}

export function getUnlockedStep(snapshot: FirstGrimoireSnapshot): 0 | 1 | 2 | 3 | 4 {
  if (!snapshot.started || !snapshot.readingCompleted) return 0;
  if (!allQuestionsAnswered(snapshot.answers)) return 1;
  if (!snapshot.focusCompleted) return 2;
  if (!snapshot.reflectionSaved || !snapshot.reflection.trim()) return 3;
  return 4;
}

export function isJourneyComplete(snapshot: FirstGrimoireSnapshot): boolean {
  return snapshot.awardGranted && getUnlockedStep(snapshot) === 4;
}

/** Browser storage is untrusted and may be manually edited or corrupted. */
export function readFirstGrimoireSnapshot(raw: string | null): FirstGrimoireSnapshot {
  const initial = newFirstGrimoireSnapshot();
  if (!raw || raw.length > FIRST_GRIMOIRE_MAX_BYTES ||
      new TextEncoder().encode(raw).byteLength > FIRST_GRIMOIRE_MAX_BYTES) return initial;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return initial;
    const obj = value as Record<string, unknown>;
    if (obj.version !== 1 ||
        typeof obj.started !== "boolean" ||
        !Number.isSafeInteger(obj.readingLastIndex) ||
        (obj.readingLastIndex as number) < 0 ||
        (obj.readingLastIndex as number) >= READING_PAGES.length ||
        typeof obj.readingCompleted !== "boolean" ||
        !Array.isArray(obj.answers) || obj.answers.length !== 3 ||
        !obj.answers.every(validChoice) ||
        typeof obj.focusCompleted !== "boolean" ||
        typeof obj.reflection !== "string" ||
        obj.reflection.length > MAX_REFLECTION_CHARS ||
        typeof obj.reflectionSaved !== "boolean" ||
        typeof obj.awardGranted !== "boolean") return initial;

    const answers = [obj.answers[0], obj.answers[1], obj.answers[2]] as JourneyAnswers;
    const started = obj.started as boolean;
    const readingLastIndex = obj.readingLastIndex as number;
    const readingCompleted = started && obj.readingCompleted === true &&
      readingLastIndex === READING_PAGES.length - 1;
    const focusCompleted = readingCompleted && allQuestionsAnswered(answers) && obj.focusCompleted === true;
    const reflection = (obj.reflection as string).slice(0, MAX_REFLECTION_CHARS);
    const reflectionSaved = focusCompleted && reflection.trim().length > 0 && obj.reflectionSaved === true;
    const awardGranted = reflectionSaved && obj.awardGranted === true;

    return {
      version: 1,
      started,
      readingLastIndex: started ? readingLastIndex : 0,
      readingCompleted,
      answers: readingCompleted ? answers : [null, null, null],
      focusCompleted,
      reflection,
      reflectionSaved,
      awardGranted,
    };
  } catch {
    return initial;
  }
}

export function beginFirstGrimoire(snapshot: FirstGrimoireSnapshot): FirstGrimoireSnapshot {
  return snapshot.started ? snapshot : { ...snapshot, started: true };
}

export function visitReadingPage(
  snapshot: FirstGrimoireSnapshot,
  pageIndex: number,
): FirstGrimoireSnapshot {
  if (!snapshot.started || !Number.isSafeInteger(pageIndex) ||
      pageIndex < 0 || pageIndex >= READING_PAGES.length) return snapshot;
  const next = Math.max(snapshot.readingLastIndex, pageIndex);
  return next === snapshot.readingLastIndex ? snapshot : { ...snapshot, readingLastIndex: next };
}

export function completeReading(snapshot: FirstGrimoireSnapshot): FirstGrimoireSnapshot {
  if (!snapshot.started || snapshot.readingLastIndex !== READING_PAGES.length - 1 ||
      snapshot.readingCompleted) return snapshot;
  return { ...snapshot, readingCompleted: true };
}

export function answerFirstGrimoireQuestion(
  snapshot: FirstGrimoireSnapshot,
  index: number,
  value: Choice,
): FirstGrimoireSnapshot {
  if (!snapshot.readingCompleted || !Number.isSafeInteger(index) ||
      index < 0 || index >= QUESTIONS.length || !validChoice(value)) return snapshot;
  if (snapshot.answers[index] === value) return snapshot;
  const answers = [...snapshot.answers] as JourneyAnswers;
  answers[index] = value;
  return { ...snapshot, answers, awardGranted: false };
}

/** Only a newly recorded session in the shared timer may unlock this step. */
export function markFirstGrimoireFocus(snapshot: FirstGrimoireSnapshot): FirstGrimoireSnapshot {
  if (getUnlockedStep(snapshot) < 2 || snapshot.focusCompleted) return snapshot;
  return { ...snapshot, focusCompleted: true };
}

export function changeFirstGrimoireReflection(
  snapshot: FirstGrimoireSnapshot,
  text: string,
): FirstGrimoireSnapshot {
  if (getUnlockedStep(snapshot) < 3 || typeof text !== "string") return snapshot;
  const reflection = text.slice(0, MAX_REFLECTION_CHARS);
  return reflection === snapshot.reflection
    ? snapshot
    : { ...snapshot, reflection, reflectionSaved: false, awardGranted: false };
}

export function saveFirstGrimoireReflection(snapshot: FirstGrimoireSnapshot): FirstGrimoireSnapshot {
  if (getUnlockedStep(snapshot) < 3 || !snapshot.reflection.trim() || snapshot.reflectionSaved) {
    return snapshot;
  }
  return { ...snapshot, reflectionSaved: true };
}

export function awardFirstJourney(snapshot: FirstGrimoireSnapshot): FirstGrimoireSnapshot {
  if (getUnlockedStep(snapshot) !== 4 || snapshot.awardGranted) return snapshot;
  return { ...snapshot, awardGranted: true };
}
