"use client";

import { useState } from "react";
import Avatar from "@/components/ui/Avatar";
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
  canAddMembers: boolean;
  members: ChatMemberProfile[];
  userId: string;
  roomId: string;
  onOpenMemberDrawer: () => void;
}

export default function MemberGrid({
  canAddMembers,
  members,
  userId,
  roomId,
  onOpenMemberDrawer,
}: MemberGridProps) {
  const [showGame, setShowGame] = useState(true);

  return (
    <div className="relative h-full min-h-full">
      {members.length === 0 ? (
        <div className="flex h-full min-h-full items-center justify-center text-sm text-white/80">
          참여 회원이 없습니다
        </div>
      ) : showGame ? (
        <MemberBreakoutGame members={members} userId={userId} roomId={roomId} onExitGame={() => setShowGame(false)} />
      ) : (
        <div className="h-full min-h-full px-4 py-5">
          <div className="grid grid-cols-5 gap-x-4 gap-y-5">
            {members.map((member) => (
              <div key={member.userId} className="flex flex-col items-center gap-2">
                <Avatar
                  src={member.profileImageUrl}
                  nickname={member.nickname}
                  size={50}
                  className={member.role === "owner" ? "border-2 border-white shadow-[0_0_0_2px_#facc15]" : ""}
                />
                <span className="w-full truncate text-center text-[12px] font-medium text-white">
                  {member.nickname}
                </span>
              </div>
            ))}
          </div>
          {canAddMembers && (
            <div className="absolute inset-x-0 bottom-10 flex justify-center">
              <button
                type="button"
                onClick={onOpenMemberDrawer}
                className="inline-flex h-11 items-center justify-center rounded-full bg-yellow-300 px-6 text-sm font-black text-gray-900 shadow-[0_12px_24px_rgba(250,204,21,0.3)] transition hover:bg-yellow-200"
              >
                회원초대하기
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
