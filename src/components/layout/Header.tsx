import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ClassNewButton from "@/components/layout/ClassNewButton";
import { Shell } from "lucide-react";

export default async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let unreadCount = 0;
  if (user) {
    const [notifResult] = await Promise.all([
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false),
    ]);
    unreadCount = notifResult.count ?? 0;
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#e5e7eb] h-14 px-4 relative flex items-center">
      <div className="w-10 flex items-center justify-start">
        <ClassNewButton isLoggedIn={!!user} />
      </div>
      <Link href="/" className="absolute left-1/2 -translate-x-1/2">
        <Shell size={31} className="text-[#666666]" />
      </Link>
      <div className="ml-auto flex items-center gap-4">
        <Link href="/notifications" aria-label="알림" className="relative text-gray-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>

      </div>
    </header>
  );
}
