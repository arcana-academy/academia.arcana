import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const script = resolve(
  repositoryRoot,
  "scripts/verify-canonical-infrastructure.cjs",
);

const SUCCESS_LINE =
  "Canonical infrastructure contract verified: GitHub + GitHub Actions + Render + Supabase.\n";

/** Everything the guard reads, so a copy behaves like the repository. */
const GUARDED_SURFACES = [
  ".github/workflows",
  ".gitignore",
  ".env.example",
  "package.json",
  "next.config.ts",
  "render.yaml",
  "src/core/config/deployment-platform.ts",
] as const;

const fixtures: string[] = [];

/** Copies the guarded surfaces into a disposable directory. */
function createRepositoryCopy(): string {
  const directory = mkdtempSync(join(tmpdir(), "aa-canonical-infra-"));
  fixtures.push(directory);

  for (const surface of GUARDED_SURFACES) {
    const destination = join(directory, surface);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(resolve(repositoryRoot, surface), destination, { recursive: true });
  }

  return directory;
}

/** Runs the guard with `directory` as the repository root. */
function runGuard(directory: string) {
  return spawnSync(process.execPath, [script], {
    cwd: directory,
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const directory of fixtures.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("canonical infrastructure executable guard", () => {
  it("passes against the repository's active infrastructure configuration", () => {
    const output = execFileSync(process.execPath, [script], {
      encoding: "utf8",
    });

    expect(output).toContain(
      "GitHub + GitHub Actions + Render + Supabase",
    );
    // A real line terminator, not the two characters backslash and "n".
    expect(output).toBe(SUCCESS_LINE);
  });

  it("passes against an unmodified copy of the guarded surfaces", () => {
    const directory = createRepositoryCopy();
    const workflows = readdirSync(join(directory, ".github/workflows"));

    // The negative cases below are only meaningful if the copy has workflows.
    expect(workflows.length).toBeGreaterThan(0);

    const result = runGuard(directory);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe(SUCCESS_LINE);
  });

  // The workflow walk once matched no file at all, so excluded providers in
  // any workflow passed unnoticed. Each case plants one in a scanned file.
  it.each([
    {
      label: "an excluded runtime provider in a .yml workflow",
      file: ".github/workflows/planted-preview.yml",
      content: "name: Deploy preview to Netlify\n",
      violation:
        "Netlify found in active application-runtime surface: .github/workflows/planted-preview.yml",
    },
    {
      label: "an excluded CI provider in a .yaml workflow",
      file: ".github/workflows/planted-pipeline.yaml",
      content: "name: Mirror the pipeline to CircleCI\n",
      violation:
        "CircleCI found in active ci-cd surface: .github/workflows/planted-pipeline.yaml",
    },
    {
      label: "an excluded hosting URL in a nested workflow configuration",
      file: ".github/workflows/nested/planted-target.json",
      content: '{ "target": "https://academia.pages.dev" }\n',
      violation:
        "forbidden hosting URL pattern found in active runtime surface: .github/workflows/nested/planted-target.json",
    },
  ])("rejects $label", ({ file, content, violation }) => {
    const directory = createRepositoryCopy();
    const planted = join(directory, file);
    mkdirSync(dirname(planted), { recursive: true });
    writeFileSync(planted, content);

    const result = runGuard(directory);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(
      `Canonical infrastructure contract violation: ${violation}`,
    );
  });

  it("ignores files that are not workflow configuration", () => {
    const directory = createRepositoryCopy();
    writeFileSync(
      join(directory, ".github/workflows/NOTES.md"),
      "Historical note: the project once evaluated Netlify.\n",
    );

    const result = runGuard(directory);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe(SUCCESS_LINE);
  });
});
