/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const lockPath = path.join(root, "package-lock.json");
const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));

if (lock.lockfileVersion !== 3) {
  throw new Error(
    `Expected package-lock lockfileVersion 3, received ${String(lock.lockfileVersion)}.`,
  );
}

const allowedInstallScripts = new Map([
  ["node_modules/core-js", "3.51.0"],
  ["node_modules/fsevents", "2.3.3"],
  ["node_modules/unrs-resolver", "1.12.2"],
]);

const packages = lock.packages ?? {};
const installScriptPackages = [];

for (const [packagePath, metadata] of Object.entries(packages)) {
  if (!packagePath) continue;

  if (metadata.link === true) continue;

  if (
    typeof metadata.resolved !== "string" ||
    typeof metadata.integrity !== "string"
  ) {
    throw new Error(
      `Dependency entry is missing resolved or integrity metadata: ${packagePath}`,
    );
  }

  if (!metadata.resolved.startsWith("https://registry.npmjs.org/")) {
    throw new Error(
      `Non-registry dependency source is not allowlisted: ${packagePath} -> ${metadata.resolved}`,
    );
  }

  if (metadata.hasInstallScript === true) {
    installScriptPackages.push({
      packagePath,
      version: metadata.version ?? null,
    });
  }
}

for (const entry of installScriptPackages) {
  const expectedVersion = allowedInstallScripts.get(entry.packagePath);
  if (!expectedVersion) {
    throw new Error(
      `Unreviewed dependency lifecycle script detected: ${entry.packagePath}@${entry.version ?? "unknown"}`,
    );
  }
  if (entry.version !== expectedVersion) {
    throw new Error(
      `Lifecycle-script dependency changed version without review: ${entry.packagePath}@${entry.version ?? "unknown"} (expected ${expectedVersion})`,
    );
  }
}

for (const [packagePath, expectedVersion] of allowedInstallScripts) {
  const metadata = packages[packagePath];
  if (
    !metadata ||
    metadata.hasInstallScript !== true ||
    metadata.version !== expectedVersion
  ) {
    throw new Error(
      `Reviewed lifecycle-script dependency contract changed: ${packagePath}@${expectedVersion}`,
    );
  }
}

console.log(
  `Dependency lifecycle boundary verified: ${installScriptPackages.length} reviewed install-script packages, registry-only resolved sources, integrity metadata present.`,
);
