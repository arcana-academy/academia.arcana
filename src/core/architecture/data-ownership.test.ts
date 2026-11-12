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
      "public.integration_credentials": "infrastructure",
      "public.external_document_sources": "infrastructure",
    });
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
