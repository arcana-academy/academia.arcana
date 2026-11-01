import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getClaims: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: mocks.getClaims },
  }),
}));

import { requireAuthenticatedUser } from "./require-authenticated-user";

describe("requireAuthenticatedUser", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns verified claims when a subject is present", async () => {
    const claims = { sub: "subject-123", role: "authenticated" };
    mocks.getClaims.mockResolvedValue({ data: { claims }, error: null });

    await expect(requireAuthenticatedUser()).resolves.toEqual(claims);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("refuses a valid but non-owner session in personal mode", async () => {
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "true");
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_OWNER_ID", "2b4813a6-2aa8-4129-a904-0b180356ce12");
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "different-subject" } }, error: null });
    await requireAuthenticatedUser();
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("redirects unauthenticated requests to login", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: null }, error: null });

    await requireAuthenticatedUser();

    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("redirects when claims validation fails", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: null }, error: new Error("expired") });

    await requireAuthenticatedUser();

    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });
});
