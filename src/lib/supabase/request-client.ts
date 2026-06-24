import { createClient as createTokenClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createClient as createServerClient } from "./server";

interface AuthenticatedRequestClient {
  supabase: SupabaseClient;
  user: User | null;
}

export async function createAuthenticatedRequestClient(
  request: Request
): Promise<AuthenticatedRequestClient> {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (accessToken) {
    const supabase = createTokenClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
    const { data: { user } } = await supabase.auth.getUser(accessToken);
    return { supabase, user };
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}
