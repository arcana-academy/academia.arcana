import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const exchangeCodeForSession = vi.fn();
const getClaims = vi.fn();
const signOut = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession, getClaims, signOut },
  }),
}));

describe("GET /auth/callback", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.clearAllMocks();
    exchangeCodeForSession.mockResolvedValue({ error: null });
    getClaims.mockResolvedValue({ data: { claims: { sub: "2b4813a6-2aa8-4129-a904-0b180356ce12" } }, error: null });
    signOut.mockResolvedValue({ error: null });
  });

  it.each([
    "//evil.example",
    "/\\evil.example",
    "/\\/evil.example",
  ])(
    "redirects external next value %s to the application root",
    async (next) => {
      const response = await GET(
        new Request(
          `https://app.example/auth/callback?code=valid-code&next=${encodeURIComponent(next)}`,
        ),
      );

      expect(response.headers.get("location")).toBe("https://app.example/");
    },
  );

  it("accepts only the approved account after code exchange in personal mode", async () => {
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "true");
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_OWNER_ID", "2b4813a6-2aa8-4129-a904-0b180356ce12");
    const response = await GET(new Request("https://app.example/auth/callback?code=owner-code&next=/redefinir-senha"));
    expect(getClaims).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://app.example/redefinir-senha");
  });

  it("signs out a different authenticated account before redirecting to private content", async () => {
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "true");
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_OWNER_ID", "2b4813a6-2aa8-4129-a904-0b180356ce12");
    getClaims.mockResolvedValue({ data: { claims: { sub: "7b4813a6-2aa8-4129-a904-0b180356ce12" } }, error: null });
    const response = await GET(new Request("https://app.example/auth/callback?code=foreign-code&next=/santuario"));
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(response.headers.get("location")).toBe("https://app.example/login?error=auth");
  });

  it("fails closed for invalid owner configuration and unverifiable claims", async () => {
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "true");
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_OWNER_ID", "");
    getClaims.mockResolvedValue({ data: null, error: new Error("JWT invalid") });
    const response = await GET(new Request("https://app.example/auth/callback?code=unverified&next=/redefinir-senha"));
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(response.headers.get("location")).toBe("https://app.example/login?error=auth");
  });

  it("returns 503 if a rejected session cannot be cleared", async () => {
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "true");
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_OWNER_ID", "2b4813a6-2aa8-4129-a904-0b180356ce12");
    getClaims.mockResolvedValue({ data: { claims: { sub: "foreign" } }, error: null });
    signOut.mockResolvedValue({ error: new Error("could not clear session") });
    const response = await GET(new Request("https://app.example/auth/callback?code=foreign-code"));
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("location")).toBeNull();
  });

  it("preserves legacy callback behavior outside personal mode", async () => {
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "");
    const response = await GET(new Request("https://app.example/auth/callback?code=valid-code&next=/santuario"));
    expect(getClaims).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://app.example/santuario");
  });

  it("rejects an absolute URL without a leading slash", async () => {
    const response = await GET(
      new Request(
        "https://app.example/auth/callback?code=valid-code&next=https%3A%2F%2Fevil.example",
      ),
    );

    expect(response.headers.get("location")).toBe("https://app.example/");
  });

  it("preserves a valid internal path, query string, and fragment", async () => {
    const response = await GET(
      new Request(
        "https://app.example/auth/callback?code=valid-code&next=%2Fworkspace%3Fview%3Dtree%23current",
      ),
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith("valid-code");
    expect(response.headers.get("location")).toBe(
      "https://app.example/workspace?view=tree#current",
    );
  });

  it("redirects to the login page when the authorization code is missing", async () => {
    const response = await GET(new Request("https://app.example/auth/callback"));

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://app.example/login?error=auth",
    );
  });

  it("redirects to the login page when the code exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValueOnce({
      error: new Error("Invalid authorization code"),
    });

    const response = await GET(
      new Request("https://app.example/auth/callback?code=invalid-code"),
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith("invalid-code");
    expect(response.headers.get("location")).toBe(
      "https://app.example/login?error=auth",
    );
  });
});
