"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import MyPageSettingsDrawer from "./MyPageSettingsDrawer";

export default function MyPageHeader() {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 bg-white border-b border-[#e5e7eb]">
        <div className="relative h-14 px-4 flex items-center">
          <div className="font-black text-[22px] text-[#4d4d4d] leading-none">
            프로필
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="ml-auto h-12 w-12 -mr-2 flex items-center justify-center text-gray-700"
          >
            <Settings size={22} strokeWidth={2.2} />
          </button>
        </div>
        <div className="flex pl-4 pr-4 gap-2 pb-2">
          <button
            type="button"
            onClick={() => router.push("/?tab=mypage")}
            className="px-3.5 py-1.5 rounded-full text-[15px] font-semibold bg-black text-white"
          >
            프로필
          </button>
        </div>
      </header>

      <MyPageSettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
