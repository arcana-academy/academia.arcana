import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  buildMicrosoftSharePointAuthorizationUrl,
  createMicrosoftOAuthVerifier,
  createMicrosoftPkceChallenge,
  getMicrosoftSharePointClientSecret,
  MICROSOFT_SHAREPOINT_OAUTH_PKCE_COOKIE,
  MICROSOFT_SHAREPOINT_OAUTH_STATE_COOKIE,
} from "@/infrastructure/integrations/microsoft-sharepoint";
import { createSubjectBoundOAuthState } from "@/infrastructure/integrations/oauth-transaction-state";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { redirectToSameOriginPath } from "@/lib/http/same-origin-redirect";

export const dynamic = "force-dynamic";

/**
 * Starts the Microsoft SharePoint OAuth authorization for the signed-in user:
 * stores a subject-bound state and a PKCE verifier in short-lived cookies and
 * hands the browser to the provider's authorization endpoint. Any failure
 * while preparing the hand-off returns to the integrations page as
 * `microsoft_sharepoint_not_configured`.
 */
export async function GET(request: Request) {
  const claims = await requireAuthenticatedUser();

  try {
    const state = createSubjectBoundOAuthState(
      claims.sub,
      getMicrosoftSharePointClientSecret(),
    );
    const verifier = createMicrosoftOAuthVerifier();
    const challenge = await createMicrosoftPkceChallenge(verifier);
    const cookieStore = await cookies();

    cookieStore.set(MICROSOFT_SHAREPOINT_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      maxAge: 10 * 60,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    cookieStore.set(MICROSOFT_SHAREPOINT_OAUTH_PKCE_COOKIE, verifier, {
      httpOnly: true,
      maxAge: 10 * 60,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return NextResponse.redirect(
      buildMicrosoftSharePointAuthorizationUrl({
        state,
        codeChallenge: challenge,
        requestUrl: request.url,
      }),
    );
  } catch {
    return redirectToSameOriginPath(
      "/integracoes?error=microsoft_sharepoint_not_configured",
    );
  }
}
