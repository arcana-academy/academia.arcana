import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ArcanaExperience } from "./ArcanaExperience";
import { DEMO_STORAGE_KEY } from "./demo-model";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("public synthetic Arcana MVP", () => {
  it("presents a clear demo disclosure with accessible missions", () => {
    render(<ArcanaExperience />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("O conhecimento abre");
    expect(screen.getByText(/Demonstração sem conta e sem banco de dados/)).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Acessos do Portal do Conhecimento" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Entrar no Primeiro Grimório/ })).toHaveAttribute("href", "#primeiro-grimorio");
    expect(screen.getByRole("region", { name: "Primeiro Grimório" })).toHaveAttribute("id", "primeiro-grimorio");
    expect(screen.getByText(/O próximo ambiente está em preparação/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Missões concluídas" })).toHaveAttribute("value", "0");
    expect(within(screen.getByRole("list", { name: "Missões da demonstração" })).getAllByRole("button")).toHaveLength(3);
  });

  it("completes and reopens a mission and updates gamified progress", () => {
    render(<ArcanaExperience />);
    const mission = screen.getByRole("button", { name: /Explorar um Grimório/ });
    fireEvent.click(mission);
    expect(mission).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByLabelText("Resumo da sua jornada")).getByText("35 XP")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Missões concluídas" })).toHaveAttribute("value", "1");
    fireEvent.click(mission);
    expect(mission).toHaveAttribute("aria-pressed", "false");
    expect(within(screen.getByLabelText("Resumo da sua jornada")).getByText("0 XP")).toBeInTheDocument();
  });

  it("adds an accessible mission and can reset its local journey", () => {
    render(<ArcanaExperience />);
    fireEvent.change(screen.getByRole("textbox", { name: "Adicionar uma missão" }), {
      target: { value: " Rever   capítulo " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(screen.getByRole("button", { name: /Rever capítulo/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reiniciar demonstração" }));
    expect(screen.queryByRole("button", { name: /Rever capítulo/ })).not.toBeInTheDocument();
  });

  it("restores progress only from this browser's constrained storage", () => {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({
      missions: [{ id: "review", title: "Leitura", done: true }],
      focusSessions: 2,
    }));
    render(<ArcanaExperience />);
    expect(within(screen.getByLabelText("Resumo da sua jornada")).getByText("75 XP")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Leitura/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("runs and registers an interruptible focus session", () => {
    vi.useFakeTimers();
    render(<ArcanaExperience />);
    fireEvent.click(screen.getByRole("button", { name: "Começar foco" }));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("timer")).toHaveTextContent("04:59");
    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
    fireEvent.click(screen.getByRole("button", { name: "Registrar esta sessão" }));
    expect(within(screen.getByLabelText("Resumo da sua jornada")).getByText("20 XP")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent("05:00");
  });
});
