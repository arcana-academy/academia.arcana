import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Route handlers run behind the hosting reverse proxy, where `request.url`
 * carries the internal listener origin. A redirect resolved against it sends
 * the browser to an unreachable address, so redirects into the application
 * must use the relative helper and only provider hand-offs may stay absolute.
 */
const appRoot = resolve(process.cwd(), "src/app");

/** Handlers allowed to redirect to an absolute, provider-owned URL. */
const PROVIDER_HANDOFF_HANDLERS = [
  "src/app/api/integrations/asana/connect/route.ts",
  "src/app/api/integrations/microsoft-sharepoint/connect/route.ts",
  "src/app/api/integrations/notion/connect/route.ts",
  "src/app/api/integrations/outlook/authorize/route.ts",
  "src/app/api/integrations/todoist/connect/route.ts",
  "src/app/api/integrations/trello/connect/route.ts",
] as const;

/** Handlers that send the browser back into the application. */
const APPLICATION_REDIRECT_HANDLERS = [
  "src/app/auth/callback/route.ts",
  "src/app/api/integrations/asana/callback/route.ts",
  "src/app/api/integrations/asana/connect/route.ts",
  "src/app/api/integrations/microsoft-sharepoint/callback/route.ts",
  "src/app/api/integrations/microsoft-sharepoint/connect/route.ts",
  "src/app/api/integrations/notion/callback/route.ts",
  "src/app/api/integrations/notion/connect/route.ts",
  "src/app/api/integrations/outlook/authorize/route.ts",
  "src/app/api/integrations/outlook/callback/route.ts",
  "src/app/api/integrations/outlook/disconnect/route.ts",
  "src/app/api/integrations/todoist/callback/route.ts",
  "src/app/api/integrations/todoist/connect/route.ts",
  "src/app/api/integrations/trello/callback/route.ts",
  "src/app/api/integrations/trello/connect/route.ts",
] as const;

const ABSOLUTE_REDIRECT_CALL = /\b(?:Next)?Response\.redirect\(/;
const REDIRECT_RESOLVED_FROM_A_URL = /\b(?:Next)?Response\.redirect\(\s*new URL\(/;
const RELATIVE_REDIRECT_CALL = /\bredirectToSameOriginPath\(/;

function collectRouteHandlers(directory: string): string[] {
  const handlers: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      handlers.push(...collectRouteHandlers(path));
    } else if (entry.name === "route.ts") {
      handlers.push(relative(process.cwd(), path).split(sep).join("/"));
    }
  }

  return handlers.sort();
}

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const routeHandlers = collectRouteHandlers(appRoot);

describe("route handler redirect origin contract", () => {
  it("inspects every route handler of the application", () => {
    expect(routeHandlers.length).toBeGreaterThan(0);
    expect(routeHandlers).toEqual(
      expect.arrayContaining([
        ...PROVIDER_HANDOFF_HANDLERS,
        ...APPLICATION_REDIRECT_HANDLERS,
      ]),
    );
  });

  it.each(routeHandlers)(
    "%s does not resolve a redirect against a request-derived URL",
    (path) => {
      expect(source(path)).not.toMatch(REDIRECT_RESOLVED_FROM_A_URL);
    },
  );

  it("keeps absolute redirects limited to the provider hand-off handlers", () => {
    const handlersWithAbsoluteRedirects = routeHandlers.filter((path) =>
      ABSOLUTE_REDIRECT_CALL.test(source(path)),
    );

    expect(handlersWithAbsoluteRedirects).toEqual(
      [...PROVIDER_HANDOFF_HANDLERS].sort(),
    );
  });

  it.each(APPLICATION_REDIRECT_HANDLERS)(
    "%s returns to the application through the relative redirect helper",
    (path) => {
      expect(source(path)).toMatch(RELATIVE_REDIRECT_CALL);
    },
  );
});
