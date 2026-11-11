import { cookies } from "next/headers";

import {
  encryptNotionCredentials,
  exchangeNotionAuthorizationCode,
  NOTION_CREDENTIALS_COOKIE,
  NOTION_OAUTH_STATE_COOKIE,
  verifyNotionConnection,
  getNotionClientSecret,
} from "@/infrastructure/integrations/notion";
import { verifySubjectBoundOAuthState } from "@/infrastructure/integrations/oauth-transaction-state";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { redirectToSameOriginPath } from "@/lib/http/same-origin-redirect";

export const dynamic = "force-dynamic";

/** Returns the browser to the Notion integration page, reporting `code`. */
function redirectError(code: string) {
  return redirectToSameOriginPath(
    `/integracoes/notion?error=${encodeURIComponent(code)}`,
  );
}

export async function GET(request: Request) {
  const claims = await requireAuthenticatedUser();
  const searchParams = new URL(request.url).searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const cookieStore = await cookies();
  const storedState = cookieStore.get(NOTION_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(NOTION_OAUTH_STATE_COOKIE);

  let stateBoundToSubject = false;
  try {
    stateBoundToSubject = Boolean(
      state &&
        verifySubjectBoundOAuthState(
          state,
          claims.sub,
          getNotionClientSecret(),
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
    !stateBoundToSubject
  ) {
    return redirectError("invalid_state");
  }

  try {
    const tokenSet = await exchangeNotionAuthorizationCode({
      code,
      requestUrl: request.url,
    });

    await verifyNotionConnection(tokenSet.accessToken, {
      id: tokenSet.workspaceId,
      name: tokenSet.workspaceName,
    });

    const credentials = {
      subjectId: claims.sub,
      ...tokenSet,
    };

    cookieStore.set(
      NOTION_CREDENTIALS_COOKIE,
      await encryptNotionCredentials(credentials),
      {
        httpOnly: true,
        maxAge: 365 * 24 * 60 * 60,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    );

    return redirectToSameOriginPath("/integracoes/notion?connected=1");
  } catch {
    return redirectError("authorization_failed");
  }
}
