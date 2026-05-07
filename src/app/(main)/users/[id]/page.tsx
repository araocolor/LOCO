import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClassCard, { ClassWithHost } from "@/components/class/ClassCard";
import HeaderBackCircleButton from "@/components/layout/HeaderBackCircleButton";

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
  nickname: string;
  profile_image_url: string | null;
  bio: string | null;
  region: string | null;
}

export default async function UserProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: { from?: string };
}) {
  const { id } = await params;
  const animateFromMessages = searchParams?.from === "messages-avatar";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nickname, profile_image_url, bio, region")
    .eq("id", id)
    .single();

  if (!profile) {
    notFound();
  }

  const { data: classes } = await supabase
    .from("classes")
    .select("*, host:profiles!host_id(id, nickname, profile_image_url)")
    .eq("host_id", id)
    .eq("status", "recruiting")
    .order("deadline", { ascending: true })
    .limit(20);

  const isMe = user?.id === id;
  const hostProfile = profile as ProfileRow;
  const recruitingClasses = (classes as ClassWithHost[]) ?? [];
  const nickname = hostProfile.nickname || "사용자";

  return (
    <div
      data-page-shell
      className={`min-h-screen bg-white ${animateFromMessages ? "page-slide-in-from-right" : ""}`}
    >
      <header className="sticky top-0 z-50 bg-white border-b border-[#e5e7eb] h-14 px-4 relative flex items-center">
        <div className="w-10 flex items-center justify-start">
          <HeaderBackCircleButton />
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 font-bold text-[17px] text-[#333333] leading-none">
          프로필
        </div>
        <div className="w-10" />
      </header>

      <div className="max-w-xl mx-auto px-4 py-4 pb-6 space-y-4">
        <section className="card p-4">
        <div className="flex items-start gap-3">
          {hostProfile.profile_image_url ? (
            <Image
              src={hostProfile.profile_image_url}
              alt={nickname}
              width={56}
              height={56}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-semibold text-lg">
              {nickname[0]}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900">{nickname}</h1>
            <p className="text-sm text-gray-500 mt-1">
              활동지역: {hostProfile.region || "미입력"}
            </p>
            {hostProfile.bio ? (
              <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
                {hostProfile.bio}
              </p>
            ) : (
              <p className="text-sm text-gray-400 mt-2">자기소개가 없습니다.</p>
            )}
          </div>
        </div>

        {isMe && (
          <Link href="/mypage" className="btn-outline w-full mt-4 text-sm py-2">
            내 프로필 편집
          </Link>
        )}
        </section>

        <section>
          <h2 className="font-semibold text-base text-gray-800 mb-3">모집중 클래스</h2>
          {recruitingClasses.length === 0 ? (
            <div className="card p-6 text-center text-sm text-gray-400">
              현재 모집중인 클래스가 없습니다.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {recruitingClasses.map((cls) => (
                <ClassCard key={cls.id} classData={cls} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
