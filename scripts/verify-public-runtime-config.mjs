import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

const BUILD_ENV_FILES = [
  ".env.production.local",
  ".env.local",
  ".env.production",
  ".env",
];

export function loadBuildEnvironment(
  baseEnvironment = process.env,
  cwd = process.cwd(),
) {
  const environment = { ...baseEnvironment };

  for (const filename of BUILD_ENV_FILES) {
    const path = resolve(cwd, filename);

    if (!existsSync(path)) continue;

    const parsed = parseEnv(readFileSync(path, "utf8"));

    for (const [name, value] of Object.entries(parsed)) {
      if (!(name in environment)) environment[name] = value;
    }
  }

  return environment;
}

export function validateSupabaseProductionConfiguration(
  supabaseUrl,
  publishableKey,
) {
  let parsedUrl;

  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS Supabase project URL.",
    );
  }

  const isSupabaseProjectHostname = /^[a-z0-9]{20}\.supabase\.co$/.test(
    parsedUrl.hostname,
  );

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.port ||
    parsedUrl.pathname !== "/" ||
    parsedUrl.search ||
    parsedUrl.hash ||
    !isSupabaseProjectHostname
  ) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS Supabase project URL.",
    );
  }

  if (!/^sb_publishable_[A-Za-z0-9_-]{22}_[A-Za-z0-9_-]{8}$/.test(publishableKey)) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must use the expected sb_publishable_<22-char-random>_<8-char-checksum> format.",
    );
  }
}

/**
 * Explicit release gate for the hCaptcha-protected login/signup/recovery flow.
 * The public sitekey is a browser identifier. No secret is read or logged.
 * This flag is opt-in for a protected release; it does not change normal
 * branch builds or authorize enabling Supabase production CAPTCHA.
 */
export function verifyHCaptchaReleaseConfiguration(environment = process.env) {
  if (environment.ACADEMIA_ARCANA_REQUIRE_HCAPTCHA !== "1") {
    return { required: false };
  }

  const sitekey = environment.NEXT_PUBLIC_HCAPTCHA_SITEKEY?.trim() ?? "";
  const format = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  const publicTestSitekey = "10000000-ffff-ffff-ffff-000000000001";

  if (!format.test(sitekey) || sitekey.toLowerCase() === publicTestSitekey) {
    throw new Error(
      "hCaptcha release preflight failed: configure a non-test public sitekey before building.",
    );
  }

  return { required: true };
}

/**
 * Resolves the deployment label that is safe to print to stdout.
 *
 * The raw environment may contain secrets, so no value taken from it may
 * flow into the verification report. Only a fixed allowlist of well-known
 * deployment labels is returned, each as a literal; anything else collapses
 * to "unknown". This keeps `js/clear-text-logging` from tainting the CLI
 * output with arbitrary `process.env` data.
 */
export function resolveEnvironmentLabel(environment) {
  switch (environment.APP_ENV ?? environment.NODE_ENV) {
    case "production":
      return "production";
    case "preview":
      return "preview";
    case "development":
      return "development";
    case "test":
      return "test";
    case "staging":
      return "staging";
    default:
      return "unknown";
  }
}

export function verifyPublicRuntimeConfig(environment = loadBuildEnvironment()) {
  for (const name of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ]) {
    if (!environment[name]?.trim()) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
  }

  validateSupabaseProductionConfiguration(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  verifyHCaptchaReleaseConfiguration(environment);

  return {
    integration: "supabase-public-runtime",
    verified: true,
    environment: resolveEnvironmentLabel(environment),
    configuration: "environment",
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  console.log(JSON.stringify(verifyPublicRuntimeConfig(), null, 2));
}
