import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HeaderBackCircleButton from "@/components/layout/HeaderBackCircleButton";
import UserViewClient from "@/components/user/UserViewClient";
import { ClassImage } from "@/types/class";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", id)
    .single();
  return { title: data?.nickname ? `${data.nickname} 프로필` : "회원 프로필" };
}

interface ProfileRow {
  id: string;
  email: string | null;
  nickname: string;
  profile_image_url: string | null;
  bio: string | null;
  member_type: string[] | null;
}

interface GridClass {
  id: string;
  images: ClassImage[] | null;
  title: string;
  status?: string;
  created_at?: string;
  isBookmark?: boolean;
}

interface BookmarkClassRow {
  created_at: string;
  classes:
    | {
        id: string;
        images: ClassImage[] | null;
        title: string;
        status: string;
      }
    | {
        id: string;
        images: ClassImage[] | null;
        title: string;
        status: string;
      }[]
    | null;
}

export default async function UserViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, nickname, profile_image_url, bio, member_type")
    .eq("id", id)
    .single();

  if (!profile) {
    notFound();
  }

  const { data: myClassesRaw } = await supabase
    .from("classes")
    .select("id, images, title, status, created_at")
    .eq("host_id", id)
    .order("created_at", { ascending: false })
    .limit(300);

  const { data: bookmarkRaw } = await supabase
    .from("class_bookmarks")
    .select("created_at, classes(id, images, title, status)")
    .eq("user_id", id)
    .order("created_at", { ascending: false })
    .limit(300);

  const isMe = user?.id === id;
  const hostProfile = profile as ProfileRow;
  const myClasses = ((myClassesRaw ?? []) as GridClass[]).map((c) => ({
    ...c,
    isBookmark: false,
  }));

  const bookmarkRows = (bookmarkRaw ?? []) as BookmarkClassRow[];
  const bookmarkClasses: GridClass[] = bookmarkRows.flatMap((row) => {
    if (!row.classes) return [];
    const cls = Array.isArray(row.classes) ? row.classes[0] : row.classes;
    if (!cls) return [];
    return [
      {
        id: cls.id,
        images: cls.images,
        title: cls.title,
        status: cls.status,
        created_at: row.created_at,
        isBookmark: true,
      },
    ];
  });

  return (
    <div
      data-page-shell
      className="fixed inset-0 z-[70] bg-white page-slide-in-from-right overflow-hidden flex flex-col"
    >
      <header className="shrink-0 bg-white border-b border-[#e5e7eb] h-14 px-4 relative flex items-center">
        <div className="w-10 flex items-center justify-start">
          <HeaderBackCircleButton />
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 font-bold text-[17px] text-[#333333] leading-none">
          프로필
        </div>
        <div className="w-10" />
      </header>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <UserViewClient
          profile={{
            id: hostProfile.id,
            email: hostProfile.email,
            nickname: hostProfile.nickname,
            bio: hostProfile.bio,
            member_type: hostProfile.member_type ?? [],
            profile_image_url: hostProfile.profile_image_url,
          }}
          myClasses={myClasses}
          bookmarkClasses={isMe ? bookmarkClasses : []}
        />
      </div>
    </div>
  );
}
