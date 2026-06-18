"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { X } from "lucide-react";
import AdminMembersTab from "./AdminMembersTab";
import type { AdminMembersTabProps } from "./AdminMembersTab";
import AdminClassesTab from "./AdminClassesTab";
import type { AdminClassesTabProps } from "./AdminClassesTab";
import AdminSystemTab from "./AdminSystemTab";

type AdminTab = "members" | "classes" | "payments" | "system";

const TAB_ITEMS: { key: AdminTab; label: string }[] = [
  { key: "members", label: "회원관리" },
  { key: "classes", label: "수업관리" },
  { key: "payments", label: "결제관리" },
  { key: "system", label: "시스템" },
];

interface AdminPageClientProps extends AdminMembersTabProps, AdminClassesTabProps {}

export default function AdminPageClient({
  initialUsers,
  initialClasses,
}: AdminPageClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>("members");

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#f2f2f7] flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="relative flex-shrink-0 px-4 pt-3 pb-3">
        <div className="flex justify-end">
          <button type="button" onClick={() => router.back()}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <p className="text-[28px] font-bold text-[#333] pt-1">관리자모드</p>
      </div>

      <div className="flex-shrink-0 px-4 pb-2">
        <div className="flex gap-2">
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? "bg-[#333] text-white"
                  : "bg-white text-gray-500 border border-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-2">
        {activeTab === "members" && (
          <AdminMembersTab
            initialUsers={initialUsers}
          />
        )}
        {activeTab === "classes" && (
          <AdminClassesTab initialClasses={initialClasses} />
        )}
        {activeTab === "payments" && (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-gray-400">결제관리 준비 중</p>
          </div>
        )}
        {activeTab === "system" && <AdminSystemTab />}
      </div>
    </div>
  );
}
