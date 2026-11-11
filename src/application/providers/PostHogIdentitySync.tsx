"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

import type { ApplicationIdentityState } from "@/application/identity/contracts";
import { getPostHogConfig } from "@/lib/analytics/posthog-config";

type PostHogIdentitySyncProps = {
  identity: ApplicationIdentityState;
};

/**
 * The root layout resolves identity on every server render, including the
 * `router.refresh()` after login and the redirect after sign-out, so this
 * keeps the PostHog person in step with the Supabase subject.
 */
export function PostHogIdentitySync({ identity }: PostHogIdentitySyncProps) {
  const subjectId =
    identity.status === "authenticated" ? identity.identity?.subjectId ?? null : null;
  const isAnonymous = identity.status === "anonymous";

  useEffect(() => {
    if (!getPostHogConfig()) return;

    if (subjectId) {
      posthog.identify(subjectId);
    } else if (isAnonymous && posthog._isIdentified()) {
      posthog.reset();
    }
  }, [subjectId, isAnonymous]);

  return null;
}
