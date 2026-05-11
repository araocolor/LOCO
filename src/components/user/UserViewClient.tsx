"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { UserCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ClassImage } from "@/types/class";

type TabType = "all" | "my" | "bookmark";

interface GridClass {
  id: string;
  images: ClassImage[] | null;
  title: string;
  status?: string;
  created_at?: string;
  isBookmark?: boolean;
}

interface Profile {
  id: string;
  email: string | null;
  nickname: string;
  bio: string | null;
  country: string | null;
  member_type: string[];
  profile_image_url: string | null;
  region: string | null;
}

interface Props {
  profile: Profile;
  myClasses: GridClass[];
  bookmarkClasses: GridClass[];
}

export default function UserViewClient({ profile, myClasses, bookmarkClasses }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [friendAvatars, setFriendAvatars] = useState<
    { id: string; profile_image_url: string | null; nickname: string }[]
  >([]);
  const [friendCount, setFriendCount] = useState(0);

  useEffect(() => {
    async function fetchFriends() {
      const supabase = createClient();
      const [{ data }, { count }] = await Promise.all([
        supabase
          .from("friendships")
          .select("user_id, profiles!friendships_user_id_fkey(id, nickname, profile_image_url)")
          .eq("friend_id", profile.id)
          .in("status", ["approved", "friend"])
          .order("updated_at", { ascending: false })
          .limit(5),
        supabase
          .from("friendships")
          .select("id", { count: "exact", head: true })
          .eq("friend_id", profile.id)
          .in("status", ["approved", "friend"]),
      ]);
      if (data) {
        const rows = data as unknown as Array<{
          profiles: { id: string; nickname: string; profile_image_url: string | null } | null;
        }>;
        setFriendAvatars(
          rows.map((row) => ({
            id: row.profiles?.id ?? "",
            nickname: row.profiles?.nickname ?? "",
            profile_image_url: row.profiles?.profile_image_url ?? null,
          }))
        );
      }
      setFriendCount(count ?? 0);
    }
    fetchFriends();
  }, [profile.id]);

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white flex flex-col items-start px-4 pt-5 pb-5">
        <div className="flex flex-col w-full gap-1">
          <div className="flex items-center w-full">
            <div className="w-1/2 flex items-start">
              <div className="relative flex-shrink-0">
                {profile.profile_image_url ? (
                  <Image
                    src={profile.profile_image_url}
                    alt="프로필"
                    width={60}
                    height={60}
                    className="rounded-full object-cover w-[60px] h-[60px]"
                    unoptimized
                  />
                ) : (
                  <UserCircle size={60} className="text-gray-400" />
                )}
              </div>
            </div>
            <div className="w-1/2 flex flex-col gap-1 items-center">
              {friendAvatars.length > 0 ? (
                <div className="flex items-center">
                  {friendAvatars.slice(0, 5).map((f, i) => (
                    <div
                      key={f.id}
                      className="rounded-full border-2 border-white"
                      style={{ marginLeft: i === 0 ? 0 : -10, zIndex: i }}
                    >
                      {f.profile_image_url ? (
                        <Image
                          src={f.profile_image_url}
                          alt={f.nickname}
                          width={30}
                          height={30}
                          className="rounded-full object-cover w-[30px] h-[30px]"
                          unoptimized
                        />
                      ) : (
                        <UserCircle size={30} className="text-gray-300" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-[12px] text-gray-300">친구없음</span>
              )}
              {friendCount > 0 && <span className="text-[16px] font-bold text-gray-700">{friendCount}</span>}
            </div>
          </div>

          <span className="text-[17px] font-bold text-[#333333]">{profile.nickname}</span>
          <div className="flex items-center gap-2 flex-wrap">
            {profile.member_type?.[0] && (
              <span className="px-2.5 py-0 rounded-full bg-gray-800 text-white text-[13px]">
                {profile.member_type[0]}
              </span>
            )}
            {(profile.country || profile.region) && (
              <span className="text-[13px] text-gray-400">{[profile.country, profile.region].filter(Boolean).join(", ")}</span>
            )}
          </div>
          <span className="text-[14px] text-gray-400 -mt-1">{profile.email ?? ""}</span>
          {profile.bio && (
            <span className="text-[16px] w-[80%] mt-2" style={{ color: "#000000cc" }}>
              {profile.bio}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 bg-white">
        <div className="flex gap-2 px-4 py-3">
          {([["all", "전체목록"], ["my", "내클래스"], ["bookmark", "북마크"]] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                activeTab === tab ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-[1px] bg-gray-200">
          {(activeTab === "all"
            ? [...myClasses, ...bookmarkClasses].sort(
                (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
              )
            : activeTab === "my"
            ? myClasses
            : bookmarkClasses
          ).map((item) => (
            <button
              key={item.id + (item.isBookmark ? "-bm" : "")}
              type="button"
              onClick={() => router.push(`/classes/${item.id}`)}
              className="aspect-square bg-gray-100 relative overflow-hidden cursor-pointer"
            >
              {item.images?.[0]?.card_url ? (
                <Image
                  src={item.images[0].card_url}
                  alt={item.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <span className="text-gray-300 text-xs">없음</span>
                </div>
              )}
              {item.isBookmark && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="white"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="absolute top-1.5 right-1.5"
                >
                  <polygon points="19 21 12 16 5 21 5 3 19 3" />
                </svg>
              )}
              {!item.isBookmark && item.status === "recruiting" && (
                <div className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-green-500" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
