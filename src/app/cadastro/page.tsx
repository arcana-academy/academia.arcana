import { redirect } from "next/navigation";
import { isPersonalModeEnabled } from "@/lib/security/personal-access";
import { AuthForm } from "@/components/auth/AuthForm";
import { pageMetadata } from "@/lib/seo/site-metadata";

export const metadata = pageMetadata("/cadastro");

export default function CadastroPage() {
  if (isPersonalModeEnabled()) redirect("/login");
  return <AuthForm mode="signup" />;
}
