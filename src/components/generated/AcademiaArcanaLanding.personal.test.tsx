import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AcademiaArcanaLanding } from "./AcademiaArcanaLanding.generated";

describe("AcademiaArcanaLanding personal mode navigation", () => {
  it("keeps the existing enrollment links in normal public mode", () => {
    render(<AcademiaArcanaLanding />);

    expect(screen.getByRole("link", { name: "Descobrir a Academia" })).toHaveAttribute("href", "/cadastro");
    expect(screen.getByRole("link", { name: "Criar minha conta" })).toHaveAttribute("href", "/cadastro");
    expect(screen.getByRole("link", { name: "Experimentar agora" })).toHaveAttribute("href", "/experiencia");
  });

  it("offers owner sign-in rather than blocked enrollment in personal mode", () => {
    render(<AcademiaArcanaLanding personalMode />);

    const entryLinks = screen.getAllByRole("link", { name: "Entrar no Santuário" });
    expect(entryLinks).toHaveLength(2);
    for (const link of entryLinks) {
      expect(link).toHaveAttribute("href", "/login");
    }
    expect(screen.getByText("Entre com sua conta autorizada para continuar seus estudos no Santuário.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Criar minha conta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Experimentar agora" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Já tenho uma conta" })).not.toBeInTheDocument();
  });
});
