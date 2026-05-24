import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ChatNotice, NoticeKind, NoticeReactionType, NoticeVoteType } from "../_types";

interface UseChatNoticesOptions {
  selectedRoomId: string | null;
  notices: ChatNotice[];
  setNotices: Dispatch<SetStateAction<ChatNotice[]>>;
}

export function useChatNotices({ selectedRoomId, notices, setNotices }: UseChatNoticesOptions) {
  const saveClassNotice = useCallback(async (notice: string, kind: NoticeKind = "notice", closesAt: string | null = null) => {
    if (!selectedRoomId) return;

    const res = await fetch(`/api/chat/rooms/${selectedRoomId}/notices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, content: notice, closes_at: closesAt }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "공지 저장 중 오류가 발생했습니다");
    }
    if (data.data) setNotices(data.data as ChatNotice[]);
  }, [selectedRoomId, setNotices]);

  const updateClassNotice = useCallback(async (noticeId: string, content: string, kind: NoticeKind, closesAt: string | null) => {
    const res = await fetch(`/api/chat/notices/${noticeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, content, closes_at: closesAt }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "공지 수정 중 오류가 발생했습니다");
    }
    setNotices((prev) =>
      prev.map((item) =>
        item.id === noticeId ? { ...item, content, kind, closes_at: closesAt } : item
      )
    );
  }, [setNotices]);

  const deleteClassNotice = useCallback(async (noticeId: string) => {
    const res = await fetch(`/api/chat/notices/${noticeId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "공지 삭제 중 오류가 발생했습니다");
    }
    setNotices((prev) => prev.filter((item) => item.id !== noticeId));
  }, [setNotices]);

  const markNoticeRead = useCallback(async (noticeId: string) => {
    const notice = notices.find((item) => item.id === noticeId);
    if (!notice || notice.read_by_me) return;

    setNotices((prev) =>
      prev.map((item) =>
        item.id === noticeId
          ? { ...item, read_by_me: true, read_count: item.read_count + 1 }
          : item
      )
    );

    try {
      const res = await fetch(`/api/chat/notices/${noticeId}/read`, { method: "POST" });
      if (!res.ok) {
        setNotices((prev) =>
          prev.map((item) =>
            item.id === noticeId
              ? { ...item, read_by_me: false, read_count: Math.max(0, item.read_count - 1) }
              : item
          )
        );
      }
    } catch {
      setNotices((prev) =>
        prev.map((item) =>
          item.id === noticeId
            ? { ...item, read_by_me: false, read_count: Math.max(0, item.read_count - 1) }
            : item
        )
      );
    }
  }, [notices, setNotices]);

  const reactToNotice = useCallback(async (noticeId: string, reactionType: NoticeReactionType) => {
    const prevNotice = notices.find((item) => item.id === noticeId);
    if (!prevNotice) return;
    const nextReaction = prevNotice.my_reaction === reactionType ? null : reactionType;

    setNotices((prev) =>
      prev.map((item) => {
        if (item.id !== noticeId) return item;
        const counts = { ...item.reaction_counts };
        if (item.my_reaction) counts[item.my_reaction] = Math.max(0, counts[item.my_reaction] - 1);
        if (nextReaction) counts[nextReaction] += 1;
        return { ...item, my_reaction: nextReaction, reaction_counts: counts };
      })
    );

    try {
      const res = await fetch(`/api/chat/notices/${noticeId}/reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction_type: reactionType }),
      });
      if (!res.ok) setNotices((prev) => prev.map((item) => item.id === noticeId ? prevNotice : item));
    } catch {
      setNotices((prev) => prev.map((item) => item.id === noticeId ? prevNotice : item));
    }
  }, [notices, setNotices]);

  const voteNotice = useCallback(async (noticeId: string, voteType: NoticeVoteType) => {
    const prevNotice = notices.find((item) => item.id === noticeId);
    if (!prevNotice) return;

    setNotices((prev) =>
      prev.map((item) => {
        if (item.id !== noticeId) return item;
        const counts = { ...item.vote_counts };
        if (item.my_vote) counts[item.my_vote] = Math.max(0, counts[item.my_vote] - 1);
        counts[voteType] += 1;
        return { ...item, my_vote: voteType, vote_counts: counts };
      })
    );

    try {
      const res = await fetch(`/api/chat/notices/${noticeId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote_type: voteType }),
      });
      if (!res.ok) setNotices((prev) => prev.map((item) => item.id === noticeId ? prevNotice : item));
    } catch {
      setNotices((prev) => prev.map((item) => item.id === noticeId ? prevNotice : item));
    }
  }, [notices, setNotices]);

  return {
    saveClassNotice,
    updateClassNotice,
    deleteClassNotice,
    markNoticeRead,
    reactToNotice,
    voteNotice,
  };
}
