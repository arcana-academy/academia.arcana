import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getClaims: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock("@/core/config", () => ({
  getPublicRuntimeConfig: () => ({
    supabaseUrl: "https://example.supabase.co",
    supabasePublishableKey: "sb_publishable_test",
  }),
}));

vi.mock("next/server", async () => {
  class MockHeaders {
    private readonly values = new Map<string, string>();

    set(name: string, value: string) {
      this.values.set(name, value);
    }

    get(name: string) {
      return this.values.get(name) ?? null;
    }
  }

  class MockCookies {
    calls: unknown[][] = [];

    getAll() {
      return [];
    }

    set(...args: unknown[]) {
      this.calls.push(args);
    }
  }

  class MockResponse {
    cookies = new MockCookies();
    headers = new MockHeaders();
    redirectUrl: URL | null = null;
    status = 200;

    static next() {
      return new MockResponse();
    }

    static redirect(url: URL) {
      const response = new MockResponse();
      response.redirectUrl = url;
      response.headers.set("Location", url.toString());
      return response;
    }

    static json(_body: unknown, options: { status: number; headers?: Record<string, string> }) {
      const response = new MockResponse();
      response.status = options.status;
      for (const [name, value] of Object.entries(options.headers ?? {})) {
        response.headers.set(name, value);
      }
      return response;
    }
  }

  return {
    NextResponse: MockResponse,
  };
});

import { updateSupabaseSession } from "./session";

describe("updateSupabaseSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.createServerClient.mockReturnValue({
      auth: {
        getClaims: mocks.getClaims,
      },
    });

    mocks.getClaims.mockResolvedValue({
      data: { claims: null },
      error: null,
    });
  });

  it("initializes a server client and validates claims", async () => {
    const request = {
      cookies: {
        getAll: () => [],
      },
    } as never;

    await updateSupabaseSession(request);

    expect(mocks.createServerClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "sb_publishable_test",
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      }),
    );
    expect(mocks.getClaims).toHaveBeenCalledTimes(1);
  });

  it("propagates request cookies, response cookie options, and cache headers during refresh", async () => {
    let setAll:
      | ((cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>,
          headers: Record<string, string>) => void)
      | undefined;

    mocks.createServerClient.mockImplementation((_url, _key, options) => {
      setAll = options.cookies.setAll;
      return {
        auth: {
          getClaims: async () => {
            setAll?.(
              [
                {
                  name: "sb-test-auth-token",
                  value: "refreshed",
                  options: {
                    httpOnly: false,
                    secure: true,
                    sameSite: "lax",
                  },
                },
              ],
              {
                "Cache-Control": "private, no-store",
              },
            );

            return {
              data: { claims: { sub: "user-123" } },
              error: null,
            };
          },
        },
      };
    });

    const requestCookies: Array<Record<string, unknown>> = [];
    const request = {
      cookies: {
        getAll: () => requestCookies,
        set: (...args: unknown[]) => {
          requestCookies.push({ args });
        },
      },
    } as never;

    const response = await updateSupabaseSession(request);

    expect(requestCookies).toHaveLength(1);
    expect(requestCookies[0]?.args).toEqual([
      "sb-test-auth-token",
      "refreshed",
    ]);
    expect(
      (response.cookies as unknown as { calls: unknown[][] }).calls,
    ).toEqual([
      [
        "sb-test-auth-token",
        "refreshed",
        {
          httpOnly: false,
          secure: true,
          sameSite: "lax",
        },
      ],
    ]);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  const request = {
    url: "https://academia.example.org/santuario",
    cookies: {
      getAll: () => [],
      set: () => {},
    },
  } as never;

  it("does not redirect when the session guard is not required", async () => {
    const response = await updateSupabaseSession(request);

    expect(
      (response as unknown as { redirectUrl: URL | null }).redirectUrl,
    ).toBeNull();
  });

  it("redirects to login for a gated route without claims", async () => {
    const response = await updateSupabaseSession(request, undefined, {
      requireSession: true,
    });

    const redirectUrl = (response as unknown as { redirectUrl: URL | null })
      .redirectUrl;

    expect(redirectUrl?.pathname).toBe("/login");
    expect(redirectUrl?.origin).toBe("https://academia.example.org");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("redirects instead of trusting a failed claim check", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: null },
      error: new Error("auth unavailable"),
    });

    const response = await updateSupabaseSession(request, undefined, {
      requireSession: true,
    });

    expect(
      (response as unknown as { redirectUrl: URL | null }).redirectUrl
        ?.pathname,
    ).toBe("/login");
  });

  it("forwards an authenticated request to the gated page", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-123" } },
      error: null,
    });

    const response = await updateSupabaseSession(request, undefined, {
      requireSession: true,
    });

    expect(
      (response as unknown as { redirectUrl: URL | null }).redirectUrl,
    ).toBeNull();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("allows the configured owner access to personal routes", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "2b4813a6-2aa8-4129-a904-0b180356ce12" } },
      error: null,
    });

    const response = await updateSupabaseSession(request, undefined, {
      requireSession: true,
      personalOwnerSubjectId: "2b4813a6-2aa8-4129-a904-0b180356ce12",
    });

    expect((response as unknown as { redirectUrl: URL | null }).redirectUrl).toBeNull();
  });

  it("rejects another existing user on personal pages", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "46b832bf-3ebd-4ae8-9395-459a78280b3d" } },
      error: null,
    });

    const response = await updateSupabaseSession(request, undefined, {
      requireSession: true,
      personalOwnerSubjectId: "2b4813a6-2aa8-4129-a904-0b180356ce12",
    });

    expect((response as unknown as { redirectUrl: URL | null }).redirectUrl?.pathname)
      .toBe("/login");
  });

  it("rejects another authenticated identity on personal APIs with 403", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "46b832bf-3ebd-4ae8-9395-459a78280b3d" } },
      error: null,
    });

    const response = await updateSupabaseSession(request, undefined, {
      requireSession: true,
      personalOwnerSubjectId: "2b4813a6-2aa8-4129-a904-0b180356ce12",
      isApiRequest: true,
    });
    expect((response as unknown as { status: number }).status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 401 for anonymous API calls in personal mode", async () => {
    const response = await updateSupabaseSession(request, undefined, {
      requireSession: true,
      personalOwnerSubjectId: "2b4813a6-2aa8-4129-a904-0b180356ce12",
      isApiRequest: true,
    });
    expect((response as unknown as { status: number }).status).toBe(401);
  });

  it("treats an answered claims call without a subject as anonymous", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { role: "authenticated" } },
      error: null,
    });

    const response = await updateSupabaseSession(request, undefined, {
      requireSession: true,
    });

    expect(
      (response as unknown as { redirectUrl: URL | null }).redirectUrl
        ?.pathname,
    ).toBe("/login");
  });
});
