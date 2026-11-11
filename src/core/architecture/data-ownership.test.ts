import { describe, expect, it } from "vitest";

import { CORE_DOMAINS } from "./domains";
import {
  DATA_OWNERSHIP_POLICY,
  DATA_RESOURCE_KINDS,
  validateDataOwnershipPolicy,
} from "./data-ownership";

describe("data ownership architecture policy", () => {
  it("declares each persisted product resource exactly once", () => {
    expect(new Set(DATA_OWNERSHIP_POLICY.map((item) => item.resource)).size).toBe(
      DATA_OWNERSHIP_POLICY.length,
    );
    expect(validateDataOwnershipPolicy()).toEqual([]);
  });

  it("assigns business tables to their owning domains", () => {
    const ownership = Object.fromEntries(
      DATA_OWNERSHIP_POLICY
        .filter((item) => item.kind === "table")
        .map((item) => [item.resource, item.owner]),
    );

    expect(ownership).toMatchObject({
      "public.grimoires": "learning",
      "public.notebooks": "learning",
      "public.chapters": "learning",
      "public.pages": "learning",
      "public.page_progress": "learning",
      "public.study_tasks": "planning",
      "public.gamification_profiles": "gamification",
      "public.missions": "gamification",
      "public.focus_sessions": "planning",
      "public.friend_connections": "social",
      "public.feedback_responses": "trust",
      "public.educational_practice_items": "education",
      "public.educational_practice_attempts": "education",
      "public.open_source_ai_rate_limits": "infrastructure",
      "private.api_rate_limit_policies": "infrastructure",
      "private.api_rate_limit_counters": "infrastructure",
      "public.integration_credentials": "infrastructure",
      "public.external_document_sources": "infrastructure",
    });
  });

  it("registers all five SQL-backed throttling resources exactly once with infrastructure ownership", () => {
    const expected = [
      ["public.open_source_ai_rate_limits", "table"],
      ["private.api_rate_limit_policies", "table"],
      ["private.api_rate_limit_counters", "table"],
      ["public.consume_open_source_ai_rate_limit", "database-rpc"],
      ["public.consume_api_rate_limit", "database-rpc"],
    ] as const;

    for (const [resource, kind] of expected) {
      const matches = DATA_OWNERSHIP_POLICY.filter((item) => item.resource === resource);
      expect(matches).toHaveLength(1);
      expect(matches[0]).toMatchObject({
        resource,
        kind,
        owner: "infrastructure",
        supportingDomains: [],
      });
    }
  });

  it("keeps cross-domain transactions explicit without transferring table ownership", () => {
    const rewardRpc = DATA_OWNERSHIP_POLICY.find(
      (item) => item.resource === "public.complete_study_task_with_reward",
    );

    expect(rewardRpc).toMatchObject({
      kind: "database-rpc",
      owner: "cross-domain",
      supportingDomains: ["planning", "gamification"],
    });
  });

  it("keeps educational evidence owned by Education and atomic progress effects cross-domain", () => {
    for (const name of [
      "public.record_educational_practice_attempt",
      "public.record_criterion_referenced_practice_attempt",
    ]) {
      const rpc = DATA_OWNERSHIP_POLICY.find((item) => item.resource === name);
      expect(rpc).toMatchObject({
        kind: "database-rpc",
        owner: "cross-domain",
        supportingDomains: ["education", "learning"],
      });
    }
    for (const resource of ["public.educational_practice_items", "public.educational_practice_attempts"]) {
      const matches = DATA_OWNERSHIP_POLICY.filter((item) => item.resource === resource);
      expect(matches).toHaveLength(1);
      expect(matches[0]).toMatchObject({ kind: "table", owner: "education" });
    }
    expect(DATA_OWNERSHIP_POLICY.find((item) => item.resource === "public.page_progress")?.owner).toBe("learning");
  });

  it("keeps storage infrastructure separate from business ownership", () => {
    const covers = DATA_OWNERSHIP_POLICY.find(
      (item) => item.resource === "storage.grimoire-covers",
    );

    expect(covers).toMatchObject({
      kind: "storage-bucket",
      owner: "learning",
    });
    expect(DATA_RESOURCE_KINDS).toEqual([
      "table",
      "database-rpc",
      "storage-bucket",
    ]);
  });

  it("references only approved architectural domains", () => {
    for (const item of DATA_OWNERSHIP_POLICY) {
      if (item.owner !== "infrastructure" && item.owner !== "cross-domain") {
        expect(CORE_DOMAINS).toContain(item.owner);
      }

      for (const domain of item.supportingDomains) {
        expect(CORE_DOMAINS).toContain(domain);
      }
    }

    expect(DATA_OWNERSHIP_POLICY.every((item) => item.rule.trim().length > 0)).toBe(
      true,
    );
  });
});
