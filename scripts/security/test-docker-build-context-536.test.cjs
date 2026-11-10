/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

// C143: source-only assertions; the Docker Engine synthetic layer test is a separate check.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "../..");
const ignoreFile = path.join(root, ".dockerignore");
const dockerFile = path.join(root, "Dockerfile");

function activePatterns() {
  return fs.readFileSync(ignoreFile, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

test("C133 excludes npm and environment credential files at every context depth", () => {
  const rules = activePatterns();
  // Docker documents ** as matching any number of directories, including zero.
  // The filenames below are synthetic; no actual credentials are read.
  for (const expected of ["**/.npmrc", "**/.env", "**/.env.*"]) {
    assert.ok(rules.includes(expected), `Missing build-context exclusion: ${expected}`);
  }
  assert.equal(
    rules.some((line) => line.startsWith("!")),
    false,
    "Review negate/re-include rules before claiming sensitive-file exclusions",
  );
  assert.equal(
    fs.existsSync(path.join(root, "Dockerfile.dockerignore")),
    false,
    "A Dockerfile-specific ignore file overrides the root .dockerignore",
  );
});

test("C133 protects the existing recursive COPY without changing the image recipe", () => {
  const source = fs.readFileSync(dockerFile, "utf8");
  assert.match(source, /^COPY \. \.$/m);
  assert.match(source, /^COPY package\.json package-lock\.json \.\/$/m);
  const pinnedStages = [...source.matchAll(
    /^FROM --platform=linux\/amd64 node:24-bookworm-slim@sha256:([a-f0-9]{64}) AS (builder|runtime)$/gm,
  )];
  assert.deepEqual(pinnedStages.map((match) => match[2]), ["builder", "runtime"]);
  assert.equal(
    [...source.matchAll(/^FROM\s+.+$/gm)].length,
    pinnedStages.length,
    "Every image stage must use a fully pinned 64-hex SHA-256 digest",
  );
  assert.equal(pinnedStages[0][1], pinnedStages[1][1], "Build and runtime digests must match");
});

test("C143 runs the build guard when a Dockerfile-specific ignore override changes", () => {
  const workflow = fs.readFileSync(
    path.join(root, ".github/workflows/build-secret-isolation-contract-536.yml"),
    "utf8",
  );
  assert.match(workflow, /^\s+- Dockerfile\.dockerignore\s*$/m);
});

function c145VerifyPrSecurityWorkflow(source) {
  const pathsBlock = source.match(/^    paths:\r?\n((?:      - [^\r\n]+\r?\n)+)/m);
  assert.ok(pathsBlock, "Missing explicit pull_request paths filter");
  const watched = pathsBlock[1].split(/\r?\n/).map((line) => line.trim().replace(/^- /, ""));
  for (const filename of [
    "Dockerfile.dockerignore",
    ".dockerignore",
    ".github/workflows/build-secret-isolation-contract-536.yml",
    ".github/workflows/fallback-validation-536.yml",
    "scripts/security/test-docker-build-context-536.test.cjs",
  ]) {
    assert.ok(watched.includes(filename), "CI security gate not triggered by " + filename);
  }
  assert.match(source, /^          ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}$/m);
  assert.match(source, /^          persist-credentials: false$/m);
  assert.match(source, /^        run: test "\$\(git rev-parse HEAD\)" = "\$EXPECTED_SHA"$/m);
  assert.match(source, /^        run: test "\$HEAD_REPO" = "\$GITHUB_REPOSITORY"$/m);
  assert.match(source,
    /^        run: node --test scripts\/security\/test-build-secret-isolation-536\.test\.cjs scripts\/security\/test-docker-build-context-536\.test\.cjs$/m);
}

function c145VerifyFallbackBuildGate(source) {
  const start = source.indexOf("      - name: Check immutable provenance and build-only overlay");
  const build = source.indexOf("      - name: Build fallback Docker image without runtime secrets");
  assert.ok(start !== -1 && build > start, "Missing ordered fallback prebuild step");
  const nextStep = source.indexOf("\n      - name: ", start + 10);
  assert.ok(nextStep > start && nextStep < build, "Missing bounded prebuild gate");
  const gate = source.slice(start, nextStep);
  assert.match(source, /^      STABLE_SHA: 17fb81477fbd3eed14b93103641004a766eb9ac1$/m);
  assert.match(source, /^      BASELINE_SHA: cc17653dfe79c44dd83ba1ced8cb065383b11ca9$/m);
  assert.match(gate, /^          test "\$\(git -C stable rev-parse HEAD\)" = "\$STABLE_SHA"$/m);
  assert.match(gate, /^          test "\$\(git -C reviewed-recipe rev-parse HEAD\)" = "\$BASELINE_SHA"$/m);
  const recipeCopy = gate.indexOf("cp reviewed-recipe/.dockerignore stable/.dockerignore");
  const recipeCompare = gate.indexOf("cmp reviewed-recipe/.dockerignore stable/.dockerignore");
  const overrideGuard = gate.indexOf("test ! -e stable/Dockerfile.dockerignore");
  const overlay = gate.indexOf("cat >> stable/.dockerignore <<'C144_FALLBACK_IGNORE_OVERLAY'");
  const overlayEnd = gate.indexOf("\n          C144_FALLBACK_IGNORE_OVERLAY", overlay);
  const postChecks = gate.indexOf("for pattern in '**/.npmrc' '**/.env' '**/.env.*'; do");
  const hash = gate.indexOf("sha256sum stable/Dockerfile stable/.dockerignore stable/scripts/smoke-production-container.sh");
  assert.ok(recipeCopy !== -1 && recipeCompare > recipeCopy &&
    overrideGuard > recipeCompare && overlay > overrideGuard &&
    overlayEnd > overlay && postChecks > overlayEnd &&
    hash > postChecks, "Fallback security checks must precede build and preserve historical recipe provenance");
  const patterns = gate.slice(overlay, overlayEnd).split(/\r?\n/).map((line) => line.trim());
  for (const filename of ["**/.npmrc", "**/.env", "**/.env.*"]) {
    assert.ok(patterns.includes(filename), "Fallback overlay missing recursive rule: " + filename);
  }
  assert.match(gate, /^            grep -Fxq -- "\$pattern" stable\/\.dockerignore$/m);
  assert.match(gate, /^          test -z "\$\(git -C stable diff --name-only\)"$/m);
  const refuse = "if grep -Eq '^[[:space:]]*!' stable/.dockerignore; then";
  const blocks = gate.split(refuse).slice(1);
  assert.equal(blocks.length, 2, "Require negation checks before and after overlay");
  for (const block of blocks) {
    assert.match(block, /^\r?\n            echo "[^\r\n]+" >&2\r?\n            exit 1\r?\n          fi/m,
      "Fail-closed guard must exit nonzero on negation");
  }
}

test("C145 PR gate observes fallback changes and checks exact trusted source SHA", () => {
  const source = fs.readFileSync(
    path.join(root, ".github/workflows/build-secret-isolation-contract-536.yml"), "utf8");
  c145VerifyPrSecurityWorkflow(source);
});

test("C145 fallback prebuild gate preserves pinned provenance and required exclusions", () => {
  const source = fs.readFileSync(
    path.join(root, ".github/workflows/fallback-validation-536.yml"), "utf8");
  c145VerifyFallbackBuildGate(source);
});

test("C145 negative CI contract catches omitted triggers and disabled fallback guards", () => {
  const ci = fs.readFileSync(
    path.join(root, ".github/workflows/build-secret-isolation-contract-536.yml"), "utf8");
  const fallback = fs.readFileSync(
    path.join(root, ".github/workflows/fallback-validation-536.yml"), "utf8");
  assert.throws(() => c145VerifyPrSecurityWorkflow(
    ci.replace(/^      - \.github\/workflows\/fallback-validation-536\.yml\r?\n/m, "")),
  );
  assert.throws(() => c145VerifyPrSecurityWorkflow(
    ci.replace(/^      - Dockerfile\.dockerignore\r?\n/m, "")),
  );
  assert.throws(() => c145VerifyFallbackBuildGate(
    fallback.replace(/^          \*\*\/\.npmrc\r?\n/m, "")),
  );
  assert.throws(() => c145VerifyFallbackBuildGate(
    fallback.replace("          test ! -e stable/Dockerfile.dockerignore", "          true"),
  ));
  assert.throws(() => c145VerifyFallbackBuildGate(
    fallback.replace("            exit 1", "            :"),
  ));
});
