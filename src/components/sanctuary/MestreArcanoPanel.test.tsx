import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MestreArcanoPanel } from "./MestreArcanoPanel";

describe("MestreArcanoPanel", () => {
  it("enables direct source comparison only after both required texts are filled", () => {
    render(<MestreArcanoPanel />);

    const sourceA = screen.getByRole("textbox", { name: /F01-A.*Obrigatória/ });
    const sourceB = screen.getByRole("textbox", { name: /F01-B.*Obrigatória/ });
    const origin = screen.getByRole("textbox", { name: "Origem (opcional)" });
    const button = screen.getByRole("button", { name: "Enviar fontes para comparação" });

    expect(sourceA).toBeRequired();
    expect(sourceB).toBeRequired();
    expect(origin).not.toBeRequired();
    expect(button).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Aguardando preenchimento dos dois textos");

    fireEvent.change(sourceA, { target: { value: "   " } });
    expect(button).toBeDisabled();
    fireEvent.change(sourceA, { target: { value: "Texto da versão 1.0" } });
    expect(button).toBeDisabled();
    fireEvent.change(sourceB, { target: { value: "Texto da versão 1.1" } });
    expect(button).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("prontos para comparação");
  });

  it("submits both source texts and the optional origin for comparison", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ output: "Mudanças identificadas entre as versões." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<MestreArcanoPanel />);
    fireEvent.change(screen.getByRole("textbox", { name: /F01-A.*Obrigatória/ }), {
      target: { value: "  Texto A  " },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /F01-B.*Obrigatória/ }), {
      target: { value: "Texto B" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Origem (opcional)" }), {
      target: { value: "  Manual de referência  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar fontes para comparação" }));

    expect(await screen.findByText("Mudanças identificadas entre as versões.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agent/mestre-arcano",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          mode: "source-comparison",
          sourceA: "Texto A",
          sourceB: "Texto B",
          origin: "Manual de referência",
        }),
      }),
    );
    fetchMock.mockRestore();
  });

  it("limpa a comparação anterior quando um dos textos é editado", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ output: "Comparação antiga." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<MestreArcanoPanel />);
    const sourceA = screen.getByRole("textbox", { name: /F01-A.*Obrigatória/ });
    fireEvent.change(sourceA, { target: { value: "Texto A" } });
    fireEvent.change(screen.getByRole("textbox", { name: /F01-B.*Obrigatória/ }), {
      target: { value: "Texto B" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar fontes para comparação" }));

    expect(await screen.findByText("Comparação antiga.")).toBeInTheDocument();

    fireEvent.change(sourceA, { target: { value: "Texto A revisado" } });
    await waitFor(() =>
      expect(screen.queryByText("Comparação antiga.")).not.toBeInTheDocument(),
    );

    fetchMock.mockRestore();
  });

  it("preenche uma sugestão sem enviar automaticamente", () => {
    render(<MestreArcanoPanel />);

    fireEvent.click(screen.getByRole("button", { name: "O que devo estudar agora?" }));

    expect(
      screen.getByRole("textbox", { name: "Mensagem para o Mestre Arcano" }),
    ).toHaveValue("O que devo estudar agora?");
    expect(
      document.querySelector('img[src="/assets/intelligence/aa-arcane-core.svg"]'),
    ).toBeInTheDocument();
  });

  it("envia o nível de ajuda somente quando o estudante faz uma escolha explícita", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          output: "Comece por esta pista.",
          responseId: "resp_hint",
          model: "gpt-5.6-sol",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(<MestreArcanoPanel />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Quero tentar primeiro. Me dê uma pista sem entregar a resposta.",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Consultar Mestre Arcano" }));

    await screen.findByText("Comece por esta pista.");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agent/mestre-arcano",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          input: "Quero tentar primeiro. Me dê uma pista sem entregar a resposta.",
          helpLevel: "hint",
        }),
      }),
    );

    fetchMock.mockRestore();
  });

  it("preserva a pista escolhida após personalizar o texto sugerido", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ output: "Pista personalizada." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<MestreArcanoPanel />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Quero tentar primeiro. Me dê uma pista sem entregar a resposta.",
      }),
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "Mensagem para o Mestre Arcano" }),
      { target: { value: "Preciso de uma pista para esta questão específica." } },
    );

    expect(screen.getByRole("combobox", { name: "Como prefere receber ajuda?" })).toHaveValue("hint");
    fireEvent.click(screen.getByRole("button", { name: "Consultar Mestre Arcano" }));
    await screen.findByText("Pista personalizada.");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agent/mestre-arcano",
      expect.objectContaining({
        body: JSON.stringify({
          input: "Preciso de uma pista para esta questão específica.",
          helpLevel: "hint",
        }),
      }),
    );
    fetchMock.mockRestore();
  });

  it("permite escolher resposta direta para uma pergunta personalizada", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ output: "Resposta direta." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<MestreArcanoPanel />);
    fireEvent.change(
      screen.getByRole("textbox", { name: "Mensagem para o Mestre Arcano" }),
      { target: { value: "Qual é a definição?" } },
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Como prefere receber ajuda?" }), {
      target: { value: "direct-answer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Consultar Mestre Arcano" }));
    await screen.findByText("Resposta direta.");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agent/mestre-arcano",
      expect.objectContaining({
        body: JSON.stringify({ input: "Qual é a definição?", helpLevel: "direct-answer" }),
      }),
    );
    fetchMock.mockRestore();
  });

  it("preserva o contrato legado ao voltar para sem preferência", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ output: "Resposta sem preferência." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<MestreArcanoPanel />);
    fireEvent.change(
      screen.getByRole("textbox", { name: "Mensagem para o Mestre Arcano" }),
      { target: { value: "Explique o conceito." } },
    );
    const helpLevelSelect = screen.getByRole("combobox", {
      name: "Como prefere receber ajuda?",
    });
    fireEvent.change(helpLevelSelect, { target: { value: "hint" } });
    fireEvent.change(helpLevelSelect, { target: { value: "unspecified" } });
    fireEvent.click(screen.getByRole("button", { name: "Consultar Mestre Arcano" }));

    await screen.findByText("Resposta sem preferência.");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agent/mestre-arcano",
      expect.objectContaining({
        body: JSON.stringify({ input: "Explique o conceito." }),
      }),
    );
    fetchMock.mockRestore();
  });

  it("consulta o agente e apresenta a resposta", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          output: "Comece pelo próximo capítulo pendente e faça uma sessão curta.",
          responseId: "resp_test",
          model: "gpt-5.6-sol",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(<MestreArcanoPanel />);

    fireEvent.change(
      screen.getByRole("textbox", { name: "Mensagem para o Mestre Arcano" }),
      { target: { value: "O que estudo agora?" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Consultar Mestre Arcano" }));

    await waitFor(() => {
      expect(
        screen.getByText("Comece pelo próximo capítulo pendente e faça uma sessão curta."),
      ).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agent/mestre-arcano",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ input: "O que estudo agora?" }),
      }),
    );

    fetchMock.mockRestore();
  });

  it("remove a resposta anterior quando uma nova consulta falha", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            output: "Resposta anterior.",
            responseId: "resp_1",
            model: "gpt-5.6-sol",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Falha temporária." }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }),
      );

    render(<MestreArcanoPanel />);
    const textbox = screen.getByRole("textbox", { name: "Mensagem para o Mestre Arcano" });

    fireEvent.change(textbox, { target: { value: "Primeira pergunta" } });
    fireEvent.click(screen.getByRole("button", { name: "Consultar Mestre Arcano" }));
    expect(await screen.findByText("Resposta anterior.")).toBeInTheDocument();

    fireEvent.change(textbox, { target: { value: "Segunda pergunta" } });
    fireEvent.click(screen.getByRole("button", { name: "Consultar Mestre Arcano" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha temporária.");
    expect(screen.queryByText("Resposta anterior.")).not.toBeInTheDocument();

    fetchMock.mockRestore();
  });

  it("apresenta erro retornado pela API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ error: "O Mestre Arcano ainda não está configurado no ambiente." }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(<MestreArcanoPanel />);

    fireEvent.change(
      screen.getByRole("textbox", { name: "Mensagem para o Mestre Arcano" }),
      { target: { value: "Ajude-me a planejar." } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Consultar Mestre Arcano" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O Mestre Arcano ainda não está configurado no ambiente.",
    );

    fetchMock.mockRestore();
  });
});
