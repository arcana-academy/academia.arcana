import {
  clearLegacyOutlookTokenCookies,
  clearOutlookTokens,
} from "@/infrastructure/integrations/outlook-calendar-session";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { redirectToSameOriginPath } from "@/lib/http/same-origin-redirect";

export async function POST() {
  const claims = await requireAuthenticatedUser();
  await clearOutlookTokens(claims.sub);
  await clearLegacyOutlookTokenCookies();
  // See Other: the browser must fetch the Cronograma with GET instead of
  // replaying the disconnect form submission against the page.
  return redirectToSameOriginPath("/cronograma?outlook=disconnected", 303);
}
