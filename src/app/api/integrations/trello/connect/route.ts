import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  buildTrelloAuthorizationUrl,
  createOAuthVerifier,
  createPkceChallenge,
  getTrelloClientSecret,
  TRELLO_OAUTH_PKCE_COOKIE,
  TRELLO_OAUTH_STATE_COOKIE,
} from "@/infrastructure/integrations/trello";
import { createSubjectBoundOAuthState } from "@/infrastructure/integrations/oauth-transaction-state";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { redirectToSameOriginPath } from "@/lib/http/same-origin-redirect";

export const dynamic = "force-dynamic";

/**
 * Starts the Trello OAuth authorization for the signed-in user: stores a
 * subject-bound state and a PKCE verifier in short-lived cookies and hands the
 * browser to the provider's authorization endpoint. Any failure while
 * preparing the hand-off returns to the Trello integration page as
 * `not_configured`.
 */
export async function GET(request: Request) {
  const claims = await requireAuthenticatedUser();

  try {
    const state = createSubjectBoundOAuthState(claims.sub, getTrelloClientSecret());
    const verifier = createOAuthVerifier();
    const challenge = await createPkceChallenge(verifier);
    const cookieStore = await cookies();

    cookieStore.set(TRELLO_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      maxAge: 10 * 60,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    cookieStore.set(TRELLO_OAUTH_PKCE_COOKIE, verifier, {
      httpOnly: true,
      maxAge: 10 * 60,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return NextResponse.redirect(
      buildTrelloAuthorizationUrl({
        state,
        codeChallenge: challenge,
        requestUrl: request.url,
      }),
    );
  } catch {
    return redirectToSameOriginPath("/integracoes/trello?error=not_configured");
  }
}
