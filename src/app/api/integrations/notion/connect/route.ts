import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  buildNotionAuthorizationUrl,
  getNotionClientSecret,
  NOTION_OAUTH_STATE_COOKIE,
} from "@/infrastructure/integrations/notion";
import { createSubjectBoundOAuthState } from "@/infrastructure/integrations/oauth-transaction-state";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { redirectToSameOriginPath } from "@/lib/http/same-origin-redirect";

export const dynamic = "force-dynamic";

/**
 * Starts the Notion OAuth authorization for the signed-in user: stores a
 * subject-bound state in a short-lived cookie and hands the browser to the
 * provider's authorization endpoint. Any failure while preparing the hand-off
 * returns to the Notion integration page as `not_configured`.
 */
export async function GET(request: Request) {
  const claims = await requireAuthenticatedUser();

  try {
    const state = createSubjectBoundOAuthState(claims.sub, getNotionClientSecret());
    const cookieStore = await cookies();

    cookieStore.set(NOTION_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      maxAge: 10 * 60,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return NextResponse.redirect(
      buildNotionAuthorizationUrl({
        state,
        requestUrl: request.url,
      }),
    );
  } catch {
    return redirectToSameOriginPath("/integracoes/notion?error=not_configured");
  }
}
