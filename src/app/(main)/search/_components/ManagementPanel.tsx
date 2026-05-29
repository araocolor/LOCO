import { Coffee } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import type { PendingMember } from "../_types/search";
import { getAvatarFloatStyle } from "../_lib/search-utils";

interface ManagementPanelProps {
  isBlacklistUnlocked: boolean;
  blacklistPinInput: string;
  blacklistPinError: string;
  blacklistPinSubmitting: boolean;
  hasBlacklistPin: boolean | null;
  pendingMembers: PendingMember[];
  removingPendingIds: Set<string>;
  onPinChange: (value: string) => void;
  onPinSubmit: () => void;
  onOpenProfile: (id: string) => void;
  onViewProfile: (id: string) => void;
  onUnhideFriend: (targetId: string) => void;
  onUnblockUser: (targetId: string) => void;
  onUnreportUser: (targetId: string) => void;
}

export default function ManagementPanel({
  isBlacklistUnlocked,
  blacklistPinInput,
  blacklistPinError,
  blacklistPinSubmitting,
  hasBlacklistPin,
  pendingMembers,
  removingPendingIds,
  onPinChange,
  onPinSubmit,
  onOpenProfile,
  onViewProfile,
  onUnhideFriend,
  onUnblockUser,
  onUnreportUser,
}: ManagementPanelProps) {
  if (!isBlacklistUnlocked) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div>
          <div className="relative" style={{ width: 200 }}>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={blacklistPinInput}
              onChange={(e) => onPinChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onPinSubmit();
              }}
              placeholder="비밀번호 입력"
              className="w-full h-10 pl-4 pr-10 border border-gray-300 rounded-full bg-white focus:outline-none focus:border-gray-500 text-center text-[15px] placeholder:text-center placeholder:text-[15px]"
            />
            <button
              type="button"
              onClick={onPinSubmit}
              disabled={blacklistPinSubmitting || hasBlacklistPin === null}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-gray-900 text-white text-sm font-semibold flex items-center justify-center animate-pill-breathe disabled:opacity-60 disabled:animate-none"
            >
              ✓
            </button>
          </div>
          {blacklistPinError && (
            <p className="mt-2 text-[15px] text-red-500 text-center">{blacklistPinError}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-3">
      <div className="flex items-center mb-3">
        <p className="text-base font-bold text-gray-400">회원관리</p>
      </div>
      {pendingMembers.length === 0 ? (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
          <Coffee size={40} className="text-gray-400" />
          <p className="text-gray-400 text-base">현재 관리회원이 없습니다.</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {pendingMembers.map((member) => {
            const isRemoving = removingPendingIds.has(member.id);
            return (
              <div
                key={member.id}
                className="flex items-center gap-3 py-3 border-b border-gray-50 relative"
              >
                {isRemoving && (
                  <span
                    className="absolute left-[10px] top-0 text-red-500 text-[40px] pointer-events-none z-10 leading-none"
                    style={{ animation: "heartFloatUp 1.4s ease-out forwards" }}
                  >
                    ❤
                  </span>
                )}
                <button onClick={() => onOpenProfile(member.id)}>
                  <div className="animate-blacklist-avatar" style={getAvatarFloatStyle(member.id)}>
                    <Avatar src={member.profile_image_url} nickname={member.nickname} size={44} />
                  </div>
                </button>
                <button
                  className="flex-1 text-left min-w-0"
                  onClick={() => onViewProfile(member.id)}
                >
                  <p className="font-semibold text-gray-900 truncate" style={{ fontSize: 16 }}>
                    {member.nickname}
                  </p>
                  {(member.country || member.region) && (
                    <p className="text-xs text-gray-400 truncate">
                      {[member.country, member.region].filter(Boolean).join(", ")}
                    </p>
                  )}
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {new Date(member.updated_at).toLocaleDateString("ko-KR")}
                  </p>
                </button>
                <div className="flex items-center gap-1">
                  {member.state === "hidden" && (
                    <button
                      className="px-2 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600"
                      onClick={() => onUnhideFriend(member.id)}
                    >
                      숨김해제
                    </button>
                  )}
                  {member.state === "blocked" && (
                    <button
                      className="px-2 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-red-500"
                      onClick={() => onUnblockUser(member.id)}
                    >
                      차단해제
                    </button>
                  )}
                  {member.state === "black" && (
                    <button
                      className="px-2 py-1 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700"
                      onClick={() => onUnreportUser(member.id)}
                    >
                      블랙해제
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
