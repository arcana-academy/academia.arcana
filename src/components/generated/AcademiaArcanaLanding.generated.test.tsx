import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AcademiaArcanaLanding } from "./AcademiaArcanaLanding.generated";

describe("AcademiaArcanaLanding illustrative preview", () => {
  it("labels the sample sanctuary progress as illustrative on the public landing", () => {
    render(<AcademiaArcanaLanding />);

    expect(screen.getByText("Prévia ilustrativa do Santuário")).toBeVisible();
    expect(screen.getByText("3 / 5")).toBeInTheDocument();
    expect(screen.getByText("42 min")).toBeInTheDocument();
    expect(screen.getByText("7 dias")).toBeInTheDocument();
  });
});
