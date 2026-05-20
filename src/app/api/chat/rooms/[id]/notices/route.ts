import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, requireActiveRoomMember } from "../../../_lib";

type NoticeKind = "notice" | "vote";
type NoticeReactionType = "heart" | "like" | "dislike";
type NoticeVoteType = "agree" | "disagree" | "abstain";

interface NoticeRow {
  id: string;
  room_id: string;
  author_id: string;
  kind: NoticeKind;
  content: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface NoticeReadRow {
  notice_id: string;
  user_id: string;
}

interface NoticeReactionRow {
  notice_id: string;
  user_id: string;
  reaction_type: NoticeReactionType;
}

interface NoticeVoteRow {
  notice_id: string;
  user_id: string;
  vote_type: NoticeVoteType;
}

const NOTICE_KINDS = new Set<NoticeKind>(["notice", "vote"]);
const REACTION_TYPES: NoticeReactionType[] = ["heart", "like", "dislike"];
const VOTE_TYPES: NoticeVoteType[] = ["agree", "disagree", "abstain"];

function emptyReactionCounts(): Record<NoticeReactionType, number> {
  return { heart: 0, like: 0, dislike: 0 };
}

function emptyVoteCounts(): Record<NoticeVoteType, number> {
  return { agree: 0, disagree: 0, abstain: 0 };
}

async function getNoticePayload(roomId: string, userId: string) {
  const admin = createAdminClient();
  const { data: notices, error: noticesError } = await admin
    .from("chat_room_notices")
    .select("id, room_id, author_id, kind, content, deleted_at, created_at, updated_at")
    .eq("room_id", roomId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .returns<NoticeRow[]>();

  if (noticesError) throw noticesError;
  const rows = notices ?? [];
  const noticeIds = rows.map((notice) => notice.id);

  const [{ data: reads }, { data: reactions }, { data: votes }] = await Promise.all([
    noticeIds.length > 0
      ? admin
          .from("chat_room_notice_reads")
          .select("notice_id, user_id")
          .in("notice_id", noticeIds)
          .returns<NoticeReadRow[]>()
      : Promise.resolve({ data: [] }),
    noticeIds.length > 0
      ? admin
          .from("chat_room_notice_reactions")
          .select("notice_id, user_id, reaction_type")
          .in("notice_id", noticeIds)
          .returns<NoticeReactionRow[]>()
      : Promise.resolve({ data: [] }),
    noticeIds.length > 0
      ? admin
          .from("chat_room_notice_votes")
          .select("notice_id, user_id, vote_type")
          .in("notice_id", noticeIds)
          .returns<NoticeVoteRow[]>()
      : Promise.resolve({ data: [] }),
  ]);

  const readCountMap = new Map<string, number>();
  const readByMe = new Set<string>();
  (reads ?? []).forEach((read) => {
    readCountMap.set(read.notice_id, (readCountMap.get(read.notice_id) ?? 0) + 1);
    if (read.user_id === userId) readByMe.add(read.notice_id);
  });

  const reactionCountMap = new Map<string, Record<NoticeReactionType, number>>();
  const myReactionMap = new Map<string, NoticeReactionType>();
  (reactions ?? []).forEach((reaction) => {
    const counts = reactionCountMap.get(reaction.notice_id) ?? emptyReactionCounts();
    if (REACTION_TYPES.includes(reaction.reaction_type)) counts[reaction.reaction_type] += 1;
    reactionCountMap.set(reaction.notice_id, counts);
    if (reaction.user_id === userId) myReactionMap.set(reaction.notice_id, reaction.reaction_type);
  });

  const voteCountMap = new Map<string, Record<NoticeVoteType, number>>();
  const myVoteMap = new Map<string, NoticeVoteType>();
  (votes ?? []).forEach((vote) => {
    const counts = voteCountMap.get(vote.notice_id) ?? emptyVoteCounts();
    if (VOTE_TYPES.includes(vote.vote_type)) counts[vote.vote_type] += 1;
    voteCountMap.set(vote.notice_id, counts);
    if (vote.user_id === userId) myVoteMap.set(vote.notice_id, vote.vote_type);
  });

  return rows.map((notice) => ({
    id: notice.id,
    room_id: notice.room_id,
    author_id: notice.author_id,
    kind: notice.kind,
    content: notice.content,
    created_at: notice.created_at,
    updated_at: notice.updated_at,
    read_count: readCountMap.get(notice.id) ?? 0,
    read_by_me: readByMe.has(notice.id),
    my_reaction: myReactionMap.get(notice.id) ?? null,
    reaction_counts: reactionCountMap.get(notice.id) ?? emptyReactionCounts(),
    my_vote: myVoteMap.get(notice.id) ?? null,
    vote_counts: voteCountMap.get(notice.id) ?? emptyVoteCounts(),
  }));
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: roomId } = await params;
    const membership = await requireActiveRoomMember(roomId, user.id);
    if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const notices = await getNoticePayload(roomId, user.id);
    return NextResponse.json({ data: notices });
  } catch (error) {
    console.error("[chat-room-notices:get]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: roomId } = await params;
    const membership = await requireActiveRoomMember(roomId, user.id);
    if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const kind = (body.kind ?? "notice") as NoticeKind;
    const content = typeof body.content === "string" ? body.content.trim().slice(0, 1000) : "";

    if (!NOTICE_KINDS.has(kind)) {
      return NextResponse.json({ error: "지원하지 않는 공지 형식입니다." }, { status: 400 });
    }
    if (!content) {
      return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("chat_room_notices")
      .insert({
        room_id: roomId,
        author_id: user.id,
        kind,
        content,
      });

    if (error) throw error;

    const notices = await getNoticePayload(roomId, user.id);
    return NextResponse.json({ data: notices }, { status: 201 });
  } catch (error) {
    console.error("[chat-room-notices:post]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
