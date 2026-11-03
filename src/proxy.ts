import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

import {
  createContentSecurityPolicy,
  getContentSecurityPolicyHeaderName,
} from "@/lib/security/csp";
import { isPrivateRoutePath } from "@/lib/security/private-routes";
import {
  getPersonalOwnerSubjectId,
  isPersonalModeEnabled,
  isPersonalModePublicPath,
  isSyntheticLocalPreview,
} from "@/lib/security/personal-access";
import { updateSession } from "@/lib/supabase/proxy";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const PERSONAL_NO_INDEX = "noindex, nofollow, noarchive";

function isCrossOriginMutation(request: NextRequest): boolean {
  if (SAFE_METHODS.has((request.method ?? "GET").toUpperCase())) return false;

  const origin = request.headers.get("origin");
  // Non-browser clients may omit Origin; browsers include it on unsafe methods.
  if (!origin) return false;

  try {
    const originUrl = new URL(origin);
    if (originUrl.origin === request.nextUrl.origin) return false;

    // Behind a reverse proxy, Next.js can normalize nextUrl to an internal host
    // while the browser's Origin still names the public Host sent to the app.
    // The request Host is part of the actual connection target, unlike Origin.
    const host = request.headers.get("host");
    if (!host) return true;
    const hostOrigin = new URL(`${request.nextUrl.protocol}//${host}`).origin;
    return originUrl.origin !== hostOrigin;
  } catch {
    return true;
  }
}

/**
 * Resolves the request pathname without ever throwing.
 *
 * Next.js always provides `nextUrl` on a middleware request; the fallbacks keep
 * the proxy from crashing on a malformed request. An unresolvable path is
 * treated as public, and the page-level guard still protects its data.
 */
function resolvePathname(request: NextRequest): string {
  const fromNextUrl = request.nextUrl?.pathname;

  if (typeof fromNextUrl === "string" && fromNextUrl.length > 0) {
    return fromNextUrl;
  }

  try {
    return new URL(request.url).pathname;
  } catch {
    return "/";
  }
}

export async function proxy(request: NextRequest) {
  if (isCrossOriginMutation(request)) {
    return NextResponse.json(
      { error: "cross_origin_request_blocked" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const nonce = Buffer.from(randomUUID()).toString("base64");
  const requestHeaders = new Headers(request.headers);
  const pathname = resolvePathname(request);
  const isDevelopment = process.env.NODE_ENV === "development";
  const contentSecurityPolicy = createContentSecurityPolicy(nonce, {
    isDevelopment,
  });
  // Development sends the policy as report-only so HMR/Fast Refresh keep
  // working; production always enforces it.
  const cspHeaderName = getContentSecurityPolicyHeaderName({ isDevelopment });

  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(cspHeaderName, contentSecurityPolicy);

  const personalMode = isPersonalModeEnabled();
  const ownerId = personalMode ? getPersonalOwnerSubjectId() : null;

  // A misconfigured personal deployment must never silently become public.
  if (personalMode && !ownerId && pathname !== "/api/health" && pathname !== "/robots.txt") {
    return NextResponse.json(
      { error: "personal_mode_configuration_unavailable" },
      { status: 503, headers: {
        "Cache-Control": "no-store",
        [cspHeaderName]: contentSecurityPolicy,
        "X-Robots-Tag": PERSONAL_NO_INDEX,
      } },
    );
  }

  // Hide the sign-up entrypoint at the edge, not only in the UI.
  if ((personalMode || isSyntheticLocalPreview()) && pathname === "/cadastro") {
    const redirectResponse = NextResponse.redirect(new URL("/login", request.url));
    redirectResponse.headers.set("Cache-Control", "no-store");
    redirectResponse.headers.set(cspHeaderName, contentSecurityPolicy);
    redirectResponse.headers.set("X-Robots-Tag", PERSONAL_NO_INDEX);
    return redirectResponse;
  }

  // Liveness must not depend on an external Auth session refresh.
  // Keep the CSP/nonce flow unchanged; readiness and protected routes still validate sessions.
  // Gated routes resolve their session here, before the streamed shell can be
  // flushed, so anonymous visitors receive a real 307 instead of a 200 document.
  const response =
    pathname === "/api/health" || (personalMode && pathname === "/robots.txt")
      ? NextResponse.next({ request: { headers: requestHeaders } })
      : await updateSession(request, requestHeaders, {
          requireSession:
            isPrivateRoutePath(pathname) ||
            (personalMode && !isPersonalModePublicPath(pathname)),
          ...(personalMode ? {
            personalOwnerSubjectId: ownerId ?? undefined,
            isApiRequest: pathname.startsWith("/api/"),
          } : {}),
        });
  response.headers.set(cspHeaderName, contentSecurityPolicy);
  if (personalMode) response.headers.set("X-Robots-Tag", PERSONAL_NO_INDEX);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
