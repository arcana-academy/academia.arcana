import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareMigrationVersions, parseAppliedVersions } from "./check-personal-migration-ledger.mjs";

describe("read-only personal migration preflight", () => {
  it("recognizes complete ledger parity", () => {
    const result = compareMigrationVersions(
      ["20261001000000_initial.sql", "20261002000000_add.sql"],
      ["20261002000000", "20261001000000"],
    );
    assert.equal(result.compatibleLedger, true);
    assert.equal(result.matchedCount, 2);
    assert.deepEqual(result.appliedOnly, []);
    assert.deepEqual(result.sourceOnly, []);
  });

  it("fails closed on source-only and hosted-only migration versions", () => {
    const result = compareMigrationVersions(
      ["20261001000000_a.sql", "20261003000000_c.sql"],
      ["20261001000000", "20261002000000"],
    );
    assert.equal(result.compatibleLedger, false);
    assert.deepEqual(result.appliedOnly, ["20261002000000"]);
    assert.deepEqual(result.sourceOnly, ["20261003000000"]);
  });

  it("rejects duplicate migrations even when their filenames are different", () => {
    assert.throws(
      () => compareMigrationVersions(["20261001000000_a.sql", "20261001000000_b.sql"], ["20261001000000"]),
      /Duplicate source/,
    );
    assert.throws(
      () => compareMigrationVersions(["20261001000000_a.sql"], ["20261001000000", "20261001000000"]),
      /Duplicate hosted/,
    );
  });

  it("rejects incomplete, missing, unknown and malformed hosted ledgers", () => {
    assert.throws(() => parseAppliedVersions({ migrations: [] }), /Non-empty/);
    assert.throws(() => parseAppliedVersions({ items: [{ version: "20261001000000" }] }), /Non-empty/);
    assert.throws(() => parseAppliedVersions([{ version: "not-a-timestamp" }]), /Invalid hosted/);
    assert.throws(() => compareMigrationVersions([], ["20261001000000"]), /Missing migration/);
    assert.throws(() => compareMigrationVersions(["other.sql"], ["20261001000000"]), /Invalid migration filename/);
  });

  it("accepts a sanitized Supabase connector migration response", () => {
    assert.deepEqual(
      parseAppliedVersions({ migrations: [{ version: "20261001000000", name: "one" }] }),
      ["20261001000000"],
    );
  });
});
