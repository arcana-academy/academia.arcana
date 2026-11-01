import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getClaims },
  })),
}));

import { getAuthenticatedUserClaims } from "./get-authenticated-user-claims";

describe("getAuthenticatedUserClaims", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    getClaims.mockReset();
  });

  it("returns claims for an authenticated user", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "user-123" } },
      error: null,
    });

    await expect(getAuthenticatedUserClaims()).resolves.toEqual({
      sub: "user-123",
    });
  });

  it("never returns a foreign subject in personal mode", async () => {
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "true");
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_OWNER_ID", "2b4813a6-2aa8-4129-a904-0b180356ce12");
    getClaims.mockResolvedValue({ data: { claims: { sub: "different-subject" } }, error: null });
    await expect(getAuthenticatedUserClaims()).resolves.toBeNull();
    getClaims.mockResolvedValue({ data: { claims: { sub: "2b4813a6-2aa8-4129-a904-0b180356ce12" } }, error: null });
    await expect(getAuthenticatedUserClaims()).resolves.toMatchObject({ sub: "2b4813a6-2aa8-4129-a904-0b180356ce12" });
  });

  it("returns null when authentication fails", async () => {
    getClaims.mockResolvedValue({
      data: null,
      error: new Error("unauthenticated"),
    });

    await expect(getAuthenticatedUserClaims()).resolves.toBeNull();
  });
});
