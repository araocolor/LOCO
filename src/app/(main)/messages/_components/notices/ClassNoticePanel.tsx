"use client";

import { BarChart3, Megaphone } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import type { ChatNotice, NoticeKind, NoticeReactionType, NoticeVoteType, OtherUser } from "../../_types";

interface NoticeReactionOption {
  type: NoticeReactionType;
  label: string;
}

interface NoticeVoteOption {
  type: NoticeVoteType;
  label: string;
}

interface ClassNoticePanelProps {
  canWriteClassNotice: boolean;
  isClassRoom: boolean;
  notices: ChatNotice[];
  noticeReactions: NoticeReactionOption[];
  noticeVotes: NoticeVoteOption[];
  now: number;
  roomMembers: Array<{
    user_id: string;
    role: "owner" | "admin" | "member";
    created_at?: string | null;
    profile: OtherUser | null;
  }> | undefined;
  userId: string;
  formatNoticeDate: (dateStr: string | null) => string;
  formatRemaining: (closesAt: string) => string;
  formatTime: (dateStr: string) => string;
  onNoticeReaction: (noticeId: string, reactionType: NoticeReactionType) => void;
  onNoticeVote: (noticeId: string, voteType: NoticeVoteType) => void;
  openNoticeDrawer: (initialKind: NoticeKind) => void;
  openEditNotice: (notice: ChatNotice) => void;
  setDeleteTargetId: (noticeId: string) => void;
}

export default function ClassNoticePanel({
  canWriteClassNotice,
  isClassRoom,
  notices,
  noticeReactions,
  noticeVotes,
  now,
  roomMembers,
  userId,
  formatNoticeDate,
  formatRemaining,
  formatTime,
  onNoticeReaction,
  onNoticeVote,
  openNoticeDrawer,
  openEditNotice,
  setDeleteTargetId,
}: ClassNoticePanelProps) {
  if (!isClassRoom) {
    return <div className="flex h-full items-center justify-center text-sm text-gray-400">공지/투표가 없습니다</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-2">
        <button
          type="button"
          onClick={() => openNoticeDrawer("vote")}
          className="rounded-full bg-yellow-300 px-4 py-2 text-sm font-bold text-gray-900 shadow-sm hover:bg-yellow-400"
        >
          투표작성
        </button>
        {canWriteClassNotice && (
          <button
            type="button"
            onClick={() => openNoticeDrawer("notice")}
            className="rounded-full bg-yellow-300 px-4 py-2 text-sm font-bold text-gray-900 shadow-sm hover:bg-yellow-400"
          >
            공지작성
          </button>
        )}
      </div>
      {notices.length > 0 ? (
        <div className="space-y-4">
          {notices.map((notice, index) => {
            const dateLabel = formatNoticeDate(notice.created_at);
            const prevDateLabel = index > 0 ? formatNoticeDate(notices[index - 1].created_at) : "";
            const showDateHeader = index === 0 || dateLabel !== prevDateLabel;
            const author = (roomMembers ?? []).find((m) => m.user_id === notice.author_id)?.profile ?? null;
            return (
              <div key={notice.id} className="space-y-2">
                {showDateHeader && (
                  <p className="text-center text-xs font-bold text-gray-400">{dateLabel}</p>
                )}
                <div className="flex items-center gap-2">
                  <Avatar src={author?.profile_image_url ?? null} nickname={author?.nickname ?? "?"} size={36} />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-800">{author?.nickname ?? "알 수 없음"}</span>
                    <span className="text-xs text-gray-600">{formatTime(notice.created_at)}</span>
                  </div>
                </div>
                <article className="rounded-[10px] bg-white px-4 py-3 text-gray-900">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                    {notice.kind === "vote" ? (
                      <BarChart3 size={17} className="shrink-0" />
                    ) : (
                      <Megaphone size={17} className="shrink-0" />
                    )}
                    <span className="font-bold" style={{ fontSize: 17 }}>{notice.kind === "vote" ? "투표" : "공지사항"}</span>
                    {notice.kind === "vote" && (() => {
                      const closed = notice.closes_at ? new Date(notice.closes_at).getTime() <= now : false;
                      return closed ? (
                        <span className="rounded-full bg-gray-400 px-2 py-0.5 text-xs font-bold text-white">투표마감</span>
                      ) : (
                        <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-bold text-white">진행중</span>
                      );
                    })()}
                    <span className="ml-auto text-xs font-bold text-gray-700">읽음 {notice.read_count}</span>
                    {notice.author_id === userId && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditNotice(notice)}
                          className="text-xs font-bold text-gray-500 hover:text-gray-800"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTargetId(notice.id)}
                          className="text-xs font-bold text-red-500 hover:text-red-700"
                        >
                          삭제
                        </button>
                      </>
                    )}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-[16px] font-semibold leading-6 text-[#595959]">{notice.content}</p>
                  {notice.kind !== "vote" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {noticeReactions.map((reaction) => (
                        <button
                          key={reaction.type}
                          type="button"
                          onClick={() => onNoticeReaction(notice.id, reaction.type)}
                          className="px-1 text-sm font-bold"
                        >
                          {reaction.label} <span className="text-gray-700 font-normal">{notice.reaction_counts[reaction.type]}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {notice.kind === "vote" && (() => {
                    const isClosed = notice.closes_at ? new Date(notice.closes_at).getTime() <= now : false;
                    const showResults = isClosed || notice.my_vote !== null;
                    return (
                      <>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {noticeVotes.map((vote) => (
                            <button
                              key={vote.type}
                              type="button"
                              onClick={() => !isClosed && onNoticeVote(notice.id, vote.type)}
                              disabled={isClosed}
                              className={`rounded-full px-4 py-1.5 text-sm font-bold border ${
                                notice.my_vote === vote.type ? "border-black bg-gray-900 text-white" : "border-gray-300 bg-white text-gray-800"
                              } ${isClosed ? "opacity-60" : ""}`}
                            >
                              {vote.label}{showResults ? ` ${notice.vote_counts[vote.type]}` : ""}
                            </button>
                          ))}
                        </div>
                        {notice.closes_at && (
                          <p className="mt-2 text-gray-500" style={{ fontSize: 16 }}>
                            {isClosed
                              ? `마감됨 · ${formatNoticeDate(notice.closes_at)}`
                              : `${formatNoticeDate(notice.closes_at)} 마감 · ${formatRemaining(notice.closes_at)}`}
                          </p>
                        )}
                      </>
                    );
                  })()}
                </article>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm leading-6 text-gray-400">등록된 공지/투표가 없습니다.</p>
      )}
    </div>
  );
}
