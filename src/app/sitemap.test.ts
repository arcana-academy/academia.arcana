import { afterEach, describe, expect, it, vi } from "vitest";
import sitemap, { dynamic } from "./sitemap";

afterEach(() => vi.unstubAllEnvs());

describe("personal sitemap", () => {
  it("does not advertise routes in personal mode", () => {
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "true");
    expect(dynamic).toBe("force-dynamic");
    expect(sitemap()).toEqual([]);
  });

  it("preserves the existing public sitemap when personal mode is off", () => {
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "");
    expect(sitemap().length).toBeGreaterThan(0);
  });
});
