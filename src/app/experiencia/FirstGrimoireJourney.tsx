"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Clock3, ScrollText, Sparkles } from "lucide-react";
import { QUESTIONS, READING_PAGES, STEP_NAMES } from "./first-grimoire-content";
import {
  FIRST_GRIMOIRE_STORAGE_KEY,
  FIRST_GRIMOIRE_STORE_EVENT,
  MAX_REFLECTION_CHARS,
  allAnswersCorrect,
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
  type Choice,
  type FirstGrimoireSnapshot,
} from "./first-grimoire-model";
import styles from "./FirstGrimoireJourney.module.css";

let inMemoryState: string | null = null;
let readBlocked = false;

function getBrowserState(): string | null {
  // Failed writes leave localStorage readable but stale; prefer the in-memory fallback.
  if (inMemoryState !== null) return inMemoryState;

  try {
    readBlocked = false;
    return window.localStorage.getItem(FIRST_GRIMOIRE_STORAGE_KEY);
  } catch {
    readBlocked = true;
    return inMemoryState;
  }
}

function getServerState(): null {
  return null;
}

function subscribeToJourney(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(FIRST_GRIMOIRE_STORE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(FIRST_GRIMOIRE_STORE_EVENT, listener);
  };
}

export type FirstGrimoireJourneyProps = {
  /** Incremented exclusively when the existing focus timer records a NEW session. */
  focusSignal: number;
  /** Incremented by the existing "Reiniciar demonstração" button. */
  resetSignal: number;
  demoXp: number;
};

export function FirstGrimoireJourney({
  focusSignal,
  resetSignal,
  demoXp,
}: FirstGrimoireJourneyProps) {
  const raw = useSyncExternalStore(subscribeToJourney, getBrowserState, getServerState);
  const snapshot = readFirstGrimoireSnapshot(raw);
  const unlockedStep = getUnlockedStep(snapshot);
  const [requestedStep, setRequestedStep] = useState(0);
  const step = Math.min(requestedStep, unlockedStep);
  const [pageIndex, setPageIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [draftChoice, setDraftChoice] = useState<Choice>(null);
  const [notice, setNotice] = useState("");
  const [storageWarning, setStorageWarning] = useState(false);
  const seenFocusSignal = useRef(focusSignal);
  const seenResetSignal = useRef(resetSignal);

  const persist = useCallback((next: FirstGrimoireSnapshot) => {
    const data = JSON.stringify(next);
    try {
      window.localStorage.setItem(FIRST_GRIMOIRE_STORAGE_KEY, data);
      inMemoryState = null;
      setStorageWarning(false);
    } catch {
      inMemoryState = data;
      setStorageWarning(true);
    }
    window.dispatchEvent(new Event(FIRST_GRIMOIRE_STORE_EVENT));
  }, []);

  useEffect(() => {
    if (seenFocusSignal.current === focusSignal) return;
    seenFocusSignal.current = focusSignal;
    // Read latest state at the moment the parent timer records a session.
    const current = readFirstGrimoireSnapshot(getBrowserState());
    const next = markFirstGrimoireFocus(current);
    if (next !== current) {
      persist(next);
      setNotice("Sessão registrada nesta jornada. A síntese está liberada.");
      setRequestedStep(3);
    }
  }, [focusSignal, persist]);

  useEffect(() => {
    if (seenResetSignal.current === resetSignal) return;
    seenResetSignal.current = resetSignal;
    seenFocusSignal.current = focusSignal;
    persist(newFirstGrimoireSnapshot());
    setRequestedStep(0);
    setPageIndex(0);
    setQuestionIndex(0);
    setDraftChoice(null);
    setNotice("O Primeiro Grimório foi reiniciado junto com a demonstração.");
  }, [resetSignal, focusSignal, persist]);

  const completed = isJourneyComplete(snapshot);
  const correctlyAnswered = QUESTIONS.filter(
    (question, index) => snapshot.answers[index] === question.correct,
  ).length;
  const answeredCount = snapshot.answers.filter((choice) => choice !== null).length;
  const currentQuestion = QUESTIONS[questionIndex];
  const submittedChoice = snapshot.answers[questionIndex];
  const selectedChoice = draftChoice ?? submittedChoice;
  const currentAnswerSubmitted = submittedChoice !== null && selectedChoice === submittedChoice;
  const summarySteps = [
    { label: "Leitura", complete: snapshot.readingCompleted },
    { label: "Três perguntas corretas", complete: allAnswersCorrect(snapshot.answers) },
    { label: "Sessão de foco", complete: snapshot.focusCompleted },
    { label: "Síntese salva", complete: snapshot.reflectionSaved },
    { label: "Primeira Jornada", complete: completed },
  ];

  function startJourney() {
    persist(beginFirstGrimoire(snapshot));
    setPageIndex(0);
    setQuestionIndex(0);
    setDraftChoice(null);
    setRequestedStep(0);
    setNotice("Jornada iniciada. Avance pelas páginas no seu ritmo.");
  }

  function visitPage(index: number) {
    if (index < 0 || index >= READING_PAGES.length) return;
    persist(visitReadingPage(snapshot, index));
    setPageIndex(index);
  }

  function finishReading() {
    const next = completeReading(snapshot);
    if (!next.readingCompleted) return;
    persist(next);
    setQuestionIndex(0);
    setDraftChoice(snapshot.answers[0]);
    setRequestedStep(1);
    setNotice("Leitura concluída. Agora recupere as ideias com três perguntas.");
  }

  function answer(index: number, choice: Choice) {
    const next = answerFirstGrimoireQuestion(snapshot, index, choice);
    if (next === snapshot) return;
    persist(next);
    setNotice("Resposta enviada e registrada somente neste navegador. Você pode revisá-la.");
  }

  function selectQuestion(index: number) {
    if (index < 0 || index >= QUESTIONS.length) return;
    setQuestionIndex(index);
    setDraftChoice(snapshot.answers[index]);
    setNotice("");
  }

  function submitQuestion() {
    if (selectedChoice === null || currentAnswerSubmitted) return;
    answer(questionIndex, selectedChoice);
  }

  function changeReflection(value: string) {
    persist(changeFirstGrimoireReflection(snapshot, value));
    setNotice("");
  }

  function saveReflection() {
    const next = saveFirstGrimoireReflection(snapshot);
    if (next === snapshot) return;
    persist(next);
    setRequestedStep(4);
    setNotice("Síntese registrada localmente. Você pode concluir a jornada.");
  }

  function finishJourney() {
    const next = awardFirstJourney(snapshot);
    if (next === snapshot) return;
    persist(next);
    setNotice("Conquista visual Primeira Jornada registrada! Nenhum XP adicional foi criado.");
  }

  return (
    <section className={styles.journey} aria-labelledby="first-grimoire-title">
      <div className={styles.hero}>
        <p className={styles.eyebrow}><BookOpen size={17} aria-hidden="true" /> Trilha guiada · demonstração pessoal</p>
        <h2 id="first-grimoire-title">Primeiro Grimório <span>— A Arte de Aprender</span></h2>
        <p>Uma jornada de cinco passos: ler, responder, concentrar-se, sintetizar e celebrar o que aprendeu.</p>
        <p className={styles.provisional}>Conteúdo educativo ilustrativo em revisão: os textos e as perguntas ainda precisam ser conferidos com a especificação V1 aprovada.</p>
        <p className={styles.privacy}><ScrollText size={17} aria-hidden="true" />
          Apenas dados sintéticos neste dispositivo; sem conta, banco ou sincronização. Evite escrever informações pessoais ou confidenciais.
        </p>
      </div>

      {(storageWarning || readBlocked) && (
        <p className={styles.warning} role="status">
          O navegador bloqueou o armazenamento local. O progresso desta jornada ficará apenas na memória e poderá ser perdido ao atualizar ou fechar a página.
        </p>
      )}

      <nav aria-label="Etapas do Primeiro Grimório" className={styles.steps}>
        {STEP_NAMES.map((label, index) => (
          <button
            key={label}
            type="button"
            className={index === step ? styles.stepActive : styles.step}
            aria-current={index === step ? "step" : undefined}
            onClick={() => setRequestedStep(index)}
            disabled={!snapshot.started || index > unlockedStep}
          >
            <span className={styles.stepNumber}>{index + 1}</span>
            <span>{label}</span>
            {(index < unlockedStep || (index === 4 && completed)) && <CheckCircle2 size={16} aria-hidden="true" />}
          </button>
        ))}
      </nav>
      <p className={styles.stepSummary} aria-live="polite">
        {snapshot.started ? "Etapa " + (step + 1) + " de 5 · " + STEP_NAMES[step] : "O percurso ainda não começou."}
      </p>

      {!snapshot.started ? (
        <div className={styles.body}>
          <h3>Abra a primeira página</h3>
          <p>Comece quando desejar. Seu progresso da demonstração livre continuará disponível abaixo.</p>
          <button className={styles.primary} type="button" onClick={startJourney}>Iniciar o Primeiro Grimório <ChevronRight size={17} aria-hidden="true" /></button>
        </div>
      ) : null}

      {snapshot.started && step === 0 ? (
        <div className={styles.body}>
          <p className={styles.counter}>Página {pageIndex + 1} de {READING_PAGES.length}</p>
          <h3>{READING_PAGES[pageIndex].title}</h3>
          <p className={styles.reading}>{READING_PAGES[pageIndex].text}</p>
          <p className={styles.hint}>{READING_PAGES[pageIndex].practice}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} disabled={pageIndex === 0}
              onClick={() => visitPage(pageIndex - 1)}><ChevronLeft size={17} aria-hidden="true" /> Página anterior</button>
            {pageIndex < READING_PAGES.length - 1 ? (
              <button type="button" className={styles.primary} onClick={() => visitPage(pageIndex + 1)}>
                Próxima página <ChevronRight size={17} aria-hidden="true" />
              </button>
            ) : (
              <button type="button" className={styles.primary} onClick={finishReading}>
                Concluir leitura <CheckCircle2 size={17} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      ) : null}

      {snapshot.started && step === 1 ? (
        <div className={styles.body}>
          <h3>Três perguntas para recordar</h3>
          <p>Responda uma pergunta por vez e selecione <strong>Enviar resposta</strong> para conferir o feedback. Você pode voltar, revisar e tentar novamente sem punição.</p>
          <p className={styles.counter} aria-live="polite">
            Pergunta {questionIndex + 1} de {QUESTIONS.length} · enviadas {answeredCount} / {QUESTIONS.length} · corretas {correctlyAnswered} / {QUESTIONS.length}
          </p>
          <fieldset className={styles.question}>
            <legend>{questionIndex + 1}. {currentQuestion.prompt}</legend>
            <div className={styles.options}>
              {currentQuestion.choices.map((choice, choiceIndex) => (
                <label key={choice} className={selectedChoice === choiceIndex ? styles.optionSelected : styles.option}>
                  <input
                    type="radio"
                    name="primeiro-grimorio-pergunta-atual"
                    checked={selectedChoice === choiceIndex}
                    onChange={() => {
                      setDraftChoice(choiceIndex as 0 | 1 | 2);
                      setNotice("");
                    }}
                  />
                  <span>{choice}</span>
                </label>
              ))}
            </div>
            {currentAnswerSubmitted && (
              <p className={submittedChoice === currentQuestion.correct ? styles.correct : styles.hint} role="status">
                {submittedChoice === currentQuestion.correct
                  ? "Correto. " + currentQuestion.explanation
                  : "Vamos revisar. " + currentQuestion.retryHint}
              </p>
            )}
          </fieldset>
          {answeredCount === QUESTIONS.length && !allAnswersCorrect(snapshot.answers) && (
            <p className={styles.hint}>As três respostas foram enviadas. Revise as incorretas para liberar a etapa de foco nesta versão demonstrativa.</p>
          )}
          <div className={styles.actions}>
            <button type="button" className={styles.secondary}
              disabled={questionIndex === 0} onClick={() => selectQuestion(questionIndex - 1)}>
              <ChevronLeft size={17} aria-hidden="true" /> Pergunta anterior
            </button>
            <button type="button" className={styles.primary}
              disabled={selectedChoice === null || currentAnswerSubmitted} onClick={submitQuestion}>
              Enviar resposta
            </button>
            {questionIndex < QUESTIONS.length - 1 ? (
              <button type="button" className={styles.secondary} disabled={!currentAnswerSubmitted}
                onClick={() => selectQuestion(questionIndex + 1)}>
                Próxima pergunta <ChevronRight size={17} aria-hidden="true" />
              </button>
            ) : (
              <button type="button" className={styles.secondary}
                disabled={!allAnswersCorrect(snapshot.answers) || !currentAnswerSubmitted}
                onClick={() => setRequestedStep(2)}>
                Continuar para foco <ChevronRight size={17} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => setRequestedStep(0)}>
              <ChevronLeft size={17} aria-hidden="true" /> Revisitar leitura
            </button>
          </div>
        </div>
      ) : null}

      {snapshot.started && step === 2 ? (
        <div className={styles.body}>
          <h3><Clock3 size={22} aria-hidden="true" /> Um momento de concentração</h3>
          <p>Use o cronômetro de cinco minutos da demonstração, logo abaixo. Não criamos um segundo temporizador.</p>
          <p className={styles.hint}>Inicie o foco, deixe o tempo avançar e clique em <strong>Registrar esta sessão</strong>. Até uma sessão breve pode ser registrada. Sessões anteriores ao início desta jornada não contam retroativamente.</p>
          <a href="#demo-focus-title" className={styles.primary}>Ir ao cronômetro existente <ChevronRight size={17} aria-hidden="true" /></a>
          <p className={styles.counter}>A etapa de síntese será liberada após o registro da sessão.</p>
        </div>
      ) : null}

      {snapshot.started && step === 3 ? (
        <div className={styles.body}>
          <h3>Sua síntese de aprendizagem</h3>
          <p>Com suas próprias palavras, escreva uma ideia que ficou clara e uma pergunta que deseja explorar depois.</p>
          <label htmlFor="first-grimoire-reflection" className={styles.fieldLabel}>O que levo desta leitura?</label>
          <textarea id="first-grimoire-reflection" className={styles.reflection}
            value={snapshot.reflection}
            onChange={(event) => changeReflection(event.target.value)}
            maxLength={MAX_REFLECTION_CHARS}
            rows={5}
            placeholder="Ex.: Aprendi que tentar lembrar uma ideia pode ajudar a revisar. Quero praticar isso amanhã."
          />
          <small className={styles.counter}>{snapshot.reflection.length} / {MAX_REFLECTION_CHARS} caracteres. Apenas neste navegador.</small>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => setRequestedStep(2)}>
              <ChevronLeft size={17} aria-hidden="true" /> Voltar ao foco
            </button>
            <button type="button" className={styles.primary} disabled={!snapshot.reflection.trim()} onClick={saveReflection}>
              Salvar síntese localmente <ChevronRight size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      {snapshot.started && step === 4 ? (
        <div className={styles.body}>
          <div className={styles.award}><Sparkles size={28} aria-hidden="true" />
            <h3>{completed ? "Primeira Jornada conquistada!" : "Sua primeira jornada está pronta para conclusão"}</h3>
          </div>
          <p>Você percorreu as páginas, respondeu às três perguntas, registrou uma sessão no cronômetro e salvou sua síntese.</p>
          <p className={styles.hint}>Esta conquista é visual e demonstrativa. Não cria pontos extras nem altera o progresso de uma conta real.</p>
          <p className={styles.xp}>XP existente da demonstração livre: <strong>{demoXp} XP</strong></p>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => setRequestedStep(3)}>
              <ChevronLeft size={17} aria-hidden="true" /> Revisitar síntese
            </button>
            <button type="button" className={styles.primary} onClick={finishJourney} disabled={completed}>
              {completed ? "Conquista registrada" : "Concluir jornada"} <CheckCircle2 size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      <section className={styles.summary} aria-labelledby="first-grimoire-summary-title">
        <h3 id="first-grimoire-summary-title">Resumo da jornada demonstrativa</h3>
        <p>Veja o que foi concluído e o que ainda falta. Este resumo não é histórico de estudante nem registro de conta.</p>
        <ol className={styles.summarySteps}>
          {summarySteps.map((item) => (
            <li key={item.label}>
              <span>{item.label}</span>
              <strong>{item.complete ? "Concluída" : "Pendente"}</strong>
            </li>
          ))}
        </ol>
        <h4>Respostas enviadas ({answeredCount} de {QUESTIONS.length})</h4>
        <ol className={styles.summaryAnswers}>
          {QUESTIONS.map((question, index) => {
            const chosen = snapshot.answers[index];
            return (
              <li key={question.id}>
                <strong>{question.prompt}</strong>
                {chosen === null ? (
                  <p>Pendente: nenhuma resposta enviada.</p>
                ) : (
                  <>
                    <p>Resposta enviada: {question.choices[chosen]} — {chosen === question.correct ? "correta" : "revisar"}.</p>
                    <p>{chosen === question.correct ? question.explanation : question.retryHint}</p>
                  </>
                )}
              </li>
            );
          })}
        </ol>
        <p>XP da demonstração livre: <strong>{demoXp} XP</strong>. A conquista desta jornada é apenas visual e não adiciona pontos.</p>
      </section>

      {notice && <p className={styles.notice} role="status" aria-live="polite">{notice}</p>}
    </section>
  );
}
