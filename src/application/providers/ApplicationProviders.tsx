"use client";

import type { ReactNode } from "react";

import {
  AccessibilityPreferencesProvider,
} from "@/application/accessibility-preferences/AccessibilityPreferencesContext";
import type { ApplicationIdentityState } from "@/application/identity/contracts";
import { FlontsProvider } from "@/application/flonts/FlontsProvider";
import { PostHogIdentitySync } from "@/application/providers/PostHogIdentitySync";
import { VisualAccessibilityProvider } from "@/components/accessibility/AccessibilityPanel";
import { ThemeProvider } from "@/design-system/themes";

import type {
  AuthenticatedAccessibilityPreferencesRepository,
} from "@/core/accessibility-preferences/contracts";

import {
  createLocalAccessibilityPreferencesRepository,
  motionEnvironment,
} from "@/lib/accessibility-preferences";

type ApplicationProvidersProps = {
  children: ReactNode;
  identity: ApplicationIdentityState;
  authenticated?: AuthenticatedAccessibilityPreferencesRepository;
};

export function ApplicationProviders({
  children,
  identity,
  authenticated,
}: ApplicationProvidersProps) {
  const local =
    createLocalAccessibilityPreferencesRepository();

  return (
    <ThemeProvider followSystem>
      <VisualAccessibilityProvider>
      <AccessibilityPreferencesProvider
        local={local}
        authenticated={authenticated}
        motionEnvironment={motionEnvironment}
        identity={identity}
      >
        <FlontsProvider>
          <PostHogIdentitySync identity={identity} />
          {children}
        </FlontsProvider>
      </AccessibilityPreferencesProvider>
      </VisualAccessibilityProvider>
    </ThemeProvider>
  );
}
