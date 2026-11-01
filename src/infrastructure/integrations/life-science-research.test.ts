import { describe, expect, it } from "vitest";

import {
  LIFE_SCIENCE_RESEARCH_DEFINITION,
  LIFE_SCIENCE_RESEARCH_PROVIDER_ID,
  describeLifeScienceResearchLane,
  toScientificReferenceLink,
} from "./life-science-research";

describe("Life Science Research host-only boundary", () => {
  it("does not claim a website runtime connection", () => {
    expect(LIFE_SCIENCE_RESEARCH_DEFINITION).toMatchObject({
      id: LIFE_SCIENCE_RESEARCH_PROVIDER_ID,
      displayName: "Life Science Research",
      authMode: "mcp",
      capabilities: ["read", "search", "metadata"],
      userConnectionRequired: false,
      serverSideOnly: true,
      scopes: [],
    });
  });

  it("routes a known research lane only to a host skill manifest", () => {
    expect(describeLifeScienceResearchLane("literature")).toEqual({
      providerId: "life-science-research",
      executionMode: "chatgpt-hosted",
      skillUri:
        "skills://plugins/life-science-research/ncbi-entrez-skill/skill.md",
      websiteCallable: false,
    });
  });

  it("normalizes a PMID without pretending to verify the study", () => {
    expect(
      toScientificReferenceLink({
        kind: "pubmed",
        identifier: " 12345678 ",
        title: "Example title",
      }),
    ).toEqual({
      kind: "pubmed",
      identifier: "12345678",
      title: "Example title",
      url: "https://pubmed.ncbi.nlm.nih.gov/12345678/",
      verification: "identifier-format-only",
    });
  });

  it("supports clinical trial IDs and DOIs without network requests", () => {
    expect(
      toScientificReferenceLink({
        kind: "clinical-trial",
        identifier: "NCT12345678",
        title: "Example trial",
      }).url,
    ).toBe("https://clinicaltrials.gov/study/NCT12345678");
    expect(
      toScientificReferenceLink({
        kind: "doi",
        identifier: "10.1000/example.value",
        title: "Example DOI",
      }).url,
    ).toBe("https://doi.org/10.1000/example.value");
  });

  it.each([
    { kind: "pubmed" as const, identifier: "javascript:alert(1)" },
    { kind: "pubmed" as const, identifier: "000000" },
    { kind: "clinical-trial" as const, identifier: "NCT12" },
    { kind: "doi" as const, identifier: "10.1000/example?redirect=evil" },
    { kind: "doi" as const, identifier: "https://attacker.example/" },
  ])("rejects malformed or dangerous references: $kind $identifier", (input) => {
    expect(() => toScientificReferenceLink({ ...input, title: "Example" })).toThrow();
  });

  it("rejects control characters in source titles", () => {
    expect(() =>
      toScientificReferenceLink({
        kind: "pubmed",
        identifier: "12345678",
        title: "A title\nwith newline",
      }),
    ).toThrow();
  });
});
