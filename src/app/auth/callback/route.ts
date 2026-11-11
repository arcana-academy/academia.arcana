import {
  redirectToSameOriginPath,
  toSameOriginPath,
} from "@/lib/http/same-origin-redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * Completes the Supabase Auth code flow: exchanges the authorization `code`
 * for a session and sends the browser to the application path in `next`, or
 * to `/` when `next` is not one. A missing code or a failed exchange leads to
 * `/login?error=auth`.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  // Anything that is not an application-relative path falls back to the root.
  const next = toSameOriginPath(requestUrl.searchParams.get("next")) ?? "/";

  if (!code) {
    return redirectToSameOriginPath("/login?error=auth");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirectToSameOriginPath("/login?error=auth");
  }

  return redirectToSameOriginPath(next);
}
