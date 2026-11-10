"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";

import type { MestreArcanoHelpLevel } from "@/domains/intelligence";

type AgentResponse = {
  output?: unknown;
  error?: unknown;
};

const STARTER_PROMPTS = [
  {
    text: "O que devo estudar agora?",
    helpLevel: "unspecified",
  },
  {
    text: "Quero tentar primeiro. Me dê uma pista sem entregar a resposta.",
    helpLevel: "hint",
  },
  {
    text: "Ajude-me a decompor o problema em passos.",
    helpLevel: "decomposition",
  },
  {
    text: "Quero a resposta direta e depois verifico se entendi.",
    helpLevel: "direct-answer",
  },
] as const satisfies readonly {
  text: string;
  helpLevel: MestreArcanoHelpLevel;
}[];

const arcaneCore = "/assets/intelligence/aa-arcane-core.svg";

/**
 * Normaliza erros de requisição para exibição: usa a mensagem do `Error`
 * quando disponível e o texto de reserva (`fallback`) para qualquer outra
 * falha.
 */
function requestErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Envia um payload JSON ao endpoint do Mestre Arcano e devolve a resposta
 * textual do agente. Erros conhecidos da API são propagados com a mensagem
 * devolvida pelo servidor; respostas inesperadas usam `fallbackError`.
 */
async function postMestreArcanoRequest(
  body: Record<string, unknown>,
  fallbackError: string,
): Promise<string> {
  const response = await fetch("/api/agent/mestre-arcano", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as AgentResponse;
  if (!response.ok || typeof payload.output !== "string") {
    throw new Error(
      typeof payload.error === "string" ? payload.error : fallbackError,
    );
  }

  return payload.output;
}

/**
 * Monta o corpo da requisição do modo `source-comparison`, incluindo a
 * origem somente quando informada (textos já normalizados pelo chamador).
 */
function comparisonRequestBody(
  sourceA: string,
  sourceB: string,
  origin: string,
): Record<string, unknown> {
  return {
    mode: "source-comparison",
    sourceA,
    sourceB,
    ...(origin ? { origin } : {}),
  };
}

/**
 * Devolve o texto de estado da comparação: envio em andamento, textos
 * prontos para comparar ou aguardando o preenchimento das duas fontes.
 */
function comparisonStatusText(
  pending: boolean,
  hasBothSources: boolean,
): string {
  if (pending) {
    return "Enviando fontes para comparação...";
  }

  return hasBothSources
    ? "Os dois textos foram preenchidos e estão prontos para comparação."
    : "Aguardando preenchimento dos dois textos";
}

type ComparisonFeedbackProps = {
  error: string | null;
  output: string | null;
};

/**
 * Blocos de feedback da comparação de fontes: alerta de erro (role="alert")
 * e resposta do modelo (aria-live="polite"), renderizados somente quando há
 * conteúdo.
 */
function ComparisonFeedback({ error, output }: ComparisonFeedbackProps) {
  return (
    <>
      {error ? (
        <div className="aa-empty aa-mestre-feedback" role="alert"><p>{error}</p></div>
      ) : null}
      {output ? (
        <div className="aa-mestre-response" aria-live="polite">
          <p className="aa-eyebrow">Comparação das fontes</p>
          <div>{output}</div>
        </div>
      ) : null}
    </>
  );
}

type MestreSourceFieldProps = {
  id: string;
  title: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
};

/**
 * Campo de texto obrigatório da comparação de fontes (F01-A ou F01-B), com
 * rótulo, marcador de obrigatoriedade, textarea de até 3.000 caracteres e
 * dica de estado associada.
 */
function MestreSourceField({
  id,
  title,
  placeholder,
  value,
  onChange,
  disabled,
}: MestreSourceFieldProps) {
  return (
    <div className="aa-mestre-source-field">
      <label htmlFor={id}>
        {title} <span className="aa-mestre-source-required">Obrigatória</span>
      </label>
      <textarea
        id={id}
        className="aa-input aa-mestre-source-text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-describedby={`${id}-hint`}
        rows={8}
        maxLength={3000}
        required
        disabled={disabled}
      />
      <p className="aa-state-copy" id={`${id}-hint`}>
        Obrigatória · até 3.000 caracteres
      </p>
    </div>
  );
}

/**
 * Seção de comparação direta de fontes: mantém o estado dos dois textos
 * (F01-A/F01-B) e da origem opcional, envia o modo `source-comparison` ao
 * endpoint do Mestre Arcano e exibe o resultado ou o erro da comparação.
 */
function MestreSourceComparisonSection() {
  const [sourceA, setSourceA] = useState("");
  const [sourceB, setSourceB] = useState("");
  const [sourceOrigin, setSourceOrigin] = useState("");
  const [comparisonOutput, setComparisonOutput] = useState<string | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [comparisonPending, setComparisonPending] = useState(false);
  const hasBothSources = Boolean(sourceA.trim() && sourceB.trim());

  /**
   * Limpa o resultado e o erro da comparação anterior assim que qualquer
   * campo da seção é editado, evitando exibir resposta obsoleta que não
   * corresponde mais aos textos preenchidos.
   */
  function clearComparisonFeedback() {
    setComparisonOutput(null);
    setComparisonError(null);
  }

  /**
   * Valida localmente os dois textos, envia a comparação ao endpoint do
   * Mestre Arcano e publica a resposta ou a mensagem de erro no estado da
   * seção, sempre limpando o resultado anterior antes da requisição.
   */
  async function submitSourceComparison(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedSourceA = sourceA.trim();
    const normalizedSourceB = sourceB.trim();
    const normalizedOrigin = sourceOrigin.trim();
    if (!normalizedSourceA || !normalizedSourceB || comparisonPending) return;

    setComparisonPending(true);
    setComparisonError(null);
    setComparisonOutput(null);

    try {
      const output = await postMestreArcanoRequest(
        comparisonRequestBody(
          normalizedSourceA,
          normalizedSourceB,
          normalizedOrigin,
        ),
        "Não foi possível comparar as fontes.",
      );
      setComparisonOutput(output);
    } catch (requestError) {
      setComparisonError(
        requestErrorMessage(requestError, "Não foi possível comparar as fontes."),
      );
    } finally {
      setComparisonPending(false);
    }
  }

  return (
    <section className="aa-mestre-source-comparison" aria-labelledby="mestre-source-comparison-title">
      <div className="aa-mestre-source-heading">
        <h3 id="mestre-source-comparison-title">2. Preenchimento direto nesta conversa</h3>
        <p className="aa-state-copy">
          Cole os dois trechos para receber uma comparação. A origem é opcional;
          links informados não serão abertos automaticamente.
        </p>
      </div>
      <form className="aa-mestre-source-form" onSubmit={submitSourceComparison}>
        <div className="aa-mestre-source-fields">
          <MestreSourceField
            id="mestre-source-a"
            title="F01-A — Seção 3.2 da v1.0"
            placeholder="Cole o texto da Seção 3.2 da v1.0..."
            value={sourceA}
            onChange={(value) => {
              setSourceA(value);
              clearComparisonFeedback();
            }}
            disabled={comparisonPending}
          />
          <MestreSourceField
            id="mestre-source-b"
            title="F01-B — Seção 3.2 da v1.1"
            placeholder="Cole o texto da Seção 3.2 da v1.1..."
            value={sourceB}
            onChange={(value) => {
              setSourceB(value);
              clearComparisonFeedback();
            }}
            disabled={comparisonPending}
          />
        </div>
        <div className="aa-mestre-source-field">
          <label htmlFor="mestre-source-origin">Origem (opcional)</label>
          <input
            id="mestre-source-origin"
            className="aa-input"
            value={sourceOrigin}
            onChange={(event) => {
              setSourceOrigin(event.target.value);
              clearComparisonFeedback();
            }}
            placeholder="Documento, URL ou referência"
            maxLength={500}
            disabled={comparisonPending}
          />
        </div>
        <p className="aa-state-copy" role="status" aria-live="polite">
          {comparisonStatusText(comparisonPending, hasBothSources)}
        </p>
        <button
          className="aa-button aa-button-primary"
          type="submit"
          disabled={!hasBothSources || comparisonPending}
        >
          {comparisonPending ? "Comparando..." : "Enviar fontes para comparação"}
        </button>
      </form>
      <ComparisonFeedback error={comparisonError} output={comparisonOutput} />
    </section>
  );
}

/**
 * Painel do Mestre Arcano no Santuário: consulta livre ao tutor com nível de
 * ajuda configurável, sugestões de perguntas e a seção de comparação direta
 * de fontes (F01-A/F01-B).
 */
export function MestreArcanoPanel() {
  const [input, setInput] = useState("");
  const [helpLevel, setHelpLevel] =
    useState<MestreArcanoHelpLevel>("unspecified");
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /**
   * Envia a mensagem livre (com o nível de ajuda selecionado) ao endpoint do
   * Mestre Arcano e publica a resposta ou o erro, bloqueando reenvios
   * enquanto uma consulta estiver em andamento.
   */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = input.trim();
    if (!normalized || pending) return;

    setPending(true);
    setError(null);
    setOutput(null);

    try {
      const result = await postMestreArcanoRequest(
        {
          input: normalized,
          ...(helpLevel === "unspecified" ? {} : { helpLevel }),
        },
        "Não foi possível consultar o Mestre Arcano.",
      );
      setOutput(result);
    } catch (requestError) {
      setError(
        requestErrorMessage(
          requestError,
          "Não foi possível consultar o Mestre Arcano.",
        ),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="aa-surface aa-mestre-panel" aria-labelledby="mestre-arcano-title">
      <div className="aa-mestre-header">
        <div className="aa-mestre-core" aria-hidden="true">
          <Image src={arcaneCore} alt="" width={72} height={72} priority />
        </div>
        <div className="aa-surface-header aa-mestre-header-copy">
          <div>
            <p className="aa-eyebrow">Inteligência · Mestre Arcano</p>
            <h2 id="mestre-arcano-title">Seu próximo passo pode começar aqui.</h2>
            <p>Consulte o tutor usando apenas o contexto autorizado da sua conta.</p>
          </div>
        </div>
      </div>

      <div className="aa-mestre-prompts" aria-label="Sugestões de perguntas">
        {STARTER_PROMPTS.map((prompt) => (
          <button
            className="aa-mestre-prompt"
            key={prompt.text}
            type="button"
            onClick={() => {
              setInput(prompt.text);
              setHelpLevel(prompt.helpLevel);
            }}
            disabled={pending}
          >
            {prompt.text}
          </button>
        ))}
      </div>

      <form className="aa-mestre-form" onSubmit={submit}>
        <label className="aa-visually-hidden" htmlFor="mestre-arcano-input">
          Mensagem para o Mestre Arcano
        </label>
        <textarea
          id="mestre-arcano-input"
          className="aa-input aa-mestre-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Pergunte sobre seu estudo, planejamento ou próximo passo..."
          rows={3}
          maxLength={8000}
          disabled={pending}
        />
        <label htmlFor="mestre-arcano-help-level">Como prefere receber ajuda?</label>
        <select
          id="mestre-arcano-help-level"
          className="aa-input"
          value={helpLevel}
          onChange={(event) =>
            setHelpLevel(event.target.value as MestreArcanoHelpLevel)
          }
          disabled={pending}
        >
          <option value="unspecified">Sem preferência</option>
          <option value="hint">Uma pista</option>
          <option value="decomposition">Passo a passo</option>
          <option value="direct-answer">Resposta direta</option>
        </select>
        <button
          className="aa-button aa-button-primary"
          type="submit"
          disabled={pending || !input.trim()}
        >
          {pending ? "Consultando..." : "Consultar Mestre Arcano"}
        </button>
      </form>

      {error ? (
        <div className="aa-empty aa-mestre-feedback" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      {output ? (
        <div className="aa-mestre-response" aria-live="polite">
          <p className="aa-eyebrow">Resposta</p>
          <div>{output}</div>
        </div>
      ) : null}

      <MestreSourceComparisonSection />
    </section>
  );
}
