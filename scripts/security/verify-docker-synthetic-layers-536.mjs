/**
 * C137: Docker build-context and image-layer synthetic canaries.
 * Never reads .env/.npmrc from the real checkout and never uses production secrets.
 * Builds only two tiny, disposable FROM scratch images; no network, no push.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const nonce = randomBytes(12).toString("hex");
const baseDir = mkdtempSync(path.join(tmpdir(), "aa-c137-synthetic-"));
const tagPrefix = "academiaarcana-c137-synthetic-" + nonce;
const hardenedTag = tagPrefix + "-hardened";
const controlTag = tagPrefix + "-control";
const dockerTags = [hardenedTag, controlTag];
const createdContainers = [];

const benign = "C137_BENIGN_ONLY_" + nonce;
const canaries = [
  { file: ".npmrc", marker: "C137_FAKE_ROOT_NPMRC_" + nonce },
  { file: "nested/.npmrc", marker: "C137_FAKE_NESTED_NPMRC_" + nonce },
  { file: ".env", marker: "C137_FAKE_ROOT_ENV_" + nonce },
  { file: ".env.testing", marker: "C137_FAKE_ROOT_ENV_VARIANT_" + nonce },
  { file: "nested/.env", marker: "C137_FAKE_NESTED_ENV_" + nonce },
  { file: "deep/nested/.env.production", marker: "C137_FAKE_DEEP_ENV_" + nonce },
];

function docker(args, phase, timeout = 90000) {
  const result = spawnSync("docker", args, {
    cwd: baseDir,
    encoding: "utf8",
    timeout,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, DOCKER_BUILDKIT: "1" },
  });
  if (result.error || result.status !== 0) {
    // Never echo subprocess output: the test intentionally introduces fake secret markers.
    throw new Error("Docker " + phase + " failed (exit=" +
      String(result.status ?? "unavailable") + ", timeout=" +
      String(result.error?.code === "ETIMEDOUT") + ")");
  }
  return result.stdout;
}

function makeContext(name, secure) {
  const context = path.join(baseDir, name);
  mkdirSync(context, { recursive: true });
  if (secure) {
    copyFileSync(path.join(root, ".dockerignore"), path.join(context, ".dockerignore"));
  } else {
    // Deliberately unsafe negative control: no exclusion rules, synthetic content only.
    writeFileSync(path.join(context, ".dockerignore"), "# Synthetic positive-leak control\n");
  }
  writeFileSync(path.join(context, "Dockerfile"), "FROM scratch\nCOPY . /c137/\n");
  writeFileSync(path.join(context, "benign.txt"), benign + "\n");
  for (const { file, marker } of canaries) {
    const dest = path.join(context, file);
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, marker + "\n");
  }
  return context;
}

function examineImage(tag, label) {
  const metadata = docker(["image", "inspect", "--format", "{{json .}}", tag], label + " inspect");
  const history = docker(["history", "--no-trunc", "--format", "{{.CreatedBy}}", tag], label + " history");
  const image = JSON.parse(metadata);
  assert.equal(image?.RootFS?.Type, "layers", label + ": expected image layers");
  assert.ok(Array.isArray(image.RootFS.Layers) && image.RootFS.Layers.length === 1,
    label + ": only a one-layer synthetic image can be attested by filesystem export");

  // Create but NEVER start a disposable container. Export its one-layer filesystem
  // as an uncompressed tar to avoid assuming docker save uses readable layer bytes.
  const containerId = docker(["container", "create", "--name",
    "aa-c137-" + nonce + "-" + label, tag, "/synthetic-never-run"], label + " create").trim();
  assert.match(containerId, /^[a-f0-9]{64}$/, label + ": invalid disposable container identity");
  createdContainers.push(containerId);
  const archivePath = path.join(baseDir, label + ".tar");
  docker(["container", "export", "--output", archivePath, containerId], label + " export", 120000);
  const archive = readFileSync(archivePath);

  // Scan the complete uncompressed export of this one-layer synthetic image.
  // The unsafe control proves the scanner actually observes synthetic file content.
  const scan = (marker) => archive.includes(Buffer.from(marker, "utf8"));
  assert.ok(scan(benign), label + ": benign marker missing, scan inconclusive");
  for (const { marker } of canaries) {
    assert.equal(history.includes(marker), false, label + ": marker in image history");
    assert.equal(metadata.includes(marker), false, label + ": marker in image metadata");
  }
  return { scan, layerCount: image.RootFS.Layers.length };
}

try {
  const secureContext = makeContext("hardened", true);
  const unsafeContext = makeContext("negative-control", false);
  docker(["build", "--network=none", "--pull=false", "--no-cache", "--progress=quiet",
    "--tag", hardenedTag, secureContext], "hardened build", 120000);
  docker(["build", "--network=none", "--pull=false", "--no-cache", "--progress=quiet",
    "--tag", controlTag, unsafeContext], "negative-control build", 120000);

  const hardened = examineImage(hardenedTag, "hardened");
  const control = examineImage(controlTag, "negative-control");

  for (const { file, marker } of canaries) {
    assert.equal(hardened.scan(marker), false, "Synthetic excluded file found in layer: " + file);
    assert.equal(control.scan(marker), true, "Negative control could not find file: " + file);
  }
  console.log("C137 PASS: synthetic root/nested .npmrc and .env files excluded from image layers");
  console.log("C137 PASS: image config and full creation history contain no synthetic markers");
  console.log("C137 PASS: deliberate unsafe control exposes every synthetic marker in archive");
  console.log("C137 PASS: hardened and control images have inspectable filesystem layers");
} finally {
  for (const id of createdContainers) {
    spawnSync("docker", ["container", "rm", "--force", id], {
      encoding: "utf8", timeout: 20000, maxBuffer: 1024 * 1024,
    });
  }
  for (const tag of dockerTags) {
    // Removing only our random, synthetic image tags; never touch application images.
    spawnSync("docker", ["image", "rm", "--force", tag], {
      encoding: "utf8",
      timeout: 20000,
      maxBuffer: 1024 * 1024,
    });
  }
  rmSync(baseDir, { recursive: true, force: true });
}
