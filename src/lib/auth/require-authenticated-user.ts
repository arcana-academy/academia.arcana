import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isPermittedPersonalSubject } from "@/lib/security/personal-access";

export async function requireAuthenticatedUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub || !isPermittedPersonalSubject(data.claims.sub)) {
    redirect("/login");
  }

  return data.claims;
}
