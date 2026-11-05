"use client";

import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Check, Clock3, Pause, Play, RotateCcw, ScrollText, Sparkles } from "lucide-react";

import {
  DEMO_STORAGE_KEY,
  INITIAL_MISSIONS,
  addDemoMission,
  getDemoProgress,
  readDemoSnapshot,
  toggleDemoMission,
  type DemoMission,
} from "./demo-model";
import { FirstGrimoireJourney } from "./FirstGrimoireJourney";
import styles from "./ArcanaExperience.module.css";

const FOCUS_DURATION = 5 * 60;
const STORE_EVENT = "academia-arcana-demo-state-updated";
let fallbackInMemory: string | null = null;

function subscribeToDemoStore(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(STORE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(STORE_EVENT, onChange);
  };
}

function getBrowserDemoSnapshot(): string | null {
  try {
    return window.localStorage.getItem(DEMO_STORAGE_KEY);
  } catch {
    return fallbackInMemory;
  }
}

function getServerDemoSnapshot(): null {
  return null;
}

function writeDemoSnapshot(missions: DemoMission[], focusSessions: number) {
  const raw = JSON.stringify({ missions, focusSessions });
  try {
    window.localStorage.setItem(DEMO_STORAGE_KEY, raw);
  } catch {
    fallbackInMemory = raw;
  }
  window.dispatchEvent(new Event(STORE_EVENT));
}


function timeLabel(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
}

/**
 * Safe, public, synthetic experience. No database, session, external API or
 * privileged server action is reachable from this component.
 */
export function ArcanaExperience() {
  const storedRaw = useSyncExternalStore(subscribeToDemoStore, getBrowserDemoSnapshot, getServerDemoSnapshot);
  const { missions, focusSessions } = readDemoSnapshot(storedRaw);
  const [title, setTitle] = useState("");
  const [seconds, setSeconds] = useState(FOCUS_DURATION);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState("");
  const [firstGrimoireFocusSignal, setFirstGrimoireFocusSignal] = useState(0);
  const [firstGrimoireResetSignal, setFirstGrimoireResetSignal] = useState(0);

  useEffect(() => {
    if (!running || seconds === 0) return;
    const timer = window.setTimeout(() => setSeconds((left) => Math.max(left - 1, 0)), 1000);
    return () => window.clearTimeout(timer);
  }, [running, seconds]);

  const progress = getDemoProgress(missions, focusSessions);
  const allDone = progress.total > 0 && progress.completed === progress.total;

  function createMission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let sequence = 1;
    while (missions.some((mission) => mission.id === "custom-" + sequence)) sequence += 1;
    const id = "custom-" + sequence;
    const next = addDemoMission(missions, title, id);
    if (next === missions) return;
    writeDemoSnapshot(next, focusSessions);
    setTitle("");
    setNotice("Missão adicionada ao seu Grimório de demonstração.");
  }

  function toggleMission(id: string) {
    const selected = missions.find((mission) => mission.id === id);
    writeDemoSnapshot(toggleDemoMission(missions, id), focusSessions);
    setNotice(selected?.done ? "Missão reaberta. Você pode retomar no seu ritmo." : "Missão concluída! Seu progresso foi atualizado.");
  }

  function recordFocus() {
    if (seconds === FOCUS_DURATION) return;
    writeDemoSnapshot(missions, focusSessions + 1);
    // A new session registered in the existing timer signals the guided journey.
    setFirstGrimoireFocusSignal((signal) => signal + 1);
    setRunning(false);
    setSeconds(FOCUS_DURATION);
    setNotice("Sessão registrada. Cada passo conta, mesmo que tenha sido breve.");
  }

  function resetDemo() {
    writeDemoSnapshot(INITIAL_MISSIONS.map((mission) => ({ ...mission })), 0);
    setFirstGrimoireResetSignal((signal) => signal + 1);
    setTitle("");
    setSeconds(FOCUS_DURATION);
    setRunning(false);
    setNotice("Demonstração reiniciada com segurança.");
  }

  return (
    <main className={styles.page}>
      <div className={styles.ambient} aria-hidden="true" />
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <Link href="/" className={styles.brand}><Sparkles size={21} aria-hidden="true" /> Academia Arcana</Link>
          <Link href="/" className={styles.back}><ArrowLeft size={16} aria-hidden="true" /> Voltar ao início</Link>
        </header>

        <div className={styles.intro}>
          <p className={styles.eyebrow}>O primeiro portal · experiência demonstrativa</p>
          <h1>Sua jornada começa <em>com um pequeno passo.</em></h1>
          <p>Explore uma prévia interativa do Santuário: crie missões, acompanhe conquistas e experimente o Foco sem pressão.</p>
          <p className={styles.disclosure}><ScrollText size={17} aria-hidden="true" /> Demonstração sem conta e sem banco de dados. As alterações ficam apenas neste navegador e podem ser reiniciadas.</p>
        </div>

        <div className={styles.overview} aria-label="Resumo da sua jornada">
          <div className={styles.stat}><span>Experiência</span><strong>{progress.xp} XP</strong><small>Pontos da demonstração</small></div>
          <div className={styles.stat}><span>Missões concluídas</span><strong>{progress.completed} / {progress.total}</strong><small>Sem metas punitivas</small></div>
          <div className={styles.stat}><span>Sessões de foco</span><strong>{focusSessions}</strong><small>No seu próprio ritmo</small></div>
        </div>

        <FirstGrimoireJourney
          focusSignal={firstGrimoireFocusSignal}
          resetSignal={firstGrimoireResetSignal}
          demoXp={progress.xp}
        />

        <div className={styles.columns}>
          <section className={styles.panel} aria-labelledby="demo-missions-title">
            <div className={styles.panelHead}>
              <div className={styles.panelIcon}><BookOpen size={23} aria-hidden="true" /></div>
              <div><p className={styles.kicker}>Grimório · missões</p><h2 id="demo-missions-title">Seu caminho de hoje</h2></div>
            </div>
            <p className={styles.muted}>Experimente concluir uma missão ou acrescentar seu próximo passo.</p>
            <div className={styles.progressHeader}>
              <span>Progresso de missões</span><strong>{progress.percent}%</strong>
            </div>
            <progress className={styles.progress} max={Math.max(1, progress.total)} value={progress.completed} aria-label="Missões concluídas">{progress.percent}%</progress>
            {allDone ? <p className={styles.celebration}>Todas as missões concluídas. Você pode descansar ou criar outra!</p> : null}

            <ul className={styles.missionList} aria-label="Missões da demonstração">
              {missions.map((mission) => (
                <li key={mission.id}>
                  <button
                    type="button"
                    className={mission.done ? styles.missionDone : styles.mission}
                    aria-pressed={mission.done}
                    onClick={() => toggleMission(mission.id)}
                  >
                    <span className={styles.checkmark} aria-hidden="true">{mission.done ? <Check size={16} /> : null}</span>
                    <span>{mission.title}</span>
                    <small>{mission.done ? "Concluída" : "Pendente"}</small>
                  </button>
                </li>
              ))}
            </ul>
            <form onSubmit={createMission} className={styles.newMission}>
              <label htmlFor="demo-mission-title">Adicionar uma missão</label>
              <div className={styles.fieldRow}>
                <input
                  id="demo-mission-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={80}
                  placeholder="Ex.: Revisar um capítulo"
                  disabled={missions.length >= 8}
                  required
                />
                <button type="submit" className={styles.primaryButton} disabled={!title.trim() || missions.length >= 8}>Adicionar</button>
              </div>
              <small>Até oito missões nesta demonstração.</small>
            </form>
          </section>

          <section className={styles.panel} aria-labelledby="demo-focus-title">
            <div className={styles.panelHead}>
              <div className={styles.panelIcon}><Clock3 size={23} aria-hidden="true" /></div>
              <div><p className={styles.kicker}>Foco · presença</p><h2 id="demo-focus-title">Um momento de concentração</h2></div>
            </div>
            <p className={styles.muted}>Um período curto de estudo, sem cobrança por interrupções.</p>
            <div className={styles.clock} role="timer" aria-label={"Tempo restante: " + timeLabel(seconds)} aria-live="off">{timeLabel(seconds)}</div>
            <div className={styles.focusActions}>
              <button type="button" className={styles.primaryButton} onClick={() => setRunning(!running)} disabled={seconds === 0}>
                {running ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
                {running ? "Pausar" : "Começar foco"}
              </button>
              <button type="button" className={styles.secondaryButton} onClick={() => { setRunning(false); setSeconds(FOCUS_DURATION); }}>Reiniciar tempo</button>
            </div>
            <button type="button" className={styles.registerButton} onClick={recordFocus} disabled={seconds === FOCUS_DURATION}>
              Registrar esta sessão
            </button>
            <div className={styles.note}>Interromper não apaga o que você já conseguiu. Você pode registrar uma sessão breve.</div>
            <div className={styles.next}>
              <h3>Pronta para continuar?</h3>
              <p>O próximo passo é experimentar as áreas reais da plataforma com sua própria conta quando os fluxos estiverem validados.</p>
              <Link href="/cadastro" className={styles.secondaryButton}>Conhecer o cadastro</Link>
            </div>
          </section>
        </div>
        <div className={styles.bottom}>
          <p role="status" aria-live="polite">{notice || "Escolha uma missão ou inicie uma sessão de foco."}</p>
          <button type="button" className={styles.reset} onClick={resetDemo}><RotateCcw size={16} aria-hidden="true" /> Reiniciar demonstração</button>
        </div>
        <footer className={styles.footer}>Academia Arcana · MVP demonstrativo isolado · nenhum dado é enviado a serviços externos por esta experiência.</footer>
      </div>
    </main>
  );
}
