import { cookies } from "next/headers";

import {
  encryptMicrosoftSharePointCredentials,
  exchangeMicrosoftSharePointAuthorizationCode,
  MICROSOFT_SHAREPOINT_CREDENTIALS_COOKIE,
  MICROSOFT_SHAREPOINT_OAUTH_PKCE_COOKIE,
  MICROSOFT_SHAREPOINT_OAUTH_STATE_COOKIE,
  verifyMicrosoftSharePointConnection,
  getMicrosoftSharePointClientSecret,
} from "@/infrastructure/integrations/microsoft-sharepoint";
import { verifySubjectBoundOAuthState } from "@/infrastructure/integrations/oauth-transaction-state";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { redirectToSameOriginPath } from "@/lib/http/same-origin-redirect";

export const dynamic = "force-dynamic";

/**
 * Completes the Microsoft SharePoint OAuth authorization for the signed-in
 * user. The state must match the transaction cookie and be bound to the
 * subject, and the PKCE verifier must be present, before the code is
 * exchanged, the connection is verified and the encrypted credentials are
 * stored. Every outcome returns to the integrations page.
 */
export async function GET(request: Request) {
  const user = await requireAuthenticatedUser();
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(MICROSOFT_SHAREPOINT_OAUTH_STATE_COOKIE)?.value;
  const verifier = cookieStore.get(MICROSOFT_SHAREPOINT_OAUTH_PKCE_COOKIE)?.value;

  cookieStore.delete(MICROSOFT_SHAREPOINT_OAUTH_STATE_COOKIE);
  cookieStore.delete(MICROSOFT_SHAREPOINT_OAUTH_PKCE_COOKIE);

  let stateBoundToSubject = false;
  try {
    stateBoundToSubject = Boolean(
      state &&
        verifySubjectBoundOAuthState(
          state,
          user.sub,
          getMicrosoftSharePointClientSecret(),
        ),
    );
  } catch {
    stateBoundToSubject = false;
  }

  if (
    error ||
    !state ||
    !expectedState ||
    state !== expectedState ||
    !code ||
    !verifier ||
    !stateBoundToSubject
  ) {
    return redirectToSameOriginPath(
      "/integracoes?error=microsoft_sharepoint_authorization_failed",
    );
  }

  try {
    const credentials = await exchangeMicrosoftSharePointAuthorizationCode({
      code,
      codeVerifier: verifier,
      requestUrl: request.url,
      subjectId: user.sub,
    });

    await verifyMicrosoftSharePointConnection(credentials.accessToken);

    cookieStore.set(
      MICROSOFT_SHAREPOINT_CREDENTIALS_COOKIE,
      await encryptMicrosoftSharePointCredentials(credentials),
      {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    );

    return redirectToSameOriginPath(
      "/integracoes?microsoft_sharepoint=connected",
    );
  } catch {
    return redirectToSameOriginPath(
      "/integracoes?error=microsoft_sharepoint_exchange_failed",
    );
  }
}
