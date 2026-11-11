import { cookies } from "next/headers";
import {
  ASANA_CREDENTIALS_COOKIE,
  ASANA_OAUTH_PKCE_COOKIE,
  ASANA_OAUTH_STATE_COOKIE,
  encryptAsanaCredentials,
  exchangeAsanaAuthorizationCode,
  verifyAsanaConnection,
  getAsanaClientSecret,
} from "@/infrastructure/integrations/asana";
import { verifySubjectBoundOAuthState } from "@/infrastructure/integrations/oauth-transaction-state";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { redirectToSameOriginPath } from "@/lib/http/same-origin-redirect";

export const dynamic = "force-dynamic";

/** Returns the browser to the Asana integration page, reporting `code`. */
function redirectError(code: string) {
  return redirectToSameOriginPath(`/integracoes/asana?error=${encodeURIComponent(code)}`);
}

/**
 * Completes the Asana OAuth authorization for the signed-in user. The state
 * must match the transaction cookie and be bound to the subject, and the PKCE
 * verifier must be present, before the code is exchanged, the connection is
 * verified and the encrypted credentials are stored. Every outcome returns to
 * the Asana integration page.
 */
export async function GET(request: Request) {
  const claims = await requireAuthenticatedUser();
  const params = new URL(request.url).searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");
  const cookieStore = await cookies();
  const storedState = cookieStore.get(ASANA_OAUTH_STATE_COOKIE)?.value;
  const verifier = cookieStore.get(ASANA_OAUTH_PKCE_COOKIE)?.value;

  cookieStore.delete(ASANA_OAUTH_STATE_COOKIE);
  cookieStore.delete(ASANA_OAUTH_PKCE_COOKIE);

  let stateBoundToSubject = false;
  try {
    stateBoundToSubject = Boolean(
      state &&
        verifySubjectBoundOAuthState(
          state,
          claims.sub,
          getAsanaClientSecret(),
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
    const tokenSet = await exchangeAsanaAuthorizationCode({
      code, codeVerifier: verifier, requestUrl: request.url,
    });
    await verifyAsanaConnection(tokenSet.accessToken);

    cookieStore.set(ASANA_CREDENTIALS_COOKIE, await encryptAsanaCredentials({
      subjectId: claims.sub, ...tokenSet,
    }), {
      httpOnly: true, maxAge: 365 * 24 * 60 * 60, path: "/",
      sameSite: "lax", secure: true,
    });

    return redirectToSameOriginPath("/integracoes/asana?connected=1");
  } catch {
    return redirectError("authorization_failed");
  }
}
