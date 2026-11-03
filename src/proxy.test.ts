import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateSession: vi.fn(
    async (
      _request?: unknown,
      _headers?: Headers,
      _options?: { requireSession?: boolean },
    ) => ({
      headers: new Headers(),
    }),
  ),
  next: vi.fn((_options?: { request?: { headers?: Headers } }) => ({
    headers: new Headers(),
  })),
  json: vi.fn((_body: object, options: { status: number; headers?: HeadersInit }) => ({
    status: options.status,
    headers: new Headers(options.headers),
  })),
  redirect: vi.fn((url: URL) => ({
    headers: new Headers({ Location: url.toString() }),
  })),
}));

vi.mock("next/server", () => ({
  NextResponse: { next: mocks.next, json: mocks.json, redirect: mocks.redirect },
}));
vi.mock("@/lib/supabase/proxy", () => ({
  updateSession: mocks.updateSession,
}));

import { config, proxy } from "./proxy";

const request = (pathname: string) => ({
  method: "GET",
  headers: new Headers({ "x-request-id": "synthetic" }),
  nextUrl: { pathname, origin: "https://app.example" },
  url: `https://app.example${pathname}`,
}) as Parameters<typeof proxy>[0];

describe("proxy liveness isolation", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "");
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_OWNER_ID", "");
    vi.clearAllMocks();
    mocks.updateSession.mockImplementation(async () => ({
      headers: new Headers(),
    }));
  });

  it("keeps liveness available when the personal owner is not configured", async () => {
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "true");
    await proxy(request("/api/health"));
    expect(mocks.next).toHaveBeenCalledTimes(1);
  });

  it("fails closed without a configured owner in personal mode", async () => {
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "true");
    const response = await proxy(request("/santuario"));
    expect(response.status).toBe(503);
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });

  it("gates public entry and API requests for the single owner in personal mode", async () => {
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "true");
    vi.stubEnv(
      "ACADEMIA_ARCANA_PERSONAL_OWNER_ID",
      "2b4813a6-2aa8-4129-a904-0b180356ce12",
    );
    await proxy(request("/"));
    await proxy(request("/api/ia-aberta"));
    expect(mocks.updateSession.mock.calls.map(call => call[2])).toEqual([
      { requireSession: true, personalOwnerSubjectId: "2b4813a6-2aa8-4129-a904-0b180356ce12", isApiRequest: false },
      { requireSession: true, personalOwnerSubjectId: "2b4813a6-2aa8-4129-a904-0b180356ce12", isApiRequest: true },
    ]);
  });

  it("allows robots.txt even with an absent personal owner and sends no-index", async () => {
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "true");
    const response = await proxy(request("/robots.txt"));
    expect(mocks.next).toHaveBeenCalledTimes(1);
    expect(mocks.updateSession).not.toHaveBeenCalled();
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
  });

  it("sets no-index on sign-in and restricted app pages without changing public mode", async () => {
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "true");
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_OWNER_ID", "2b4813a6-2aa8-4129-a904-0b180356ce12");
    const login = await proxy(request("/login"));
    const sanctuary = await proxy(request("/santuario"));
    expect(login.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
    expect(sanctuary.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "");
    const regular = await proxy(request("/login"));
    expect(regular.headers.get("X-Robots-Tag")).toBeNull();
  });

  it("redirects the public signup route to login in personal mode", async () => {
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "true");
    vi.stubEnv(
      "ACADEMIA_ARCANA_PERSONAL_OWNER_ID",
      "2b4813a6-2aa8-4129-a904-0b180356ce12",
    );
    const response = await proxy(request("/cadastro"));
    expect(response.headers.get("Location")).toBe("https://app.example/login");
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });

  it("redirects local synthetic signup without enabling the hosted personal gate", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ACADEMIA_ARCANA_LOCAL_PREVIEW", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    const response = await proxy(request("/cadastro"));
    expect(response.headers.get("Location")).toBe("https://app.example/login");
    expect(mocks.updateSession).not.toHaveBeenCalled();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    mocks.redirect.mockClear();
    await proxy(request("/cadastro"));
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("bypasses Supabase session checks only for exact /api/health", async () => {
    const response = await proxy(request("/api/health"));
    expect(mocks.updateSession).not.toHaveBeenCalled();
    expect(mocks.next).toHaveBeenCalledTimes(1);
    expect(response.headers.get("Content-Security-Policy")).toContain("script-src");
  });

  it("keeps nonce and CSP in forwarded and response headers for liveness", async () => {
    const response = await proxy(request("/api/health"));
    const forwarded = mocks.next.mock.calls[0]?.[0]?.request?.headers;
    expect(forwarded?.get("x-nonce")).toBeTruthy();
    expect(forwarded?.get("x-request-id")).toBe("synthetic");
    expect(forwarded?.get("Content-Security-Policy")).toBe(
      response.headers.get("Content-Security-Policy"),
    );
  });

  it("liveness does not wait for a stalled session refresh", async () => {
    mocks.updateSession.mockImplementation(
      () => new Promise<{ headers: Headers }>(() => {}),
    );
    await expect(proxy(request("/api/health"))).resolves.toBeDefined();
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });

  it("continues checking session for readiness and protected routes", async () => {
    await proxy(request("/api/ready"));
    await proxy(request("/santuario"));
    expect(mocks.updateSession).toHaveBeenCalledTimes(2);
    expect(mocks.next).not.toHaveBeenCalled();
  });

  it("does not bypass authentication for similarly named routes", async () => {
    await proxy(request("/api/health/private"));
    await proxy(request("/api/healthy"));
    expect(mocks.updateSession).toHaveBeenCalledTimes(2);
  });

  it("requires a session for gated routes before the shell is streamed", async () => {
    await proxy(request("/santuario"));
    await proxy(request("/pratica"));
    await proxy(request("/integracoes/asana"));

    expect(
      mocks.updateSession.mock.calls.map((call) => call[2]),
    ).toEqual([
      { requireSession: true },
      { requireSession: true },
      { requireSession: true },
    ]);
  });

  it("leaves public routes without a session requirement", async () => {
    for (const path of [
      "/",
      "/login",
      "/cadastro",
      "/recuperar-senha",
      "/integracoes",
      "/integracoes/ia-aberta",
    ]) {
      await proxy(request(path));
    }

    expect(
      mocks.updateSession.mock.calls.every(
        (call) => (call[2] as { requireSession?: boolean }).requireSession === false,
      ),
    ).toBe(true);
  });

  it("does not gate look-alike paths or health/readiness endpoints", async () => {
    await proxy(request("/santuarios"));
    await proxy(request("/api/ready"));

    expect(
      mocks.updateSession.mock.calls.map((call) => call[2]),
    ).toEqual([{ requireSession: false }, { requireSession: false }]);
  });

  it("returns the login redirect produced by the session guard", async () => {
    mocks.updateSession.mockImplementation(async () => {
      const headers = new Headers();
      headers.set("Location", "https://academia.example.org/login");
      return { headers } as unknown as { headers: Headers };
    });

    const response = await proxy(request("/santuario"));

    expect(response.headers.get("Location")).toBe(
      "https://academia.example.org/login",
    );
    // The nonce policy is still applied to the redirect itself.
    expect(response.headers.get("Content-Security-Policy")).toContain("script-src");
  });

  it("does not swallow session failures on protected routes", async () => {
    mocks.updateSession.mockRejectedValue(new Error("auth unavailable"));
    await expect(proxy(request("/santuario"))).rejects.toThrow("auth unavailable");
    expect(mocks.next).not.toHaveBeenCalled();
  });

  it("does not crash on a request without nextUrl or a valid URL", async () => {
    const malformed = { headers: new Headers() } as never;

    const response = await proxy(malformed);

    expect(response.headers.get("Content-Security-Policy")).toContain("script-src");
    expect(
      (mocks.updateSession.mock.calls[0]?.[2] as { requireSession?: boolean })
        .requireSession,
    ).toBe(false);
  });

  it("reads the pathname from the URL when nextUrl is absent", async () => {
    const urlOnly = {
      headers: new Headers(),
      url: "https://academia.example.org/santuario",
    } as never;

    await proxy(urlOnly);

    expect(
      (mocks.updateSession.mock.calls[0]?.[2] as { requireSession?: boolean })
        .requireSession,
    ).toBe(true);
  });

  it("keeps existing non-asset matcher coverage for health and protected paths", () => {
    // Next.js anchors matcher patterns to the start of the pathname.
    const matcher = new RegExp(`^${config.matcher[0]}`);
    expect(matcher.test("/api/health")).toBe(true);
    expect(matcher.test("/santuario")).toBe(true);
    expect(matcher.test("/_next/static/chunk.js")).toBe(false);
  });
});
