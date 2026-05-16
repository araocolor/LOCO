import { createClient } from "@/lib/supabase/client";

export async function fetchWithAuthRetry(input: RequestInfo | URL, init?: RequestInit) {
  const firstResponse = await fetch(input, init);
  if (firstResponse.status !== 401) return firstResponse;

  const supabase = createClient();
  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session) return firstResponse;

  return fetch(input, init);
}
