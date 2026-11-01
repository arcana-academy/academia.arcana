/**
 * Life Science Research is a ChatGPT-hosted research skill collection.
 * This is a host-only capability manifest and a pure citation-link helper.
 * Neither this module nor the application can invoke a ChatGPT skill directly.
 */
import type {
  IntegrationCapability,
  IntegrationDefinition,
} from "./contracts";

export const LIFE_SCIENCE_RESEARCH_PROVIDER_ID = "life-science-research" as const;
export const LIFE_SCIENCE_RESEARCH_PLUGIN_NAME = "Life Science Research" as const;

export const LIFE_SCIENCE_RESEARCH_DEFINITION = {
  id: LIFE_SCIENCE_RESEARCH_PROVIDER_ID,
  displayName: LIFE_SCIENCE_RESEARCH_PLUGIN_NAME,
  authMode: "mcp",
  capabilities: ["read", "search", "metadata"] satisfies readonly IntegrationCapability[],
  userConnectionRequired: false,
  serverSideOnly: true,
  scopes: [],
} satisfies IntegrationDefinition;

/** Skills verified in the ChatGPT host, not website runtime API operations. */
export const LIFE_SCIENCE_RESEARCH_SKILLS = {
  literature: "ncbi-entrez-skill",
  clinicalTrials: "clinicaltrials-skill",
  proteins: "uniprot-skill",
  genetics: "clinvar-variation-skill",
  compounds: "chembl-skill",
  pathways: "reactome-skill",
  publicDatasets: "biostudies-arrayexpress-skill",
} as const;

export type LifeScienceResearchLane = keyof typeof LIFE_SCIENCE_RESEARCH_SKILLS;

export function describeLifeScienceResearchLane(lane: LifeScienceResearchLane) {
  return {
    providerId: LIFE_SCIENCE_RESEARCH_PROVIDER_ID,
    executionMode: "chatgpt-hosted" as const,
    skillUri:
      `skills://plugins/life-science-research/${LIFE_SCIENCE_RESEARCH_SKILLS[lane]}/skill.md` as const,
    websiteCallable: false as const,
  };
}

export type ScientificReferenceInput = {
  readonly kind: "pubmed" | "clinical-trial" | "doi";
  readonly identifier: string;
  readonly title: string;
};

export type ScientificReferenceLink = {
  readonly kind: ScientificReferenceInput["kind"];
  readonly identifier: string;
  readonly title: string;
  readonly url: string;
  /** Identifier format validation is not source, claim, or study verification. */
  readonly verification: "identifier-format-only";
};

/**
 * Constructs a safe canonical external link from a manually supplied citation.
 * Never labels a reference peer-reviewed or scientifically verified.
 * No outbound request or student-data access occurs here.
 */
export function toScientificReferenceLink(
  input: ScientificReferenceInput,
): ScientificReferenceLink {
  const identifier = input.identifier.trim();
  const title = input.title.trim();
  if (!title || title.length > 300 || /[\u0000-\u001f\u007f]/u.test(title)) {
    throw new Error("Scientific reference title is invalid.");
  }

  let url: string;
  if (input.kind === "pubmed") {
    if (!/^[1-9]\d{0,9}$/u.test(identifier)) {
      throw new Error("PubMed PMID format is invalid.");
    }
    url = `https://pubmed.ncbi.nlm.nih.gov/${identifier}/`;
  } else if (input.kind === "clinical-trial") {
    if (!/^NCT\d{8}$/u.test(identifier)) {
      throw new Error("ClinicalTrials.gov NCT ID format is invalid.");
    }
    url = `https://clinicaltrials.gov/study/${identifier}`;
  } else if (input.kind === "doi") {
    if (!/^10\.\d{4,9}\/[^\s/?#]+(?:\/[^\s?#]+)*$/iu.test(identifier)) {
      throw new Error("DOI format is invalid.");
    }
    url = `https://doi.org/${identifier.split("/").map(encodeURIComponent).join("/")}`;
  } else {
    throw new Error("Scientific reference source is unsupported.");
  }

  return {
    kind: input.kind,
    identifier,
    title,
    url,
    verification: "identifier-format-only",
  };
}
