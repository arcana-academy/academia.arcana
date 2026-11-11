export type PostHogConfig = {
  readonly key: string;
  readonly host: string | undefined;
};

export const POSTHOG_KEY_MISSING_MESSAGE =
  "NEXT_PUBLIC_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_KEY is configured";

/**
 * PostHog is optional: a missing key disables capture and never breaks the
 * build or boot. Next.js inlines `NEXT_PUBLIC_*` only for literal
 * `process.env.NAME` reads, so the names stay literal here.
 */
export function getPostHogConfig(): PostHogConfig | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  if (!key) return null;

  return {
    key,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || undefined,
  };
}
