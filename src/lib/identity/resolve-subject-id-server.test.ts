import { afterEach, describe, expect, it, vi } from "vitest";

import { createResolveSubjectIdServer } from "./resolve-subject-id-server";

describe("createResolveSubjectIdServer", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("does not expose foreign subject identity to the root layout in personal mode", async () => {
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "true");
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_OWNER_ID", "2b4813a6-2aa8-4129-a904-0b180356ce12");
    const createSupabaseClient = vi.fn().mockResolvedValue({ auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "foreign-subject" } }, error: null }) } });
    await expect(createResolveSubjectIdServer(createSupabaseClient)()).resolves.toBeNull();
  });
  it("resolve o subjectId usando o cliente Supabase do servidor", async () => {
    const getClaims = vi.fn().mockResolvedValue({
      data: {
        claims: {
          sub: "user-123",
        },
      },
      error: null,
    });

    const createSupabaseClient = vi.fn().mockResolvedValue({
      auth: {
        getClaims,
      },
    });

    const resolveSubjectId = createResolveSubjectIdServer(createSupabaseClient);

    await expect(resolveSubjectId()).resolves.toBe("user-123");

    expect(createSupabaseClient).toHaveBeenCalledTimes(1);
    expect(getClaims).toHaveBeenCalledTimes(1);
  });

  it("retorna null quando não existe uma identidade autenticada", async () => {
    const createSupabaseClient = vi.fn().mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: {
            claims: null,
          },
          error: null,
        }),
      },
    });

    const resolveSubjectId = createResolveSubjectIdServer(createSupabaseClient);

    await expect(resolveSubjectId()).resolves.toBeNull();
  });

  it("propaga uma falha inesperada do cliente Supabase", async () => {
    const error = new Error("Falha no Supabase");

    const createSupabaseClient = vi.fn().mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockRejectedValue(error),
      },
    });

    const resolveSubjectId = createResolveSubjectIdServer(createSupabaseClient);

    await expect(resolveSubjectId()).rejects.toThrow("Falha no Supabase");
  });
});
