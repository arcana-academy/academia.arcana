import { afterEach, describe, expect, it, vi } from "vitest";

const { redirectMock, getClaimsMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(() => {
    throw new Error("NEXT_REDIRECT_TEST");
  }),
  getClaimsMock: vi.fn(async () => ({ data: { claims: null as { sub: string } | null } })),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: getClaimsMock } }),
}));
vi.mock("@/lib/seo/site-metadata", () => ({ pageMetadata: () => ({}) }));
vi.mock("@/components/generated/AcademiaArcanaLanding", () => ({
  AcademiaArcanaLanding: () => null,
}));

import Page from "./page";

afterEach(() => {
  vi.unstubAllEnvs();
  redirectMock.mockClear();
  getClaimsMock.mockClear();
});

describe("Academia Arcana home routing", () => {
  it("sends authenticated visitors to the Sanctuary", async () => {
    getClaimsMock.mockResolvedValueOnce({ data: { claims: { sub: "synthetic-user" } } });
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT_TEST");
    expect(redirectMock).toHaveBeenCalledWith("/santuario");
  });

  it("sends unauthenticated visitors to login in personal mode", async () => {
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "true");
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT_TEST");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("starts with login only for opt-in synthetic local QA", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ACADEMIA_ARCANA_LOCAL_PREVIEW", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT_TEST");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("does not enable local preview against a hosted database", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ACADEMIA_ARCANA_LOCAL_PREVIEW", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "");
    const result = await Page();
    expect(result.props.personalMode).toBe(false);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("preserves the public landing outside personal and local QA modes", async () => {
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "");
    vi.stubEnv("ACADEMIA_ARCANA_LOCAL_PREVIEW", "");
    const result = await Page();
    expect(result.props.personalMode).toBe(false);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
