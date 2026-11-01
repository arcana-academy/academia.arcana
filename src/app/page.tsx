import { redirect } from "next/navigation";

import { AcademiaArcanaLanding } from "@/components/generated/AcademiaArcanaLanding";
import { createClient } from "@/lib/supabase/server";
import { pageMetadata } from "@/lib/seo/site-metadata";
import { isPersonalModeEnabled } from "@/lib/security/personal-access";

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

/** Public entry point: unauthenticated users see the learning journey landing. */
export default async function Page() {
  if (await hasAuthenticatedSession()) redirect("/santuario");

  return <AcademiaArcanaLanding personalMode={isPersonalModeEnabled()} />;
}
