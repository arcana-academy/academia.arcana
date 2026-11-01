/**
 * Opt-in, server-only owner gate for Academia Arcana personal hosting.
 *
 * This is an application access gate, not a replacement for Supabase RLS.
 * Signup must also be disabled in Supabase Auth before deployment.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPersonalModeEnabled(): boolean {
  return process.env.ACADEMIA_ARCANA_PERSONAL_MODE === "true";
}

export function getPersonalOwnerSubjectId(): string | null {
  const id = process.env.ACADEMIA_ARCANA_PERSONAL_OWNER_ID?.trim();
  return id && UUID_PATTERN.test(id) ? id.toLowerCase() : null;
}

/** Auth flows remain reachable so the existing owner can sign in or recover access. */
export function isPersonalModePublicPath(pathname: string): boolean {
  return pathname === "/login" ||
    pathname === "/recuperar-senha" ||
    pathname === "/auth/callback";
}
