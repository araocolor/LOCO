"use client";

import MemberBreakoutGame from "./MemberBreakoutGame";

export interface ChatMemberProfile {
  userId: string;
  nickname: string;
  profileImageUrl: string | null;
  role: "owner" | "admin" | "member";
  createdAt: string | null;
  order: number;
}

interface MemberGridProps {
  members: ChatMemberProfile[];
}

export default function MemberGrid({ members }: MemberGridProps) {
  return (
    <div className="h-full min-h-full">
      {members.length === 0 ? (
        <div className="flex h-full min-h-full items-center justify-center bg-white/50 text-sm text-gray-500">
          참여 회원이 없습니다
        </div>
      ) : (
        <MemberBreakoutGame members={members} />
      )}
    </div>
  );
}
