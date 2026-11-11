import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildAsanaAuthorizationUrl,
  createAsanaOAuthVerifier,
  createAsanaPkceChallenge,
  getAsanaClientSecret,
  ASANA_OAUTH_PKCE_COOKIE,
  ASANA_OAUTH_STATE_COOKIE,
} from "@/infrastructure/integrations/asana";
import { createSubjectBoundOAuthState } from "@/infrastructure/integrations/oauth-transaction-state";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { redirectToSameOriginPath } from "@/lib/http/same-origin-redirect";

export const dynamic = "force-dynamic";

/**
 * Starts the Asana OAuth authorization for the signed-in user: stores a
 * subject-bound state and a PKCE verifier in short-lived cookies and hands the
 * browser to the provider's authorization endpoint. Any failure while
 * preparing the hand-off returns to the Asana integration page as
 * `not_configured`.
 */
export async function GET(request: Request) {
  const claims = await requireAuthenticatedUser();
  try {
    const state = createSubjectBoundOAuthState(claims.sub, getAsanaClientSecret());
    const verifier = createAsanaOAuthVerifier();
    const challenge = await createAsanaPkceChallenge(verifier);
    const cookieStore = await cookies();

    cookieStore.set(ASANA_OAUTH_STATE_COOKIE, state, {
      httpOnly: true, maxAge: 600, path: "/", sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    cookieStore.set(ASANA_OAUTH_PKCE_COOKIE, verifier, {
      httpOnly: true, maxAge: 600, path: "/", sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return NextResponse.redirect(buildAsanaAuthorizationUrl({
      state, codeChallenge: challenge, requestUrl: request.url,
    }));
  } catch {
    return redirectToSameOriginPath("/integracoes/asana?error=not_configured");
  }
}
