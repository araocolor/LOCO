import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import UserViewBackButton from "@/components/user/UserViewBackButton";
import UserViewLoader from "@/components/user/UserViewLoader";
import UserViewHeaderMenu from "@/components/user/UserViewHeaderMenu";

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

export default async function UserViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname, profile_image_url")
    .eq("id", id)
    .single();

  return (
    <div
      data-page-shell
      className="fixed inset-0 z-[70] bg-white page-slide-in-from-right overflow-hidden flex flex-col"
    >
      <header className="shrink-0 bg-white border-b border-[#e5e7eb] h-14 px-4 relative flex items-center">
        <div className="w-10 flex items-center justify-start">
          <UserViewBackButton userId={id} />
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 font-bold text-[17px] text-[#333333] leading-none">
          프로필
        </div>
        <div className="ml-auto">
          <UserViewHeaderMenu
            userId={id}
            nickname={profile?.nickname ?? ""}
            profile_image_url={profile?.profile_image_url ?? null}
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <UserViewLoader userId={id} />
      </div>
    </div>
  );
}
