// @vitest-environment node
// Route handlers run on the Node.js runtime, so the helper is exercised against
// the same URL implementation that parses redirect targets in production.
import { describe, expect, it } from "vitest";

import {
  redirectToSameOriginPath,
  toSameOriginPath,
} from "./same-origin-redirect";

/** Origin the browser used; an accepted reference must resolve back to it. */
const PUBLIC_ORIGIN = "https://academia.example.org";

/** Resolves `reference` the way a browser resolves a `Location` header. */
function resolvedOrigin(reference: string): string {
  return new URL(reference, `${PUBLIC_ORIGIN}/auth/callback`).origin;
}

describe("toSameOriginPath", () => {
  it.each([
    ["/", "/"],
    ["/workspace", "/workspace"],
    ["/workspace?view=tree#current", "/workspace?view=tree#current"],
    ["/integracoes/asana?error=access_denied", "/integracoes/asana?error=access_denied"],
    ["/a/../cronograma", "/cronograma"],
    ["/grimorio//capitulo", "/grimorio//capitulo"],
    ["/busca?q=a\\b", "/busca?q=a\\b"],
  ])("keeps the application path %s", (value, expected) => {
    expect(toSameOriginPath(value)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    "",
    "workspace",
    " /workspace",
    "https://evil.example",
    "javascript:alert(1)",
    "//evil.example",
    "/\\evil.example",
    "/\\/evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "/\r\\evil.example",
    "\t//evil.example",
  ])("rejects the non-relative value %j", (value) => {
    expect(toSameOriginPath(value)).toBeNull();
  });

  // Dot segments are removed during normalisation, which used to leave a
  // protocol-relative reference behind and let the redirect leave the origin.
  it.each([
    "/.//evil.example",
    "/..//evil.example",
    "/a/..//evil.example",
    "/%2e//evil.example",
    "/%2E%2e//evil.example",
    "/./\\evil.example",
    "/.\\/evil.example",
    "/.//evil.example/path?x=1#fragment",
  ])("rejects %j, which normalises to a protocol-relative reference", (value) => {
    expect(toSameOriginPath(value)).toBeNull();
  });

  // The host used internally to parse candidates is not a valid target either:
  // accepting it would hand the browser a reference to a host that is not ours.
  it.each([
    "/.//same-origin.invalid/path",
    "/a/..//same-origin.invalid",
    "/\\same-origin.invalid/path",
    "/\t/same-origin.invalid/path",
  ])("rejects %j, which names the internal parse origin", (value) => {
    expect(toSameOriginPath(value)).toBeNull();
  });

  it("only yields single-slash references that stay on the requesting origin", () => {
    const fragments = [
      "/",
      "\\",
      ".",
      "..",
      "%2e",
      "\t",
      "a",
      "evil.example",
      "same-origin.invalid",
      "?",
      "#",
      "@",
    ];
    const candidates = new Set<string>();
    let sequences = [""];

    // Every sequence of one to four fragments after the leading slash.
    for (let length = 1; length <= 4; length += 1) {
      sequences = sequences.flatMap((prefix) =>
        fragments.map((fragment) => `${prefix}${fragment}`),
      );
      sequences.forEach((sequence) => candidates.add(`/${sequence}`));
    }

    const offenders: string[] = [];
    let accepted = 0;

    for (const candidate of candidates) {
      const path = toSameOriginPath(candidate);

      if (path === null) continue;

      accepted += 1;

      if (
        !path.startsWith("/") ||
        path.startsWith("//") ||
        /[\\\t\n\r]/.test(path.split(/[?#]/)[0]) ||
        resolvedOrigin(path) !== PUBLIC_ORIGIN
      ) {
        offenders.push(`${JSON.stringify(candidate)} -> ${JSON.stringify(path)}`);
      }
    }

    expect(offenders).toEqual([]);
    // Guards against a vacuous pass: the sweep must both accept and reject.
    expect(accepted).toBeGreaterThan(0);
    expect(accepted).toBeLessThan(candidates.size);
  });
});

describe("redirectToSameOriginPath", () => {
  it("answers with a relative Location and no host of its own", () => {
    const response = redirectToSameOriginPath("/login?error=auth");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/login?error=auth");
    expect(resolvedOrigin(response.headers.get("location")!)).toBe(PUBLIC_ORIGIN);
  });

  it("supports See Other for redirects that follow a form submission", () => {
    const response = redirectToSameOriginPath("/cronograma", 303);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/cronograma");
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/.//evil.example",
    "/.//same-origin.invalid",
    "",
  ])("refuses to redirect to %j", (target) => {
    expect(() => redirectToSameOriginPath(target)).toThrow(TypeError);
  });
});
