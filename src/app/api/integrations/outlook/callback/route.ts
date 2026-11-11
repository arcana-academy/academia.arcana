import {
  clearOutlookAuthorizationTransaction,
  redeemOutlookAuthorizationCode,
} from "@/infrastructure/integrations/outlook-calendar-oauth";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { redirectToSameOriginPath } from "@/lib/http/same-origin-redirect";

export async function GET(request: Request) {
  const claims = await requireAuthenticatedUser();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error || !code || !state) {
    await clearOutlookAuthorizationTransaction();
    return redirectToSameOriginPath("/cronograma?outlook=error");
  }

  try {
    await redeemOutlookAuthorizationCode(claims.sub, code, state);
    return redirectToSameOriginPath("/cronograma?outlook=connected");
  } catch {
    return redirectToSameOriginPath("/cronograma?outlook=error");
  }
}
