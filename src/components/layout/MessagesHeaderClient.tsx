"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/ui/Avatar";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";

export default function MessagesHeaderClient() {
  const { user } = useAuth();
  const [nickname, setNickname] = useState("me");
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("nickname, profile_image_url")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setNickname(data.nickname ?? "me");
          setProfileImageUrl(data.profile_image_url ?? null);
        }
      });
  }, [user]);

  return (
    <header className="sticky top-0 z-50 bg-white h-14 px-4 relative flex items-center">
      <div className="absolute left-1/2 -translate-x-1/2 font-bold text-xl text-[#4d4d4d] leading-none">
        TALK
      </div>
      {user && (
        <div data-messages-header-avatar className="ml-auto flex h-full items-end justify-end pb-1">
          <Avatar src={profileImageUrl} nickname={nickname} size={37} />
        </div>
      )}
    </header>
  );
}
