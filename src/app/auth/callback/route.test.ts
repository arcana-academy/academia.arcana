import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const exchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession },
  }),
}));

/** Origin the browser used; a relative Location must resolve back to it. */
const PUBLIC_ORIGIN = "https://app.example";

function resolvedLocation(response: Response, publicUrl: string): string {
  const location = response.headers.get("location");
  expect(location).not.toBeNull();
  return new URL(location!, publicUrl).toString();
}

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it.each([
    "//evil.example",
    "/\\evil.example",
    "/\\/evil.example",
    // Dot segments collapse into a protocol-relative reference once the URL
    // is normalised, so they must be rejected after normalisation as well.
    "/.//evil.example",
    "/..//evil.example",
    "/a/..//evil.example",
    "/%2e//evil.example",
    "/./\\evil.example",
  ])(
    "redirects external next value %s to the application root",
    async (next) => {
      const publicUrl = `${PUBLIC_ORIGIN}/auth/callback?code=valid-code&next=${encodeURIComponent(next)}`;
      const response = await GET(new Request(publicUrl));

      expect(response.headers.get("location")).toBe("/");
      expect(resolvedLocation(response, publicUrl)).toBe(`${PUBLIC_ORIGIN}/`);
    },
  );

  it("rejects an absolute URL without a leading slash", async () => {
    const publicUrl = `${PUBLIC_ORIGIN}/auth/callback?code=valid-code&next=https%3A%2F%2Fevil.example`;
    const response = await GET(new Request(publicUrl));

    expect(response.headers.get("location")).toBe("/");
    expect(resolvedLocation(response, publicUrl)).toBe(`${PUBLIC_ORIGIN}/`);
  });

  it("preserves a valid internal path, query string, and fragment", async () => {
    const publicUrl = `${PUBLIC_ORIGIN}/auth/callback?code=valid-code&next=%2Fworkspace%3Fview%3Dtree%23current`;
    const response = await GET(new Request(publicUrl));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("valid-code");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "/workspace?view=tree#current",
    );
    expect(resolvedLocation(response, publicUrl)).toBe(
      `${PUBLIC_ORIGIN}/workspace?view=tree#current`,
    );
  });

  it("redirects to the login page when the authorization code is missing", async () => {
    const publicUrl = `${PUBLIC_ORIGIN}/auth/callback`;
    const response = await GET(new Request(publicUrl));

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/login?error=auth");
    expect(resolvedLocation(response, publicUrl)).toBe(
      `${PUBLIC_ORIGIN}/login?error=auth`,
    );
  });

  it("redirects to the login page when the code exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValueOnce({
      error: new Error("Invalid authorization code"),
    });

    const publicUrl = `${PUBLIC_ORIGIN}/auth/callback?code=invalid-code`;
    const response = await GET(new Request(publicUrl));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("invalid-code");
    expect(response.headers.get("location")).toBe("/login?error=auth");
    expect(resolvedLocation(response, publicUrl)).toBe(
      `${PUBLIC_ORIGIN}/login?error=auth`,
    );
  });

  // Behind the hosting reverse proxy the handler sees the internal listener
  // origin in `request.url`, while the browser asked for the public origin.
  it.each([
    ["/auth/callback", "/login?error=auth"],
    ["/auth/callback?code=valid-code", "/"],
    [
      "/auth/callback?code=valid-code&next=%2Fredefinir-senha",
      "/redefinir-senha",
    ],
  ])(
    "never leaks the internal listener origin for %s",
    async (pathAndQuery, expectedPath) => {
      const response = await GET(
        new Request(`https://localhost:10000${pathAndQuery}`),
      );
      const location = response.headers.get("location");

      expect(location).toBe(expectedPath);
      expect(location).not.toContain("localhost");
      expect(
        resolvedLocation(response, `${PUBLIC_ORIGIN}${pathAndQuery}`),
      ).toBe(`${PUBLIC_ORIGIN}${expectedPath}`);
    },
  );
});
