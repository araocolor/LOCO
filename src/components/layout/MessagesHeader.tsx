import { createClient } from "@/lib/supabase/server";

export default async function MessagesHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let nickname = "";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("nickname")
      .eq("id", user.id)
      .single();
    nickname = profile?.nickname ?? "";
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#e5e7eb] h-14 px-4 relative flex items-center">
      <div className="absolute left-1/2 -translate-x-1/2 font-bold text-xl text-[#4d4d4d] leading-none">
        {nickname}
      </div>
    </header>
  );
}
