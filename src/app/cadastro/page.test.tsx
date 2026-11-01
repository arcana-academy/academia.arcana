import { afterEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() => vi.fn(() => {
  throw new Error("NEXT_REDIRECT_TEST");
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/components/auth/AuthForm", () => ({
  AuthForm: () => null,
}));
vi.mock("@/lib/seo/site-metadata", () => ({
  pageMetadata: () => ({}),
}));

import CadastroPage, { dynamic } from "./page";

afterEach(() => vi.unstubAllEnvs());

describe("personal signup route", () => {
  it("is dynamically rendered to honor hosted runtime configuration", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("redirects signups to login in personal mode", () => {
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "true");
    expect(() => CadastroPage()).toThrow("NEXT_REDIRECT_TEST");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("preserves the original signup page outside personal mode", () => {
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "");
    redirectMock.mockClear();
    expect(CadastroPage().props.mode).toBe("signup");
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
