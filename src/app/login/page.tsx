import { isPersonalModeEnabled } from "@/lib/security/personal-access";
import { AuthForm } from "@/components/auth/AuthForm";
import { pageMetadata } from "@/lib/seo/site-metadata";

export const metadata = pageMetadata("/login");

export default function LoginPage() {
  return <AuthForm mode="login" showSignUpLink={!isPersonalModeEnabled()} />;
}
