import {
  redirectToSameOriginPath,
  toSameOriginPath,
} from "@/lib/http/same-origin-redirect";
import { createClient } from "@/lib/supabase/server";

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
