import { cookies } from "next/headers";

import {
  exchangeTodoistAuthorizationCode,
  TODOIST_CREDENTIALS_COOKIE,
  encryptTodoistCredentials,
  TODOIST_OAUTH_PKCE_COOKIE,
  TODOIST_OAUTH_STATE_COOKIE,
  verifyTodoistConnection,
  getTodoistClientSecret,
} from "@/infrastructure/integrations/todoist";
import { verifySubjectBoundOAuthState } from "@/infrastructure/integrations/oauth-transaction-state";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { redirectToSameOriginPath } from "@/lib/http/same-origin-redirect";

export const dynamic = "force-dynamic";

/** Returns the browser to the Todoist integration page, reporting `code`. */
function redirectError(code: string) {
  return redirectToSameOriginPath(
    `/integracoes/todoist?error=${encodeURIComponent(code)}`,
  );
}

/**
 * Completes the Todoist OAuth authorization for the signed-in user. The state
 * must match the transaction cookie and be bound to the subject, and the PKCE
 * verifier must be present, before the code is exchanged, the connection is
 * verified and the encrypted credentials are stored. Every outcome returns to
 * the Todoist integration page.
 */
export async function GET(request: Request) {
  const claims = await requireAuthenticatedUser();

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const cookieStore = await cookies();
  const storedState = cookieStore.get(TODOIST_OAUTH_STATE_COOKIE)?.value;
  const verifier = cookieStore.get(TODOIST_OAUTH_PKCE_COOKIE)?.value;

  cookieStore.delete(TODOIST_OAUTH_STATE_COOKIE);
  cookieStore.delete(TODOIST_OAUTH_PKCE_COOKIE);

  let stateBoundToSubject = false;
  try {
    stateBoundToSubject = Boolean(
      state &&
        verifySubjectBoundOAuthState(
          state,
          claims.sub,
          getTodoistClientSecret(),
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
    const tokenSet = await exchangeTodoistAuthorizationCode({
      code,
      codeVerifier: verifier,
      requestUrl: request.url,
    });

    await verifyTodoistConnection(tokenSet.accessToken);

    const credentials = {
      subjectId: claims.sub,
      ...tokenSet,
    };

    cookieStore.set(
      TODOIST_CREDENTIALS_COOKIE,
      await encryptTodoistCredentials(credentials),
      {
        httpOnly: true,
        maxAge: 365 * 24 * 60 * 60,
        path: "/",
        sameSite: "lax",
        secure: true,
      },
    );

    return redirectToSameOriginPath("/integracoes/todoist?connected=1");
  } catch {
    return redirectError("authorization_failed");
  }
}
