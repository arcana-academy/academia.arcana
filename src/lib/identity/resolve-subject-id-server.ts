import { createClient } from "@/lib/supabase/server";
import { isPermittedPersonalSubject } from "@/lib/security/personal-access";

import { createResolveSubjectId } from "./resolve-subject-id";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type CreateSupabaseClient = () => Promise<SupabaseServerClient>;

export function createResolveSubjectIdServer(
  createSupabaseClient: CreateSupabaseClient = createClient,
): () => Promise<string | null> {
  return createResolveSubjectId(async () => {
    const supabase = await createSupabaseClient();

    const result = await supabase.auth.getClaims();

    return {
      data: {
        claims: isPermittedPersonalSubject(result.data?.claims?.sub)
          ? result.data?.claims ?? null
          : null,
      },
      error: result.error,
    };
  });
}
