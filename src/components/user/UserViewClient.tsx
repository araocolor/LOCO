"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { Star, UserCircle } from "lucide-react";
import { ClassImage } from "@/types/class";

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
  received_star_count?: number;
}

interface Props {
  profile: Profile;
  myClasses: GridClass[];
  bookmarkClasses: GridClass[];
  followerCount: number;
}

export default function UserViewClient({ profile, myClasses, bookmarkClasses, followerCount }: Props) {
  const router = useRouter();
  const mergedClasses = [...myClasses, ...bookmarkClasses].sort(
    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  );

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
            <div className="w-1/2 grid grid-cols-2 gap-2 text-center">
              <div className="flex flex-col items-center gap-1">
                <span className="text-[13px] text-gray-500">팔로워</span>
                <span className="text-[16px] font-bold text-gray-700">{followerCount}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-[13px] text-gray-500">받은 별</span>
                <div className="flex items-center gap-1">
                  <Star size={15} className="text-yellow-500" fill="currentColor" />
                  <span className="text-[16px] font-bold text-gray-700">{profile.received_star_count ?? 0}</span>
                </div>
              </div>
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
        <div className="grid grid-cols-3 gap-[1px] bg-gray-200">
          {mergedClasses.map((item) => (
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
