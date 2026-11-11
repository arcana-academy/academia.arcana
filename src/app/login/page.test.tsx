import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth/AuthForm", () => ({
  AuthForm: () => null,
}));
vi.mock("@/lib/seo/site-metadata", () => ({
  pageMetadata: () => ({}),
}));

import LoginPage, { dynamic } from "./page";

afterEach(() => vi.unstubAllEnvs());

describe("personal login route", () => {
  it("is dynamically rendered to honor hosted runtime configuration", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("hides the sign-up link only in personal mode", () => {
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "true");
    expect(LoginPage().props.showSignUpLink).toBe(false);
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "");
    expect(LoginPage().props.showSignUpLink).toBe(true);
  });
});
