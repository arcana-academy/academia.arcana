import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPersonalOwnerSubjectId,
  isPersonalModeEnabled,
  isPersonalModePublicPath,
} from "./personal-access";

afterEach(() => vi.unstubAllEnvs());

describe("server-only personal access configuration", () => {
  it("does not enable personal mode implicitly", () => {
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "");
    expect(isPersonalModeEnabled()).toBe(false);
  });

  it("requires the explicit true switch", () => {
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "true");
    expect(isPersonalModeEnabled()).toBe(true);
  });

  it("fails closed on missing or invalid owner identifiers", () => {
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_OWNER_ID", "");
    expect(getPersonalOwnerSubjectId()).toBeNull();
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_OWNER_ID", "owner@example.com");
    expect(getPersonalOwnerSubjectId()).toBeNull();
  });

  it("accepts only a verified UUID-shaped owner subject", () => {
    vi.stubEnv(
      "ACADEMIA_ARCANA_PERSONAL_OWNER_ID",
      "2B4813A6-2AA8-4129-A904-0B180356CE12",
    );
    expect(getPersonalOwnerSubjectId()).toBe(
      "2b4813a6-2aa8-4129-a904-0b180356ce12",
    );
  });

  it("keeps only existing sign-in and recovery endpoints reachable without login", () => {
    expect(isPersonalModePublicPath("/login")).toBe(true);
    expect(isPersonalModePublicPath("/recuperar-senha")).toBe(true);
    expect(isPersonalModePublicPath("/auth/callback")).toBe(true);
    expect(isPersonalModePublicPath("/cadastro")).toBe(false);
    expect(isPersonalModePublicPath("/santuario")).toBe(false);
    expect(isPersonalModePublicPath("/api/ia-aberta")).toBe(false);
  });
});
