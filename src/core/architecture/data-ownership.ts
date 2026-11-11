import { CORE_DOMAINS, type CoreDomain } from "./domains";

export const DATA_RESOURCE_KINDS = [
  "table",
  "database-rpc",
  "storage-bucket",
] as const;

export type DataResourceKind = (typeof DATA_RESOURCE_KINDS)[number];

export type DataOwnershipOwner = CoreDomain | "infrastructure" | "cross-domain";

export type DataOwnershipPolicy = {
  readonly resource: string;
  readonly kind: DataResourceKind;
  readonly owner: DataOwnershipOwner;
  readonly supportingDomains: readonly CoreDomain[];
  readonly rule: string;
};

export const DATA_OWNERSHIP_POLICY: readonly DataOwnershipPolicy[] = [
  {
    resource: "public.grimoires",
    kind: "table",
    owner: "learning",
    supportingDomains: [],
    rule: "Learning owns grimoire state and invariants; persistence remains infrastructure.",
  },
  {
    resource: "public.notebooks",
    kind: "table",
    owner: "learning",
    supportingDomains: [],
    rule: "Learning owns notebook hierarchy state.",
  },
  {
    resource: "public.chapters",
    kind: "table",
    owner: "learning",
    supportingDomains: [],
    rule: "Learning owns chapter hierarchy state.",
  },
  {
    resource: "public.pages",
    kind: "table",
    owner: "learning",
    supportingDomains: [],
    rule: "Learning owns page content and ordering state.",
  },
  {
    resource: "public.page_progress",
    kind: "table",
    owner: "learning",
    supportingDomains: [],
    rule: "Learning owns learner progress attached to pages.",
  },
  {
    resource: "public.study_tasks",
    kind: "table",
    owner: "planning",
    supportingDomains: ["learning"],
    rule: "Planning owns task lifecycle; learning may provide learning context through contracts.",
  },
  {
    resource: "public.gamification_profiles",
    kind: "table",
    owner: "gamification",
    supportingDomains: [],
    rule: "Gamification owns XP, streak and recognition state.",
  },
  {
    resource: "public.missions",
    kind: "table",
    owner: "gamification",
    supportingDomains: ["planning"],
    rule: "Gamification owns mission state; task completion can trigger an atomic reward transition.",
  },
  {
    resource: "public.focus_sessions",
    kind: "table",
    owner: "planning",
    supportingDomains: [],
    rule: "Planning owns persisted focus-session state.",
  },
  {
    resource: "public.friend_connections",
    kind: "table",
    owner: "social",
    supportingDomains: [],
    rule: "Social owns relationship state and its lifecycle.",
  },
  {
    resource: "public.feedback_responses",
    kind: "table",
    owner: "trust",
    supportingDomains: [],
    rule: "Trust owns user feedback and governance-facing intake records.",
  },
  {
    resource: "public.educational_practice_items",
    kind: "table",
    owner: "education",
    supportingDomains: ["learning"],
    rule: "Education owns practice activities and their criteria; Learning owns learner progression.",
  },
  {
    resource: "public.educational_practice_attempts",
    kind: "table",
    owner: "education",
    supportingDomains: ["learning"],
    rule: "Education owns educational evidence; Learning owns any progress derived from it.",
  },
  {
    resource: "public.integration_credentials",
    kind: "table",
    owner: "infrastructure",
    supportingDomains: [],
    rule: "Credentials are integration/security infrastructure, not business-domain state.",
  },
  {
    resource: "public.external_document_sources",
    kind: "table",
    owner: "infrastructure",
    supportingDomains: ["intelligence", "education"],
    rule: "Persisted external-source descriptors belong to the integration boundary; consuming domains receive authorized projections.",
  },
  {
    resource: "public.open_source_ai_rate_limits",
    kind: "table",
    owner: "infrastructure",
    supportingDomains: [],
    rule: "Durable per-authenticated-user throttle state belongs to security infrastructure, not Intelligence.",
  },
  {
    resource: "private.api_rate_limit_policies",
    kind: "table",
    owner: "infrastructure",
    supportingDomains: [],
    rule: "The private quota policy registry is an infrastructure enforcement contract.",
  },
  {
    resource: "private.api_rate_limit_counters",
    kind: "table",
    owner: "infrastructure",
    supportingDomains: [],
    rule: "The private per-subject quota counters are infrastructure enforcement state.",
  },
  {
    resource: "public.consume_open_source_ai_rate_limit",
    kind: "database-rpc",
    owner: "infrastructure",
    supportingDomains: [],
    rule: "This authenticated atomic quota RPC enforces infrastructure policy before AI invocation.",
  },
  {
    resource: "public.consume_api_rate_limit",
    kind: "database-rpc",
    owner: "infrastructure",
    supportingDomains: [],
    rule: "This authenticated atomic quota RPC enforces private bucket policies for API surfaces.",
  },
  {
    resource: "public.complete_study_task_with_reward",
    kind: "database-rpc",
    owner: "cross-domain",
    supportingDomains: ["planning", "gamification"],
    rule: "Atomic transition coordinates Planning task completion and Gamification reward invariants without transferring ownership.",
  },
  {
    resource: "public.record_educational_practice_attempt",
    kind: "database-rpc",
    owner: "cross-domain",
    supportingDomains: ["education", "learning"],
    rule: "Atomically records Education evidence and updates Learning page progress for the authenticated owner.",
  },
  {
    resource: "public.record_criterion_referenced_practice_attempt",
    kind: "database-rpc",
    owner: "cross-domain",
    supportingDomains: ["education", "learning"],
    rule: "Atomically records bounded objective Education evidence and updates Learning page progress.",
  },
  {
    resource: "public.move_workspace_page",
    kind: "database-rpc",
    owner: "learning",
    supportingDomains: [],
    rule: "The transaction enforces Learning page-ordering invariants.",
  },
  {
    resource: "storage.grimoire-covers",
    kind: "storage-bucket",
    owner: "learning",
    supportingDomains: [],
    rule: "Learning owns the business meaning of grimoire covers; storage is only the persistence mechanism.",
  },
];

export function validateDataOwnershipPolicy(
  policy: readonly DataOwnershipPolicy[] = DATA_OWNERSHIP_POLICY,
): readonly string[] {
  const issues: string[] = [];
  const knownDomains = new Set<CoreDomain>(CORE_DOMAINS);
  const resources = new Set<string>();

  for (const item of policy) {
    if (!item.resource.trim()) {
      issues.push("empty data resource");
    }

    if (resources.has(item.resource)) {
      issues.push(`duplicate data resource: ${item.resource}`);
    }
    resources.add(item.resource);

    if (!DATA_RESOURCE_KINDS.includes(item.kind)) {
      issues.push(`unknown data resource kind: ${item.kind}`);
    }

    if (
      item.owner !== "infrastructure" &&
      item.owner !== "cross-domain" &&
      !knownDomains.has(item.owner)
    ) {
      issues.push(`unknown data owner: ${item.resource} -> ${item.owner}`);
    }

    for (const domain of item.supportingDomains) {
      if (!knownDomains.has(domain)) {
        issues.push(
          `unknown supporting domain: ${item.resource} -> ${domain}`,
        );
      }
      if (domain === item.owner) {
        issues.push(
          `owner duplicated as supporting domain: ${item.resource} -> ${domain}`,
        );
      }
    }

    if (item.owner === "cross-domain" && item.supportingDomains.length < 2) {
      issues.push(
        `cross-domain resource requires multiple supporting domains: ${item.resource}`,
      );
    }

    if (item.owner === "infrastructure" && item.supportingDomains.length === 0) {
      continue;
    }
  }


  return issues;
}
