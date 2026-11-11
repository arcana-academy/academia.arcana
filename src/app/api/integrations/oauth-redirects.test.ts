// @vitest-environment node
// Route handlers run on the Node.js runtime; the provider modules are real
// here, only the cookie jar, the authentication guard and the network are not.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => {
  const jar = new Map<string, string>();

  return {
    jar,
    requireAuthenticatedUser: vi.fn(),
    cookieStore: {
      get(name: string) {
        const value = jar.get(name);
        return value === undefined ? undefined : { name, value };
      },
      set(name: string, value: string) {
        jar.set(name, value);
      },
      delete(name: string) {
        jar.delete(name);
      },
    },
  };
});

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(mocked.cookieStore),
}));

vi.mock("@/lib/auth/require-authenticated-user", () => ({
  requireAuthenticatedUser: mocked.requireAuthenticatedUser,
}));

import { GET as asanaCallback } from "./asana/callback/route";
import { GET as asanaConnect } from "./asana/connect/route";
import { GET as sharePointCallback } from "./microsoft-sharepoint/callback/route";
import { GET as sharePointConnect } from "./microsoft-sharepoint/connect/route";
import { GET as notionCallback } from "./notion/callback/route";
import { GET as notionConnect } from "./notion/connect/route";
import { GET as todoistCallback } from "./todoist/callback/route";
import { GET as todoistConnect } from "./todoist/connect/route";
import { GET as trelloCallback } from "./trello/callback/route";
import { GET as trelloConnect } from "./trello/connect/route";

/** Origin the browser uses. */
const PUBLIC_ORIGIN = "https://academia.example.org";
/** What a route handler sees in `request.url` behind the hosting proxy. */
const INTERNAL_ORIGIN = "https://localhost:10000";
const SUBJECT = "synthetic-user";
const SYNTHETIC_SECRET = "synthetic-secret-0123456789abcdef0123456789abcdef";

type Handler = (request: Request) => Promise<Response>;

type Provider = {
  readonly name: string;
  readonly connect: Handler;
  readonly callback: Handler;
  /** Variables holding the client id, the client secret and the redirect URI. */
  readonly variables: readonly [string, string, string];
  readonly authorizationEndpoint: string;
  readonly notConfigured: string;
  readonly providerError: string;
  readonly invalidState: string;
  readonly exchangeFailed: string;
};

const PROVIDERS: readonly Provider[] = [
  {
    name: "asana",
    connect: asanaConnect,
    callback: asanaCallback,
    variables: ["ASANA_CLIENT_ID", "ASANA_CLIENT_SECRET", "ASANA_REDIRECT_URI"],
    authorizationEndpoint: "https://app.asana.com/-/oauth_authorize",
    notConfigured: "/integracoes/asana?error=not_configured",
    providerError: "/integracoes/asana?error=access_denied",
    invalidState: "/integracoes/asana?error=invalid_state",
    exchangeFailed: "/integracoes/asana?error=authorization_failed",
  },
  {
    name: "notion",
    connect: notionConnect,
    callback: notionCallback,
    variables: ["NOTION_CLIENT_ID", "NOTION_CLIENT_SECRET", "NOTION_REDIRECT_URI"],
    authorizationEndpoint: "https://api.notion.com/v1/oauth/authorize",
    notConfigured: "/integracoes/notion?error=not_configured",
    providerError: "/integracoes/notion?error=access_denied",
    invalidState: "/integracoes/notion?error=invalid_state",
    exchangeFailed: "/integracoes/notion?error=authorization_failed",
  },
  {
    name: "todoist",
    connect: todoistConnect,
    callback: todoistCallback,
    variables: ["TODOIST_CLIENT_ID", "TODOIST_CLIENT_SECRET", "TODOIST_REDIRECT_URI"],
    authorizationEndpoint: "https://app.todoist.com/oauth/authorize",
    notConfigured: "/integracoes/todoist?error=not_configured",
    providerError: "/integracoes/todoist?error=access_denied",
    invalidState: "/integracoes/todoist?error=invalid_state",
    exchangeFailed: "/integracoes/todoist?error=authorization_failed",
  },
  {
    name: "trello",
    connect: trelloConnect,
    callback: trelloCallback,
    variables: ["TRELLO_CLIENT_ID", "TRELLO_CLIENT_SECRET", "TRELLO_REDIRECT_URI"],
    authorizationEndpoint: "https://auth.atlassian.com/authorize",
    notConfigured: "/integracoes/trello?error=not_configured",
    providerError: "/integracoes/trello?error=access_denied",
    invalidState: "/integracoes/trello?error=invalid_state",
    exchangeFailed: "/integracoes/trello?error=authorization_failed",
  },
  {
    name: "microsoft-sharepoint",
    connect: sharePointConnect,
    callback: sharePointCallback,
    variables: [
      "MICROSOFT_CLIENT_ID",
      "MICROSOFT_CLIENT_SECRET",
      "MICROSOFT_REDIRECT_URI",
    ],
    authorizationEndpoint:
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    notConfigured: "/integracoes?error=microsoft_sharepoint_not_configured",
    providerError: "/integracoes?error=microsoft_sharepoint_authorization_failed",
    invalidState: "/integracoes?error=microsoft_sharepoint_authorization_failed",
    exchangeFailed: "/integracoes?error=microsoft_sharepoint_exchange_failed",
  },
];

function internalRequest(provider: Provider, pathAndQuery: string): Request {
  return new Request(
    `${INTERNAL_ORIGIN}/api/integrations/${provider.name}/${pathAndQuery}`,
  );
}

function publicCallbackUrl(provider: Provider): string {
  return `${PUBLIC_ORIGIN}/api/integrations/${provider.name}/callback`;
}

function configure(provider: Provider) {
  const [clientId, clientSecret, redirectUri] = provider.variables;

  vi.stubEnv(clientId, `synthetic-${provider.name}-client`);
  vi.stubEnv(clientSecret, SYNTHETIC_SECRET);
  vi.stubEnv(redirectUri, publicCallbackUrl(provider));
}

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
  provider: Provider,
  path: string,
) {
  const location = locationOf(response);

  expect(response.status).toBe(307);
  // Relative on purpose: the browser resolves it against the public origin.
  expect(location).toBe(path);
  expect(new URL(location, publicCallbackUrl(provider)).origin).toBe(
    PUBLIC_ORIGIN,
  );
}

/** Starts a transaction and returns the state handed to the provider. */
async function startTransaction(provider: Provider): Promise<string> {
  configure(provider);

  const response = await provider.connect(internalRequest(provider, "connect"));
  const state = new URL(locationOf(response)).searchParams.get("state");

  if (!state) {
    throw new Error("Expected the provider hand-off to carry a state.");
  }

  return state;
}

describe.each(PROVIDERS)("$name OAuth redirects", (provider) => {
  beforeEach(() => {
    mocked.jar.clear();
    mocked.requireAuthenticatedUser.mockResolvedValue({ sub: SUBJECT });
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");

    for (const variable of provider.variables) {
      vi.stubEnv(variable, "");
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("returns to the application when the provider is not configured", async () => {
    const response = await provider.connect(internalRequest(provider, "connect"));

    expectApplicationRedirect(response, provider, provider.notConfigured);
  });

  it("hands the browser to the provider with the configured public callback", async () => {
    configure(provider);

    const response = await provider.connect(internalRequest(provider, "connect"));
    const location = new URL(locationOf(response));

    expect(response.status).toBe(307);
    expect(`${location.origin}${location.pathname}`).toBe(
      provider.authorizationEndpoint,
    );
    expect(location.searchParams.get("redirect_uri")).toBe(
      publicCallbackUrl(provider),
    );
    // The transaction state travels to the provider and stays in a cookie.
    expect([...mocked.jar.values()]).toContain(
      location.searchParams.get("state"),
    );
  });

  it("reports a provider error without leaving the application", async () => {
    const response = await provider.callback(
      internalRequest(provider, "callback?error=access_denied"),
    );

    expectApplicationRedirect(response, provider, provider.providerError);
  });

  it("rejects a state it did not issue and discards the transaction", async () => {
    await startTransaction(provider);

    const response = await provider.callback(
      internalRequest(provider, "callback?code=synthetic-code&state=tampered"),
    );

    expectApplicationRedirect(response, provider, provider.invalidState);
    expect(mocked.jar.size).toBe(0);
  });

  it("reports a failed code exchange for a state it issued", async () => {
    const state = await startTransaction(provider);
    const fetchMock = vi.fn().mockRejectedValue(new Error("synthetic offline"));
    vi.stubGlobal("fetch", fetchMock);

    const response = await provider.callback(
      internalRequest(
        provider,
        `callback?code=synthetic-code&state=${encodeURIComponent(state)}`,
      ),
    );

    // Reaching the provider proves the issued state and cookies were accepted.
    expect(fetchMock).toHaveBeenCalled();
    expectApplicationRedirect(response, provider, provider.exchangeFailed);
  });
});
