import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_FOLLOWING_NICKNAME = "blackdog";

interface ProfileRow {
  id: string;
  created_at: string;
}

export async function ensureDefaultFollowing(userId: string) {
  const admin = createAdminClient();

  const [{ data: userProfile, error: userError }, { data: defaultProfile, error: defaultError }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id, created_at")
        .eq("id", userId)
        .single<ProfileRow>(),
      admin
        .from("profiles")
        .select("id")
        .eq("nickname", DEFAULT_FOLLOWING_NICKNAME)
        .single<{ id: string }>(),
    ]);

  if (userError) throw userError;
  if (defaultError) throw defaultError;
  if (!userProfile || !defaultProfile || userProfile.id === defaultProfile.id) return;

  const { data: existing, error: existingError } = await admin
    .from("friendships")
    .select("id, status")
    .eq("user_id", userProfile.id)
    .eq("friend_id", defaultProfile.id)
    .maybeSingle<{ id: string; status: string }>();

  if (existingError) throw existingError;
  if (existing?.status === "friend" || existing?.status === "approved") return;

  const joinedAt = userProfile.created_at ?? new Date().toISOString();

  if (existing) {
    const { error } = await admin
      .from("friendships")
      .update({ status: "approved", updated_at: joinedAt })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await admin.from("friendships").insert({
    user_id: userProfile.id,
    friend_id: defaultProfile.id,
    status: "approved",
    created_at: joinedAt,
    updated_at: joinedAt,
  });

  if (error) throw error;
}
