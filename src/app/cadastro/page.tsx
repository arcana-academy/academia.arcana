import { redirect } from "next/navigation";
import { isPersonalModeEnabled, isSyntheticLocalPreview } from "@/lib/security/personal-access";
import { AuthForm } from "@/components/auth/AuthForm";
import { pageMetadata } from "@/lib/seo/site-metadata";

// Personal access is activated at runtime, never baked into static HTML.
export const dynamic = "force-dynamic";

export const metadata = pageMetadata("/cadastro");

export default function CadastroPage() {
  if (isPersonalModeEnabled() || isSyntheticLocalPreview()) redirect("/login");
  return <AuthForm mode="signup" />;
}
