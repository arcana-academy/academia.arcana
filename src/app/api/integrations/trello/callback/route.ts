import { cookies } from "next/headers";

import {
  exchangeTrelloAuthorizationCode,
  encryptTrelloCredentials,
  TRELLO_CREDENTIALS_COOKIE,
  TRELLO_OAUTH_PKCE_COOKIE,
  TRELLO_OAUTH_STATE_COOKIE,
  verifyTrelloConnection,
  getTrelloClientSecret,
} from "@/infrastructure/integrations/trello";
import { verifySubjectBoundOAuthState } from "@/infrastructure/integrations/oauth-transaction-state";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { redirectToSameOriginPath } from "@/lib/http/same-origin-redirect";

export const dynamic = "force-dynamic";

function redirectError(code: string) {
  return redirectToSameOriginPath(
    `/integracoes/trello?error=${encodeURIComponent(code)}`,
  );
}

export async function GET(request: Request) {
  const claims = await requireAuthenticatedUser();
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const cookieStore = await cookies();
  const storedState = cookieStore.get(TRELLO_OAUTH_STATE_COOKIE)?.value;
  const verifier = cookieStore.get(TRELLO_OAUTH_PKCE_COOKIE)?.value;

  cookieStore.delete(TRELLO_OAUTH_STATE_COOKIE);
  cookieStore.delete(TRELLO_OAUTH_PKCE_COOKIE);

  let stateBoundToSubject = false;
  try {
    stateBoundToSubject = Boolean(
      state &&
        verifySubjectBoundOAuthState(
          state,
          claims.sub,
          getTrelloClientSecret(),
        ),
    );
  } catch {
    stateBoundToSubject = false;
  }

  if (error) return redirectError(error);
  if (
    !code ||
    !state ||
    !storedState ||
    state !== storedState ||
    !verifier ||
    !stateBoundToSubject
  ) {
    return redirectError("invalid_state");
  }

  try {
    const tokenSet = await exchangeTrelloAuthorizationCode({
      code,
      codeVerifier: verifier,
      requestUrl: request.url,
    });
    const verification = await verifyTrelloConnection(tokenSet.accessToken);

    cookieStore.set(
      TRELLO_CREDENTIALS_COOKIE,
      await encryptTrelloCredentials({ subjectId: claims.sub, ...tokenSet }),
      {
        httpOnly: true,
        maxAge: 365 * 24 * 60 * 60,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    );

    return redirectToSameOriginPath(
      `/integracoes/trello?connected=1&name=${encodeURIComponent(
        verification.user.fullName ?? verification.user.username ?? "Trello",
      )}`,
    );
  } catch {
    return redirectError("authorization_failed");
  }
}
