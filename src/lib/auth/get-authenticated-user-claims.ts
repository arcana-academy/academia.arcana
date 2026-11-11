import { createClient } from "@/lib/supabase/server";
import { isPermittedPersonalSubject } from "@/lib/security/personal-access";

export async function getAuthenticatedUserClaims() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub || !isPermittedPersonalSubject(data.claims.sub)) {
    return null;
  }

  return data.claims;
}
