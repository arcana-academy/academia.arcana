import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  isPermittedPersonalSubject,
  isPersonalModeEnabled,
} from "@/lib/security/personal-access";

function safeNextPath(value: string | null, origin: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  try {
    const destination = new URL(value, origin);

    if (destination.origin !== origin) {
      return "/";
    }

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/";
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNextPath(requestUrl.searchParams.get("next"), requestUrl.origin);

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=auth", requestUrl.origin),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL("/login?error=auth", requestUrl.origin),
    );
  }

  // This callback deliberately remains public for password recovery. Reject a
  // foreign session immediately, rather than persisting it until a later page
  // or API request is checked by the proxy.
  if (isPersonalModeEnabled()) {
    const { data, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError || !isPermittedPersonalSubject(data?.claims?.sub)) {
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) {
        return NextResponse.json(
          { error: "Não foi possível encerrar a sessão não autorizada." },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
      return NextResponse.redirect(
        new URL("/login?error=auth", requestUrl.origin),
      );
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
