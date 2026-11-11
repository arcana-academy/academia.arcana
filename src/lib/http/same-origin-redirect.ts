import { NextResponse } from "next/server";

/**
 * Placeholder origin used only to parse candidate paths. It is never written
 * to a response, so no deployment hostname has to be known or trusted here.
 */
const PARSE_ORIGIN = "https://same-origin.invalid";

/** Tabs and line breaks, which URL parsers drop before reading a reference. */
const IGNORED_BY_URL_PARSERS = /[\t\n\r]/g;

/**
 * A path-absolute reference: one leading slash that is not followed by a
 * second one. Browsers read `\` as `/`, so `/\host` is as protocol-relative
 * as `//host`.
 */
const PATH_ABSOLUTE_REFERENCE = /^\/(?![/\\])/;

/** Redirect statuses a route handler may answer with. */
export type SameOriginRedirectStatus = 303 | 307;

/**
 * Parses `reference` against the placeholder origin, or returns `null` when
 * it is not a path-absolute reference or cannot be parsed at all.
 */
function parsePathAbsoluteReference(reference: string): URL | null {
  if (!PATH_ABSOLUTE_REFERENCE.test(reference)) {
    return null;
  }

  try {
    return new URL(reference, PARSE_ORIGIN);
  } catch {
    return null;
  }
}

/**
 * Normalises `value` into an application-relative reference
 * (`/path?query#fragment`), or returns `null` when it is not one.
 *
 * Absolute URLs, protocol-relative references (`//host`), their backslash and
 * whitespace variants (`/\host`, `/<tab>/host`) and malformed input are
 * rejected. The normalised path is checked again because dot-segment removal
 * can turn an innocent looking `/.//host` into the protocol-relative `//host`.
 */
export function toSameOriginPath(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const parsed = parsePathAbsoluteReference(
    value.replace(IGNORED_BY_URL_PARSERS, ""),
  );

  if (!parsed) {
    return null;
  }

  const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;

  // A path-absolute reference cannot change the origin while it is parsed;
  // that comparison is kept as defence in depth. The serialised path is what
  // the browser will read, so it must not start with a second slash either.
  if (parsed.origin !== PARSE_ORIGIN || path.startsWith("//")) {
    return null;
  }

  return path;
}

/**
 * Redirects the browser to a path of this application.
 *
 * The `Location` header is deliberately relative. Behind the hosting reverse
 * proxy a route handler's `request.url` carries the internal listener origin
 * (for example `https://localhost:10000`), so an absolute URL derived from it
 * sends the browser to an address it cannot reach. A relative reference is
 * resolved by the browser against the public URL it actually requested, which
 * is also how the request proxy's own redirects are delivered, and it does not
 * require trusting any forwarded host header.
 *
 * @throws {TypeError} When `path` is not an application-relative reference.
 */
export function redirectToSameOriginPath(
  path: string,
  status: SameOriginRedirectStatus = 307,
): NextResponse {
  const location = toSameOriginPath(path);

  if (!location) {
    throw new TypeError(
      "Redirect target must be an application-relative path.",
    );
  }

  return new NextResponse(null, { status, headers: { Location: location } });
}
