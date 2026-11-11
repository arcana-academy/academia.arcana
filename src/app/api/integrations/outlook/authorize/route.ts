import { NextResponse } from "next/server";

import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { redirectToSameOriginPath } from "@/lib/http/same-origin-redirect";
import { createOutlookAuthorizationUrl } from "@/infrastructure/integrations/outlook-calendar-oauth";

export async function GET() {
  const claims = await requireAuthenticatedUser();

  let authorizationUrl: string;
  try {
    authorizationUrl = await createOutlookAuthorizationUrl(claims.sub);
  } catch {
    // An unconfigured provider must lead back to the Cronograma, as the
    // callback does, instead of surfacing as an unhandled server error.
    return redirectToSameOriginPath("/cronograma?outlook=error");
  }

  return NextResponse.redirect(authorizationUrl);
}
