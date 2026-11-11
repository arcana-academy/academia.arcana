import { afterEach, describe, expect, it, vi } from "vitest";

import { getPostHogConfig } from "./posthog-config";

describe("getPostHogConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("desativa o PostHog quando a chave está ausente ou vazia", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    expect(getPostHogConfig()).toBeNull();

    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "   ");
    expect(getPostHogConfig()).toBeNull();
  });

  it("lê a chave e o host do ambiente", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", " phc_test ");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");

    expect(getPostHogConfig()).toEqual({
      key: "phc_test",
      host: "https://us.i.posthog.com",
    });
  });

  it("deixa o host para o padrão do SDK quando não configurado", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");

    expect(getPostHogConfig()).toEqual({ key: "phc_test", host: undefined });
  });
});
