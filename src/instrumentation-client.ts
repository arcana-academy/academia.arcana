import posthog from "posthog-js";

import {
  getPostHogConfig,
  POSTHOG_KEY_MISSING_MESSAGE,
} from "@/lib/analytics/posthog-config";

const posthogConfig = getPostHogConfig();

if (posthogConfig) {
  posthog.init(posthogConfig.key, {
    api_host: posthogConfig.host,
    defaults: "2026-08-30",
  });
} else if (process.env.NODE_ENV === "development") {
  console.error(new Error(POSTHOG_KEY_MISSING_MESSAGE));
}
