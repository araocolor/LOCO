import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_FOLLOWER_NICKNAME = "blackdog";

interface ProfileRow {
  id: string;
  created_at: string;
  role: string;
}

export async function ensureDefaultFollower(userId: string) {
  const admin = createAdminClient();

  const [{ data: userProfile, error: userError }, { data: defaultProfile, error: defaultError }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id, created_at, role")
        .eq("id", userId)
        .single<ProfileRow>(),
      admin
        .from("profiles")
        .select("id")
        .eq("nickname", DEFAULT_FOLLOWER_NICKNAME)
        .single<{ id: string }>(),
    ]);

  if (userError) throw userError;
  if (defaultError) throw defaultError;
  if (userProfile?.role === "admin") return;
  if (!userProfile || !defaultProfile || userProfile.id === defaultProfile.id) return;

  const { data: existing, error: existingError } = await admin
    .from("friendships")
    .select("id, status")
    .eq("user_id", defaultProfile.id)
    .eq("friend_id", userProfile.id)
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
    user_id: defaultProfile.id,
    friend_id: userProfile.id,
    status: "approved",
    created_at: joinedAt,
    updated_at: joinedAt,
  });

  if (error) throw error;
}
