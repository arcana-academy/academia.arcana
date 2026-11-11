#!/usr/bin/env node
/**
 * Read-only release preflight. Compare an explicit, sanitized list of hosted
 * migration versions to this checkout's migration filenames. This does NOT
 * connect to a database, stamp versions, run SQL or change a remote service.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATION_FILE = /^(\d{14})_(.+)\.sql$/;
const MIGRATION_VERSION = /^\d{14}$/;

function uniqueVersions(versions, label) {
  const seen = new Set();
  for (const version of versions) {
    if (typeof version !== "string" || !MIGRATION_VERSION.test(version)) {
      throw new Error(`Invalid ${label} migration version`);
    }
    if (seen.has(version)) {
      throw new Error(`Duplicate ${label} migration version: ${version}`);
    }
    seen.add(version);
  }
  return seen;
}

/** Accepts version-only arrays or the Supabase MCP list_migrations envelope. */
export function parseAppliedVersions(value) {
  const records = Array.isArray(value) ? value : value?.migrations;
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("Non-empty hosted migration array required; refusing an empty or unknown ledger");
  }
  const versions = records.map((record) => {
    if (typeof record === "string") return record;
    return record && typeof record === "object" ? record.version : undefined;
  });
  uniqueVersions(versions, "hosted");
  return versions;
}

export function compareMigrationVersions(sourceFilenames, appliedVersions) {
  if (!Array.isArray(sourceFilenames) || sourceFilenames.length === 0) {
    throw new Error("Missing migration files: check repository checkout");
  }
  const sourceVersions = sourceFilenames.map((filename) => {
    const match = MIGRATION_FILE.exec(filename);
    if (!match) throw new Error(`Invalid migration filename: ${filename}`);
    return match[1];
  });
  const source = uniqueVersions(sourceVersions, "source");
  const applied = uniqueVersions(appliedVersions, "hosted");

  const appliedOnly = [...applied].filter((v) => !source.has(v)).sort();
  const sourceOnly = [...source].filter((v) => !applied.has(v)).sort();
  return {
    sourceCount: source.size,
    hostedCount: applied.size,
    matchedCount: source.size - sourceOnly.length,
    appliedOnly,
    sourceOnly,
    compatibleLedger: appliedOnly.length === 0 && sourceOnly.length === 0,
  };
}

function main(args) {
  if (args.length !== 1 || args[0].startsWith("-")) {
    throw new Error("Usage: node scripts/security/check-personal-migration-ledger.mjs /secure/path/versions-only.json");
  }
  const appliedVersions = parseAppliedVersions(JSON.parse(readFileSync(args[0], "utf8")));
  const migrationsDir = resolve(process.cwd(), "supabase/migrations");
  const files = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));
  const result = compareMigrationVersions(files, appliedVersions);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (!result.compatibleLedger) process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid ledger");
    process.exitCode = 1;
  }
}
