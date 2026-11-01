import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CANONICAL_INFRASTRUCTURE_PROVIDERS,
  CANONICAL_INFRASTRUCTURE_RULE,
} from "@/core/architecture/provider-policy";

const root = process.cwd();
const require = createRequire(import.meta.url);
const { assertFrozenBlueprint } = require(
  "../../scripts/security/read-blueprint-trigger.cjs",
) as { assertFrozenBlueprint: (root: string) => string };

const readRepoFile = (path: string) => readFileSync(resolve(root, path), "utf8");

// Indentation-scoped extraction: only live YAML and shell lines count as controls.
const releaseBlock = (source: string, heading: string, indentation: number) => {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const first = lines.findIndex((line) => line === " ".repeat(indentation) + heading);
  if (first < 0) return "";

  const end = lines.findIndex(
    (line, index) =>
      index > first &&
      line.trim() !== "" &&
      !line.trimStart().startsWith("#") &&
      (line.match(/^ */)?.[0].length ?? 0) <= indentation,
  );
  return lines
    .slice(first + 1, end < 0 ? lines.length : end)
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");
};

const releaseJob = (workflow: string, name: string) =>
  releaseBlock(releaseBlock(workflow, "jobs:", 0), name + ":", 2);

const releaseStep = (job: string, name: string) =>
  releaseBlock(releaseBlock(job, "steps:", 4), "- name: " + name, 6);

const releaseRun = (step: string) => releaseBlock(step, "run: |", 8);

describe("delivery infrastructure contract", () => {
  it("retains git-source smoke until the image deployment switch is enabled", () => {
    const workflow = readRepoFile(".github/workflows/production-smoke.yml").replaceAll(
      "\r\n",
      "\n",
    );

    expect(workflow).toContain('workflows: ["Academia Arcana Quality Gate", "Academia Arcana Image Release"]');
    expect(workflow).toContain("types: [completed]");
    expect(workflow).toContain("    branches:\n      - main");
    expect(workflow).toContain("github.event.workflow_run.head_repository.full_name == github.repository");
    expect(workflow).toContain("github.event.workflow_run.event == 'push'");
    expect(workflow).toContain("github.event.workflow_run.name == 'Academia Arcana Quality Gate'");
    expect(workflow).toContain("github.event.workflow_run.name == 'Academia Arcana Image Release'");
    expect(workflow).toContain("vars.RENDER_IMAGE_DEPLOY_ENABLED != 'true'");
    expect(workflow).toContain("vars.RENDER_IMAGE_DEPLOY_ENABLED == 'true'");
    expect(workflow).toContain("if: github.event_name == 'workflow_run' && github.event.workflow_run.name == 'Academia Arcana Image Release'");
    expect(workflow).toContain("academiaarcana-deploy-request");
    expect(workflow).toContain("name: Confirm image deployment really occurred");
    expect(workflow).toContain("needs: image_deployment");
    expect(workflow).toContain("needs.image_deployment.outputs.deployed == 'true'");
    expect(workflow).toContain('select(.name == "Request Render image deployment" and .conclusion == "success")');
    expect(workflow).toContain('select(.name == "academiaarcana-deploy-request" and .expired == false)');
  });

  it("keeps independent production smoke attempts from cancelling one another", () => {
    const workflow = readRepoFile(".github/workflows/production-smoke.yml");

    // A release triggered by the same upstream Quality Gate can finish with its
    // deploy job skipped; it must never cancel an in-flight Git-backed smoke.
    expect(workflow).not.toMatch(/^concurrency:/m);

    // Cover workflow-level and jobs.<name>.concurrency declarations, including
    // quoted values and expressions that may evaluate to true. Only explicit
    // false values are non-cancelling.
    const canCancelAnActiveSmoke = (source: string) =>
      source.split(/\r?\n/).some((line) => {
        const declaration = /^[ \t]*cancel-in-progress[ \t]*:[ \t]*(.*)$/i.exec(line);
        if (!declaration) return false;

        return !/^(?:false|"false"|'false'|\$\{\{\s*false\s*\}\})(?:[ \t]+#.*)?$/i.test(
          declaration[1].trim(),
        );
      });

    expect(canCancelAnActiveSmoke(workflow)).toBe(false);

    for (const value of [
      "false",
      '"false"',
      "'false'",
      '${{ false }}',
      "false # disabled",
    ]) {
      const config = [
        "jobs:",
        "  smoke:",
        "    concurrency:",
        "      group: smoke",
        `      cancel-in-progress: ${value}`,
      ].join("\n");

      expect(canCancelAnActiveSmoke(config)).toBe(false);
    }

    for (const value of [
      "true",
      '"true"',
      "'true'",
      '${{ inputs.cancel_smoke }}',
      "",
    ]) {
      const config = [
        "jobs:",
        "  smoke:",
        "    concurrency:",
        "      group: smoke",
        `      cancel-in-progress: ${value}`,
      ].join("\n");

      expect(canCancelAnActiveSmoke(config)).toBe(true);
    }

    expect(
      canCancelAnActiveSmoke("concurrency:\n  group: smoke\n  cancel-in-progress: true"),
    ).toBe(true);
    expect(workflow).toContain('workflows: ["Academia Arcana Quality Gate", "Academia Arcana Image Release"]');
    expect(workflow).toContain("github.event.workflow_run.name == 'Academia Arcana Image Release'");
    expect(workflow).toContain("github.event.workflow_run.name == 'Academia Arcana Quality Gate'");

    // An authorized operator can manually smoke the *actual deployed* revision
    // while main is ahead and Git auto-deploy is deliberately frozen.
    expect(workflow).toContain("expected_revision:");
    expect(workflow).toContain(
      "inputs.expected_revision || github.event.workflow_run.head_sha || github.sha",
    );
    expect(workflow).toContain('[[ "$expected" =~ ^[0-9a-f]{40}$ ]]');
  });

  it("freezes automatic Render promotion without weakening post-deploy smoke", () => {
    const blueprint = readRepoFile("render.yaml");
    const smoke = readRepoFile(".github/workflows/production-smoke.yml");

    // The smoke can only verify a revision after it is deployed. Neither
    // checksPass nor commit is acceptable under the current release NO-GO.
    // The trigger must be the quoted string "off": YAML 1.1 resolves a bare
    // `off` to boolean false, which does not satisfy Render's string enum.
    expect(blueprint).toContain('autoDeployTrigger: "off"');
    expect(blueprint).not.toMatch(/^\s*autoDeployTrigger:\s*off\s*$/m);
    expect(blueprint).not.toContain("autoDeployTrigger: checksPass");
    expect(blueprint).not.toContain("autoDeployTrigger: commit");
    expect(() => assertFrozenBlueprint(root)).not.toThrow();
    expect(smoke).toContain("body.revision !== expected");
  });

  it("requires an explicit deploy expectation for Git-backed smoke", () => {
    const workflow = readRepoFile(".github/workflows/production-smoke.yml");

    // Under NO-GO, a merge to main is frozen and no deployment follows it.
    // Requiring the smoke to observe head_sha would therefore fail forever.
    // The automatic Git-backed branch is gated on an unset repository variable.
    expect(workflow).toContain("vars.RENDER_DEPLOY_EXPECTED == 'true'");
    expect(workflow).toContain("vars.RENDER_IMAGE_DEPLOY_ENABLED != 'true'");
    expect(workflow).toContain("github.event.workflow_run.head_sha");
    expect(workflow).toContain(
      "inputs.expected_revision || github.event.workflow_run.head_sha || github.sha",
    );
    // Manual smoke against the actually deployed revision stays available.
    expect(workflow).toContain("expected_revision:");
    expect(workflow).toContain('[[ "$expected" =~ ^[0-9a-f]{40}$ ]]');
  });

  it("treats a Render cold-start HTML page as not-ready, not a revision mismatch", () => {
    const workflow = readRepoFile(".github/workflows/production-smoke.yml");

    // A sleeping Free instance can answer with "Application loading" HTML.
    // Cache-busters and an explicit JSON Accept header reduce that exposure,
    // and a non-JSON body must be retried rather than reported as a mismatch.
    expect(workflow).toContain("/api/health?probe=");
    expect(workflow).toContain("/api/ready?probe=");
    expect(workflow).toContain("-H 'Accept: application/json'");
    expect(workflow).toContain("try { body = JSON.parse(");
    expect(workflow).toContain("catch { process.exit(2); }");
    expect(workflow).toContain("Non-JSON health response");
    expect(workflow).toContain("body.revision !== expected");
  });

  it("validates workflow-derived production revisions before shell use", () => {
    const workflow = readRepoFile(".github/workflows/production-smoke.yml");

    expect(workflow).toContain("EXPECTED_COMMIT: ${{ steps.expected.outputs.commit }}");
    expect(workflow).toContain('expected_commit="$EXPECTED_COMMIT"');
    expect(workflow).toContain('[[ "$expected" =~ ^[0-9a-f]{40}$ ]]');
    expect(workflow).toContain('if [ "$EVENT_NAME" = "workflow_run" ] && [ "$TRIGGER_WORKFLOW" = "Academia Arcana Image Release" ]; then');
    expect(workflow).not.toContain('expected_commit="${{ steps.expected.outputs.commit }}"');
  });

  it("publishes only the image artifact built by a successful main Quality Gate", () => {
    const workflow = readRepoFile(".github/workflows/image-release.yml");

    expect(workflow).toContain('workflows: ["Academia Arcana Quality Gate"]');
    expect(workflow).toContain('UPSTREAM_RESULT: ${{ github.event.workflow_run.conclusion }}');
    expect(workflow).toContain('[ "$UPSTREAM_RESULT" != "success" ]');
    expect(workflow).toContain('UPSTREAM_EVENT: ${{ github.event.workflow_run.event }}');
    expect(workflow).toContain('[ "$UPSTREAM_EVENT" != "push" ]');
    expect(workflow).toContain('UPSTREAM_BRANCH: ${{ github.event.workflow_run.head_branch }}');
    expect(workflow).toContain('[ "$UPSTREAM_BRANCH" != "main" ]');
    expect(workflow).toContain('UPSTREAM_REPOSITORY: ${{ github.event.workflow_run.head_repository.full_name }}');
    expect(workflow).toContain('[ "$UPSTREAM_REPOSITORY" != "$GITHUB_REPOSITORY" ]');
    expect(workflow).toContain('UPSTREAM_ATTEMPT: ${{ github.event.workflow_run.run_attempt }}');
    expect(workflow).toContain('[ "$UPSTREAM_ATTEMPT" != "1" ]');
    expect(workflow).toContain("queue: max");
    expect(workflow).toContain('[[ ! "$UPSTREAM_WORKFLOW_PATH" =~ ^\\.github/workflows/quality\\.yml(@(refs/heads/)?main)?$ ]]');
    expect(workflow).toContain('.path == ".github/workflows/quality.yml@main"');
    expect(workflow).toContain('.path == ".github/workflows/quality.yml@refs/heads/main"');
    expect(workflow).toContain("name: Require approved dispatch run ID after environment gate");
    expect(workflow).toContain("APPROVED_RUN_ID: ${{ vars.RENDER_DEPLOY_APPROVED_RUN_ID }}");
    expect(workflow).toContain('[ "$APPROVED_RUN_ID" != "$ACTUAL_RUN_ID" ]');
    expect(workflow).toContain("vars.GHCR_PUBLISH_APPROVED_SHA != ''");
    expect(workflow).toContain("vars.GHCR_PUBLISH_APPROVED_SHA == needs.preflight.outputs.release_sha");
    expect(workflow).toContain("needs: preflight");
    expect(workflow).toContain("Reject stale main revision before publishing");
    expect(workflow).toContain("Reject stale main revision before deployment");
    expect(workflow).toContain("node /tmp/aa-render-image-target-guard.cjs");
    expect(workflow).toContain("RENDER_SERVICE_READ_API_KEY: ${{ secrets.RENDER_SERVICE_READ_API_KEY }}");
    expect(workflow).toContain("RENDER_IMAGE_SERVICE_ID: ${{ vars.RENDER_IMAGE_SERVICE_ID }}");
    expect(workflow).toContain("- name: Request Render image deployment");
    expect(workflow).not.toContain("--data-urlencode");
    expect(workflow).toContain("academiaarcana-deploy-request");
    expect(workflow).toContain("packages: write");
    expect(workflow).toContain("steps.publish_image.outputs.image_url");
    expect(workflow).toContain("UPSTREAM_RUN_ID:");
    expect(workflow).toContain('unique_tag="${image}:${IMAGE_REVISION}-run-${UPSTREAM_RUN_ID}"');
    expect(workflow).toContain("digest: (sha256:[0-9a-f]{64})");
    expect(workflow).toContain("image_url=%s@%s");
    expect(workflow).toContain("IMAGE_URL: ${{ needs.publish.outputs.image_url }}");
    expect(workflow).toContain("vars.RENDER_IMAGE_DEPLOY_ENABLED == 'true'");
    expect(workflow).toContain("secrets.RENDER_DEPLOY_HOOK_URL");
    expect(workflow).not.toContain("docker build");
  });

  it("rejects workflow_dispatch unless the trusted main ref is checked in preflight", () => {
    const workflow = readRepoFile(".github/workflows/image-release.yml");
    const step = releaseStep(
      releaseJob(workflow, "preflight"),
      "Verify trusted source for event or explicit promotion",
    );
    expect(step).not.toBe("");

    const env = releaseBlock(step, "env:", 8);
    const run = releaseRun(step);
    expect(env).toMatch(/^\s*RELEASE_EVENT:\s*\x24\{\{ github\.event_name \}\}\s*$/m);
    expect(env).toMatch(/^\s*RELEASE_REF:\s*\x24\{\{ github\.ref \}\}\s*$/m);
    expect(run).toMatch(
      /elif \[ "\$RELEASE_EVENT" = "workflow_dispatch" \]; then\s+if \[ "\$RELEASE_REF" != "refs\/heads\/main" \]; then[\s\S]*?\bexit 1\s+fi/,
    );
  });

  it("validates the original Quality Gate API run SHA, attempt, and conclusion", () => {
    const workflow = readRepoFile(".github/workflows/image-release.yml");
    const step = releaseStep(
      releaseJob(workflow, "preflight"),
      "Verify trusted source for event or explicit promotion",
    );
    const run = releaseRun(step);
    expect(run).toMatch(
      /run_json="\$\(gh api "\/repos\/\x24\{GITHUB_REPOSITORY\}\/actions\/runs\/\x24\{run_id\}"\)"/,
    );
    const filter = run.match(
      /\|\s*jq -e\s*\\\s*--arg revision "\$revision"\s*\\\s*--arg repository "\$GITHUB_REPOSITORY"\s+'([\s\S]*?)'\s*>\/dev\/null;\s*then/,
    )?.[1] ?? "";
    expect(filter).not.toBe("");
    expect(filter).toMatch(/^\s*\.head_sha == \$revision and\s*$/m);
    expect(filter).toMatch(/^\s*\.run_attempt == 1 and\s*$/m);
    expect(filter).toMatch(/^\s*\.conclusion == "success"\s*$/m);
  });

  it("downloads the immutable public preflight without redirects or GitHub tokens", () => {
    const workflow = readRepoFile(".github/workflows/image-release.yml");
    const deploy = releaseJob(workflow, "deploy");
    const step = releaseStep(
      deploy,
      "Fetch immutable public preflight from approved main SHA",
    );
    expect(step).not.toBe("");
    expect(deploy).toMatch(/^ {4}permissions: \{\}\s*$/m);

    const env = releaseBlock(step, "env:", 8);
    const run = releaseRun(step);
    expect(env).toMatch(/^\s*EXPECTED_REVISION:\s*\x24\{\{ needs\.preflight\.outputs\.release_sha \}\}\s*$/m);
    const download = run.match(
      /^\s*curl --fail[^\n]*\\\s*--output \S+\s*\\\s*"https:\/\/raw\.githubusercontent\.com\/\x24\{GITHUB_REPOSITORY\}\/\x24\{EXPECTED_REVISION\}\/scripts\/security\/verify-render-image-target-536\.cjs"/m,
    )?.[0] ?? "";
    expect(download).not.toBe("");
    expect(download).toMatch(/(?:^|\s)--max-redirs\s+0(?:\s|\\)/);
    expect(download).toContain("--proto '=https'");
    expect(env + run).not.toMatch(/\b(?:GITHUB_TOKEN|GH_TOKEN)\b/);
  });

  it("gates only the deploy job on an explicit workflow_dispatch", () => {
    const workflow = readRepoFile(".github/workflows/image-release.yml");
    const deploy = releaseJob(workflow, "deploy");
    expect(deploy).not.toBe("");
    expect(deploy).toMatch(/^ {4}timeout-minutes: 25\s*$/m);
    const condition = releaseBlock(deploy, "if: >-", 4);
    expect(condition).not.toBe("");
    expect(condition).toMatch(/^\s*github\.event_name == 'workflow_dispatch'\s*$/m);
    expect(condition).not.toMatch(/\|\||\bworkflow_run\b/);
  });

  it("ignores security checks preserved only as comments or in other jobs", () => {
    const workflow = readRepoFile(".github/workflows/image-release.yml");
    const commented = workflow
      .replace(
        '            if [ "$RELEASE_REF" != "refs/heads/main" ]; then',
        '            # if [ "$RELEASE_REF" != "refs/heads/main" ]; then',
      )
      .replace(
        "                   .head_sha == $revision and",
        "                   # .head_sha == $revision and",
      );
    const run = releaseRun(
      releaseStep(
        releaseJob(commented, "preflight"),
        "Verify trusted source for event or explicit promotion",
      ),
    );
    expect(run).not.toMatch(/^\s*if \[ "\$RELEASE_REF" != "refs\/heads\/main" \]; then/m);
    expect(run).not.toMatch(/^\s*\.head_sha == \$revision and/m);
    expect(
      releaseStep(
        releaseJob(workflow, "publish"),
        "Fetch immutable public preflight from approved main SHA",
      ),
    ).toBe("");
  });

  it("invokes the verified Render guard only inside the deploy request step", () => {
    const workflow = readRepoFile(".github/workflows/image-release.yml");
    const deploy = releaseJob(workflow, "deploy");
    const request = releaseStep(deploy, "Request Render image deployment");

    expect(request).not.toBe("");
    expect(request).toMatch(/^\s*node \/tmp\/aa-render-image-target-guard\.cjs\s*$/m);
    expect(request).toContain("RENDER_DEPLOY_HOOK_URL: ${{ secrets.RENDER_DEPLOY_HOOK_URL }}");
    expect(request).toContain("RENDER_SERVICE_READ_API_KEY: ${{ secrets.RENDER_SERVICE_READ_API_KEY }}");
    expect(request).toContain("RENDER_DEPLOY_API_KEY: ${{ secrets.RENDER_DEPLOY_API_KEY }}");
    expect(request).toContain("RENDER_IMAGE_SERVICE_ID: ${{ vars.RENDER_IMAGE_SERVICE_ID }}");
    expect(request).not.toMatch(/\bcurl\b/);
  });

  it("uses Render's authenticated deploy API with exact 201 ID, never a hook lookup", () => {
    const guard = readRepoFile("scripts/security/verify-render-image-target-536.cjs");
    const request = releaseStep(
      releaseJob(readRepoFile(".github/workflows/image-release.yml"), "deploy"),
      "Request Render image deployment",
    );
    expect(guard).toContain('"https://api.render.com/v1/services/" + inputs.approvedServiceId + "/deploys"');
    expect(guard).toContain('method: "POST"');
    expect(guard).toContain("Authorization: \"Bearer \" + inputs.deployApiKey");
    expect(guard).toContain('body: JSON.stringify({ imageUrl: inputs.imageUrl, clearCache: "do_not_clear" })');
    expect(guard).toContain("response.status !== 201");
    expect(guard).toContain("response?.status === 202");
    expect(guard).not.toContain("hook.searchParams.set");
    expect(guard).not.toContain("fetchService(hook.toString()");
    expect(request).toContain("RENDER_DEPLOY_API_KEY");
    expect(guard).toContain("Create exactly one deployment through the authenticated API.");
    expect(request).not.toMatch(/fetch\([^\n]*\/deploy\//);
  });

  it("preserves the documented 30-day approved image promotion window", () => {
    const quality = readRepoFile(".github/workflows/quality.yml");
    const upload = quality.split("      - name: Upload production image artifact\n")[1]
      ?.split("\n      - name:")[0] ?? "";
    expect(upload).toContain('name: academiaarcana-image-${{ github.sha }}');
    expect(upload).toMatch(/^\s*retention-days: 30\s*$/m);
    const instructions = readRepoFile("docs/deployment/render.md");
    expect(instructions).toContain("30-day promotion window");
    expect(instructions).toContain("are **not** extended retroactively");
  });

  it("documents all explicit GHCR and Render manual promotion gates", () => {
    const instructions = readRepoFile("docs/deployment/render.md");
    for (const key of [
      "GHCR_PUBLISH_APPROVED_SHA",
      "RENDER_IMAGE_DEPLOY_ENABLED",
      "RENDER_IMAGE_SERVICE_ID",
      "RENDER_DEPLOY_APPROVED_RUN_ID",
      "RENDER_DEPLOY_HOOK_URL",
      "RENDER_SERVICE_READ_API_KEY",
      "RENDER_DEPLOY_API_KEY",
      "approved_revision",
      "quality_run_id",
      "render-production-approval",
    ]) {
      expect(instructions).toContain(`\`${key}\``);
    }
    expect(instructions).toContain("after dispatch");
    expect(instructions).toContain("NO-GO remains in force");
  });

  it("defines one canonical provider for each infrastructure responsibility", () => {
    const roles = CANONICAL_INFRASTRUCTURE_PROVIDERS.map((item) => item.role);

    expect(new Set(roles).size).toBe(4);
    expect(CANONICAL_INFRASTRUCTURE_PROVIDERS).toHaveLength(4);
    expect(CANONICAL_INFRASTRUCTURE_RULE).toContain("one canonical platform");
    expect(CANONICAL_INFRASTRUCTURE_PROVIDERS.map((item) => item.provider)).toEqual([
      "GitHub",
      "GitHub Actions",
      "Render",
      "Supabase",
    ]);
  });

  it("has no active legacy hosting configuration", () => {
    expect(existsSync(resolve(root, "netlify.toml"))).toBe(false);
    expect(existsSync(resolve(root, ".github/workflows/nextjs.yml"))).toBe(false);
  });

  it("targets Render from the production smoke workflow", () => {
    const workflow = readRepoFile(".github/workflows/production-smoke.yml");

    expect(workflow).toContain("https://academiaarcana.onrender.com");
    expect(workflow).not.toMatch(/Netlify/i);
  });

  it("declares the canonical Render web service contract", () => {
    const blueprint = readRepoFile("render.yaml");

    for (const expected of [
      "name: academiaarcana",
      "type: web",
      "runtime: node",
      "branch: main",
      'autoDeployTrigger: "off"',
      "buildCommand: node scripts/security/assert-build-secret-isolation-536.cjs && node scripts/verify-dependency-lifecycle-scripts.cjs && npm ci --ignore-scripts && npm rebuild unrs-resolver --ignore-scripts=false && npm run build",
      "startCommand: npm start",
      "healthCheckPath: /api/health",
      "NPM_CONFIG_IGNORE_SCRIPTS",
      'value: "true"',
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "sync: false",
    ]) {
      expect(blueprint).toContain(expected);
    }

    expect(blueprint).not.toContain("autoDeployTrigger: checksPass");
    expect(blueprint).not.toMatch(/service_role|sb_secret_/i);
    expect(blueprint).not.toMatch(/Netlify/i);
  });

  it("keeps deployment metadata provider-neutral", () => {
    const activeFiles = [
      "scripts/verify-public-runtime-config.mjs",
      "honeybadger.browser.config.js",
      "honeybadger.edge.config.js",
      "honeybadger.server.config.js",
    ];

    for (const path of activeFiles) {
      const content = readRepoFile(path);
      expect(content).not.toMatch(/NETLIFY/i);
    }
  });

  it("builds the image without local environment files or runtime secrets", () => {
    const dockerfile = readRepoFile("Dockerfile");
    const dockerignore = readRepoFile(".dockerignore");
    const quality = readRepoFile(".github/workflows/quality.yml");

    expect(dockerignore).toContain(".env.*");
    expect(dockerignore).toContain("*.pem");
    expect(dockerignore).toContain("*.key");
    expect(dockerfile).toContain("AS builder");
    expect(dockerfile).toContain("AS runtime");
    expect(dockerfile).toContain("npm prune --omit=dev --ignore-scripts");
    expect(dockerfile).toContain("COPY --from=builder --chown=node:node /app /app");
    expect(dockerfile).toContain("USER node");
    expect(dockerfile).toContain("ARG NEXT_PUBLIC_HONEYBADGER_API_KEY");
    expect(dockerfile).toContain("ARG NEXT_PUBLIC_HONEYBADGER_ASSETS_URL");
    expect(quality).toContain("vars.NEXT_PUBLIC_HONEYBADGER_API_KEY");
    expect(quality).toContain("vars.NEXT_PUBLIC_HONEYBADGER_ASSETS_URL");
    expect(dockerfile).toContain("ARG NEXT_PUBLIC_SUPABASE_URL");
    expect(dockerfile).toContain("ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    expect(dockerfile).toContain("ARG ACADEMIA_ARCANA_REVISION");
    expect(quality).toContain("docker build --platform linux/amd64");
    expect(quality).toContain("name: Verify production public configuration");
    expect(quality).toContain("node scripts/verify-public-runtime-config.mjs");
    expect(quality).not.toContain("secrets.");
  });

  it("starts the built runtime image before permitting a main image artifact", () => {
    const workflow = readRepoFile(".github/workflows/quality.yml");
    const smoke = readRepoFile("scripts/smoke-production-container.sh");

    expect(workflow).toContain("Smoke test isolated production image");
    expect(workflow.indexOf("Smoke test isolated production image")).toBeGreaterThan(
      workflow.indexOf("Build production image"),
    );
    expect(workflow.indexOf("Smoke test isolated production image")).toBeLessThan(
      workflow.indexOf("Save production image artifact"),
    );
    expect(smoke).toContain("docker run --detach --rm");
    expect(smoke).toContain("--cap-drop ALL");
    expect(smoke).toContain("no-new-privileges");
    expect(smoke).toContain("docker exec");
    expect(smoke).toContain("OPENAI_API_KEY");
    expect(smoke).toContain("/api/health");
    expect(smoke).toContain("response.revision !== revision");
    expect(smoke).toContain("docker rm --force");
  });

  it("propagates every public build-time variable into the production image", () => {
    const dockerfile = readRepoFile("Dockerfile");
    const quality = readRepoFile(".github/workflows/quality.yml");
    const blueprint = readRepoFile("render.yaml");

    for (const name of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "NEXT_PUBLIC_APP_URL",
      "NEXT_PUBLIC_ADOBE_FONTS_KIT_ID",
      "NEXT_PUBLIC_HCAPTCHA_SITEKEY",
      "NEXT_PUBLIC_HONEYBADGER_API_KEY",
      "NEXT_PUBLIC_HONEYBADGER_ASSETS_URL",
    ]) {
      // `NEXT_PUBLIC_*` values are inlined at build time, so each of them must
      // reach the image build and the runtime environment.
      expect(dockerfile).toContain(`ARG ${name}`);
      expect(dockerfile).toContain(`${name}=\${${name}}`);
      expect(quality).toContain(`--build-arg ${name}=`);

      if (name === "NEXT_PUBLIC_APP_URL" || name === "NEXT_PUBLIC_ADOBE_FONTS_KIT_ID" || name === "NEXT_PUBLIC_HCAPTCHA_SITEKEY") {
        expect(blueprint).toContain(`key: ${name}`);
      }
    }

    expect(blueprint).not.toMatch(/sb_secret_|service_role|HCAPTCHA_SECRET\s*:/i);
    expect(quality).toContain("vars.NEXT_PUBLIC_HCAPTCHA_SITEKEY");
  });

  it("ships declared application icons so browsers never request a missing favicon", () => {
    expect(existsSync(resolve(root, "src/app/favicon.ico"))).toBe(true);
    expect(existsSync(resolve(root, "src/app/icon.svg"))).toBe(true);
  });

  it("blocks equivalent hosting and CI platforms from active delivery files", () => {
    const activeFiles = [
      ".github/workflows/quality.yml",
      ".github/workflows/production-smoke.yml",
      "render.yaml",
      "package.json",
      ".gitignore",
      "next.config.ts",
    ];

    const forbidden = CANONICAL_INFRASTRUCTURE_PROVIDERS.flatMap(
      (item) => item.disallowedAlternatives,
    );

    for (const path of activeFiles) {
      const content = readRepoFile(path);
      for (const provider of forbidden) {
        expect(content).not.toContain(provider);
      }
    }
  });
});
