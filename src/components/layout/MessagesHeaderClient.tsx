"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/ui/Avatar";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { replaceMainTab } from "@/lib/main-tab";

export default function MessagesHeaderClient() {
  const { user } = useAuth();
  const [nickname, setNickname] = useState("me");
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setNickname("me");
      setProfileImageUrl(null);
      return;
    }
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("nickname, profile_image_url")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setNickname(data.nickname ?? "me");
        setProfileImageUrl(data.profile_image_url ?? null);
      });
  }, [user]);

  return (
    <header className="sticky top-0 z-50 bg-white h-14 px-4 relative flex items-center">
      <div className="absolute left-1/2 -translate-x-1/2 font-bold text-xl text-[#4d4d4d] leading-none">
        TALK
      </div>
      {user && (
        <button
          type="button"
          className="absolute right-4"
          onClick={() => replaceMainTab("mypage")}
        >
          <Avatar src={profileImageUrl} nickname={nickname} size={28} />
        </button>
      )}
    </header>
  );
}
