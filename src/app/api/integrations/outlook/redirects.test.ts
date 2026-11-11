import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  cookies: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  createOutlookAuthorizationUrl: vi.fn(),
  clearOutlookAuthorizationTransaction: vi.fn(),
  redeemOutlookAuthorizationCode: vi.fn(),
  clearOutlookTokens: vi.fn(),
  clearLegacyOutlookTokenCookies: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mocked.cookies,
}));

vi.mock("@/lib/auth/require-authenticated-user", () => ({
  requireAuthenticatedUser: mocked.requireAuthenticatedUser,
}));

vi.mock("@/infrastructure/integrations/outlook-calendar-oauth", () => ({
  createOutlookAuthorizationUrl: mocked.createOutlookAuthorizationUrl,
  clearOutlookAuthorizationTransaction:
    mocked.clearOutlookAuthorizationTransaction,
  redeemOutlookAuthorizationCode: mocked.redeemOutlookAuthorizationCode,
}));

vi.mock("@/infrastructure/integrations/outlook-calendar-session", () => ({
  clearOutlookTokens: mocked.clearOutlookTokens,
  clearLegacyOutlookTokenCookies: mocked.clearLegacyOutlookTokenCookies,
}));

import { OutlookCalendarError } from "@/infrastructure/integrations/outlook-calendar";

import { GET as authorize } from "./authorize/route";
import { GET as callback } from "./callback/route";
import { POST as disconnect } from "./disconnect/route";

const SUBJECT = "synthetic-user";
const PROVIDER_AUTHORIZATION_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=synthetic";
/** What a route handler sees in `request.url` behind the hosting proxy. */
const INTERNAL_ORIGIN = "https://localhost:10000";
const CALLBACK_PATH = "/api/integrations/outlook/callback";
const OAUTH_MODULE = "@/infrastructure/integrations/outlook-calendar-oauth";
const PROVIDER_CONFIGURATION = [
  "MICROSOFT_ENTRA_CLIENT_ID",
  "MICROSOFT_ENTRA_CLIENT_SECRET",
  "MICROSOFT_ENTRA_REDIRECT_URI",
] as const;

/** Reads the `Location` header, failing the test when there is none. */
function locationOf(response: Response): string {
  const location = response.headers.get("location");

  if (location === null) {
    throw new Error("Expected the response to carry a Location header.");
  }

  return location;
}

function expectApplicationRedirect(
  response: Response,
  path: string,
  status = 307,
) {
  expect(response.status).toBe(status);
  // Relative on purpose: the browser resolves it against the public origin.
  expect(response.headers.get("location")).toBe(path);
}

describe("Outlook integration redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.requireAuthenticatedUser.mockResolvedValue({ sub: SUBJECT });
    mocked.createOutlookAuthorizationUrl.mockResolvedValue(
      PROVIDER_AUTHORIZATION_URL,
    );
    mocked.redeemOutlookAuthorizationCode.mockImplementation(() =>
      Promise.resolve(),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("GET /api/integrations/outlook/authorize", () => {
    it("sends the authenticated subject to the provider authorization URL", async () => {
      const response = await authorize();

      expect(mocked.createOutlookAuthorizationUrl).toHaveBeenCalledWith(SUBJECT);
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(PROVIDER_AUTHORIZATION_URL);
    });

    it("returns to the Cronograma instead of failing when the provider is not configured", async () => {
      const canary = "SYNTHETIC_PROVIDER_DIAGNOSTIC_MUST_NOT_LEAK";
      mocked.createOutlookAuthorizationUrl.mockRejectedValue(
        new OutlookCalendarError(canary),
      );

      const response = await authorize();

      expectApplicationRedirect(response, "/cronograma?outlook=error");
      expect(response.headers.get("location")).not.toContain(canary);
      expect(await response.text()).toBe("");
    });

    it("recognises the failure the provider module raises when it is not configured", async () => {
      // The real module, so the handler is checked against the error the
      // application raises and not against an assumption about it.
      const actual =
        await vi.importActual<
          typeof import("@/infrastructure/integrations/outlook-calendar-oauth")
        >(OAUTH_MODULE);
      PROVIDER_CONFIGURATION.forEach((name) => vi.stubEnv(name, ""));
      mocked.createOutlookAuthorizationUrl.mockImplementation(
        actual.createOutlookAuthorizationUrl,
      );

      const response = await authorize();

      expectApplicationRedirect(response, "/cronograma?outlook=error");
      // No authorization transaction is started for an unconfigured provider.
      expect(mocked.cookies).not.toHaveBeenCalled();
    });

    it("does not pass an unexpected failure off as a missing configuration", async () => {
      const unexpected = new Error("synthetic unexpected failure");
      mocked.createOutlookAuthorizationUrl.mockRejectedValue(unexpected);

      await expect(authorize()).rejects.toBe(unexpected);
    });

    it("does not swallow the authentication guard", async () => {
      const authenticationRedirect = new Error("NEXT_REDIRECT");
      mocked.requireAuthenticatedUser.mockRejectedValue(authenticationRedirect);

      await expect(authorize()).rejects.toBe(authenticationRedirect);
      expect(mocked.createOutlookAuthorizationUrl).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/integrations/outlook/callback", () => {
    it.each([
      ["a provider error", "?error=access_denied&state=s"],
      ["a missing code", "?state=s"],
      ["a missing state", "?code=c"],
    ])("abandons the transaction on %s", async (_label, query) => {
      const response = await callback(
        new Request(`${INTERNAL_ORIGIN}${CALLBACK_PATH}${query}`),
      );

      expect(mocked.clearOutlookAuthorizationTransaction).toHaveBeenCalledOnce();
      expect(mocked.redeemOutlookAuthorizationCode).not.toHaveBeenCalled();
      expectApplicationRedirect(response, "/cronograma?outlook=error");
    });

    it("redeems the code for the authenticated subject and returns to the Cronograma", async () => {
      const response = await callback(
        new Request(`${INTERNAL_ORIGIN}${CALLBACK_PATH}?code=c&state=s`),
      );

      expect(mocked.redeemOutlookAuthorizationCode).toHaveBeenCalledWith(
        SUBJECT,
        "c",
        "s",
      );
      expectApplicationRedirect(response, "/cronograma?outlook=connected");
    });

    it("reports a failed redemption without exposing provider diagnostics", async () => {
      const canary = "SYNTHETIC_PROVIDER_DIAGNOSTIC_MUST_NOT_LEAK";
      mocked.redeemOutlookAuthorizationCode.mockRejectedValue(new Error(canary));

      const response = await callback(
        new Request(`${INTERNAL_ORIGIN}${CALLBACK_PATH}?code=c&state=s`),
      );

      expectApplicationRedirect(response, "/cronograma?outlook=error");
      expect(response.headers.get("location")).not.toContain(canary);
    });

    it("never redirects the browser to the internal listener origin", async () => {
      const publicOrigin = "https://academia.example.org";
      const response = await callback(
        new Request(`${INTERNAL_ORIGIN}${CALLBACK_PATH}?code=c&state=s`),
      );
      const location = locationOf(response);

      expect(location).not.toContain("localhost");
      expect(
        new URL(location, `${publicOrigin}${CALLBACK_PATH}`).toString(),
      ).toBe(`${publicOrigin}/cronograma?outlook=connected`);
    });
  });

  describe("POST /api/integrations/outlook/disconnect", () => {
    it("clears the subject's tokens and answers the form post with See Other", async () => {
      const response = await disconnect();

      expect(mocked.clearOutlookTokens).toHaveBeenCalledWith(SUBJECT);
      expect(mocked.clearLegacyOutlookTokenCookies).toHaveBeenCalledOnce();
      expectApplicationRedirect(
        response,
        "/cronograma?outlook=disconnected",
        303,
      );
    });
  });
});
