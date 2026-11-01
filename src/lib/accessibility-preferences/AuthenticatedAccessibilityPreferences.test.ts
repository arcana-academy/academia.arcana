import { describe, expect, it, vi } from "vitest";

import { createAuthenticatedAccessibilityPreferencesRepository } from "./AuthenticatedAccessibilityPreferences";

describe("AuthenticatedAccessibilityPreferences", () => {
  it("retorna null quando não existe preferência autenticada", async () => {
    const load = vi.fn().mockResolvedValue(null);
    const save = vi.fn().mockImplementation(async () => undefined);

    const repository =
      createAuthenticatedAccessibilityPreferencesRepository({
        load,
        save,
      });

    await expect(
      repository.load("user-123"),
    ).resolves.toBeNull();

    expect(load).toHaveBeenCalledWith("user-123");
  });

  it("carrega preferências autenticadas pela identidade", async () => {
    const preferences = {
      version: 1 as const,
      preferences: {
        motion: "reduced" as const,
      },
    };

    const load = vi.fn().mockResolvedValue(preferences);
    const save = vi.fn().mockImplementation(async () => undefined);

    const repository =
      createAuthenticatedAccessibilityPreferencesRepository({
        load,
        save,
      });

    await expect(
      repository.load("user-123"),
    ).resolves.toEqual(preferences);

    expect(load).toHaveBeenCalledWith("user-123");
  });

  it("salva preferências autenticadas pela identidade", async () => {
    const load = vi.fn().mockResolvedValue(null);
    const save = vi.fn().mockImplementation(async () => undefined);

    const repository =
      createAuthenticatedAccessibilityPreferencesRepository({
        load,
        save,
      });

    const preferences = {
      version: 1 as const,
      preferences: {
        motion: "normal" as const,
      },
    };

    await expect(
      repository.save("user-123", preferences),
    ).resolves.toBeUndefined();

    expect(save).toHaveBeenCalledWith(
      "user-123",
      preferences,
    );
  });

  it("propaga o erro estruturado do serviço autenticado", async () => {
    const error = new Error(
      "authenticated storage unavailable",
    );

    const load = vi.fn().mockRejectedValue(error);
    const save = vi.fn().mockImplementation(async () => undefined);

    const repository =
      createAuthenticatedAccessibilityPreferencesRepository({
        load,
        save,
      });

    await expect(
      repository.load("user-123"),
    ).rejects.toBe(error);
  });
});
