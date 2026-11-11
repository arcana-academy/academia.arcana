import { NextResponse } from "next/server";

import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { redirectToSameOriginPath } from "@/lib/http/same-origin-redirect";
import { OutlookCalendarError } from "@/infrastructure/integrations/outlook-calendar";
import { createOutlookAuthorizationUrl } from "@/infrastructure/integrations/outlook-calendar-oauth";

/**
 * Starts the Outlook Calendar OAuth authorization for the signed-in user by
 * handing the browser to the Microsoft identity platform.
 *
 * When the provider is not configured the browser returns to the Cronograma,
 * as it does after a failed callback. Any other failure is rethrown, so it
 * surfaces as a server error instead of passing for a missing configuration.
 */
export async function GET() {
  const claims = await requireAuthenticatedUser();

  let authorizationUrl: string;
  try {
    authorizationUrl = await createOutlookAuthorizationUrl(claims.sub);
  } catch (error) {
    // Building the authorization URL raises this error only for an incomplete
    // MICROSOFT_ENTRA_* configuration.
    if (!(error instanceof OutlookCalendarError)) {
      throw error;
    }

    return redirectToSameOriginPath("/cronograma?outlook=error");
  }

  return NextResponse.redirect(authorizationUrl);
}
