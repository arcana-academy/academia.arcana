import { PostHog } from "posthog-node";

import { getPostHogConfig, POSTHOG_KEY_MISSING_MESSAGE } from "./posthog-config";

let client: PostHog | null | undefined;

/** One client per Node.js process; `next start` keeps it alive between requests. */
function getPostHogServerClient(): PostHog | null {
  if (client !== undefined) return client;

  const config = getPostHogConfig();
  if (!config) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(POSTHOG_KEY_MISSING_MESSAGE);
    }
    client = null;
    return client;
  }

  client = new PostHog(config.key, { host: config.host });
  return client;
}

/** Analytics must never fail the request that records it. */
export function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  try {
    getPostHogServerClient()?.capture({ distinctId, event, properties });
  } catch {
    // Dropped event only.
  }
}
