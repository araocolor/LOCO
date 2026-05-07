import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import HeaderBackCircleButton from "@/components/layout/HeaderBackCircleButton";
import UserViewLoader from "@/components/user/UserViewLoader";

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
        <UserViewLoader userId={id} />
      </div>
    </div>
  );
}
