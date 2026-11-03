import { redirect } from "next/navigation";

import { AcademiaArcanaLanding } from "@/components/generated/AcademiaArcanaLanding";
import { createClient } from "@/lib/supabase/server";
import { pageMetadata } from "@/lib/seo/site-metadata";
import { isPersonalModeEnabled, isSyntheticLocalPreview } from "@/lib/security/personal-access";

export const metadata = pageMetadata("/");

async function hasAuthenticatedSession(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    return Boolean(data?.claims?.sub);
  } catch {
    return false;
  }
}

/** Authenticated visitors go to the real Sanctuary; personal/local QA enters at login. */
export default async function Page() {
  if (await hasAuthenticatedSession()) redirect("/santuario");
  if (isPersonalModeEnabled() || isSyntheticLocalPreview()) redirect("/login");

  return <AcademiaArcanaLanding personalMode={false} />;
}
