"use client";

import Avatar from "@/components/ui/Avatar";

export interface ChatMemberProfile {
  userId: string;
  nickname: string;
  profileImageUrl: string | null;
  role: "owner" | "admin" | "member";
  createdAt: string | null;
  order: number;
}

interface MemberGridProps {
  canAddMembers: boolean;
  isClassRoom: boolean;
  members: ChatMemberProfile[];
  onOpenMemberDrawer: () => void;
}

export default function MemberGrid({
  canAddMembers,
  isClassRoom,
  members,
  onOpenMemberDrawer,
}: MemberGridProps) {
  if (members.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-gray-400">참여 회원이 없습니다</div>;
  }

  return (
    <>
      {canAddMembers && (
        <div className="flex justify-center mb-4">
          <button
            type="button"
            onClick={onOpenMemberDrawer}
            className="rounded-full bg-yellow-300 px-5 py-2 text-sm font-bold text-gray-900 shadow-sm hover:bg-yellow-400"
          >
            회원초대하기
          </button>
        </div>
      )}
      <div className="grid grid-cols-5 gap-4">
        {members.map((member) => (
          <div key={member.userId} className="flex justify-center">
            <Avatar
              src={member.profileImageUrl}
              nickname={member.nickname}
              size={50}
              className={isClassRoom && member.role === "owner" ? "border-2 border-white shadow-[0_0_0_2px_#ef4444]" : ""}
            />
          </div>
        ))}
      </div>
    </>
  );
}
