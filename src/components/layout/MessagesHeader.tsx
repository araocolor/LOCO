import Avatar from "@/components/ui/Avatar";
import { createClient } from "@/lib/supabase/server";

export default async function MessagesHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let nickname = "me";
  let profileImageUrl: string | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("nickname, profile_image_url")
      .eq("id", user.id)
      .single();
    nickname = profile?.nickname ?? "me";
    profileImageUrl = profile?.profile_image_url ?? null;
  }

  return (
    <header className="sticky top-0 z-50 bg-white h-14 px-4 relative flex items-center">
      <div className="absolute left-1/2 -translate-x-1/2 font-bold text-xl text-[#4d4d4d] leading-none">
        TALK
      </div>
      {user && (
        <div className="ml-auto flex items-center justify-end translate-y-[2px]">
          <Avatar src={profileImageUrl} nickname={nickname} size={37} />
        </div>
      )}
    </header>
  );
}
