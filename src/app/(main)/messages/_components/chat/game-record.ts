import { createClient } from "@/lib/supabase/client";

// 게임 점수 주간 리셋 기준: 한국시간(KST, UTC+9) 매주 금요일 18:00.
// 가장 최근 금요일 18시(KST)를 UTC ISO 문자열로 반환한다.
// 이 시각 이후의 기록만 조회하면 매주 금요일 오후 6시에 랭킹이 자연 리셋된다.
function getWeeklyResetSince(): string {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const nowKst = new Date(Date.now() + KST_OFFSET_MS);

  // KST 기준 요일/시각으로 직전 금요일 18:00까지 거슬러 올라간다. (금요일 = 5)
  const day = nowKst.getUTCDay();
  const resetKst = new Date(nowKst);
  resetKst.setUTCHours(18, 0, 0, 0);
  let diffDays = (day - 5 + 7) % 7;
  // 오늘이 금요일이고 아직 18시 전이면 지난주 금요일로 보낸다.
  if (diffDays === 0 && nowKst.getTime() < resetKst.getTime()) diffDays = 7;
  resetKst.setUTCDate(resetKst.getUTCDate() - diffDays);

  // KST로 계산한 시각을 다시 UTC로 변환해 반환한다.
  return new Date(resetKst.getTime() - KST_OFFSET_MS).toISOString();
}

export interface TopRecord {
  nickname: string;
  profileImageUrl: string | null;
  playDuration: number;
}

interface SaveGameRecordParams {
  userId: string;
  roomId: string;
  gameType: string;
  score: number;
  playDuration: number;
}

export async function saveGameRecord({
  userId,
  roomId,
  gameType,
  score,
  playDuration,
}: SaveGameRecordParams) {
  const supabase = createClient();
  const { error } = await supabase.from("game_records").insert({
    user_id: userId,
    room_id: roomId,
    game_type: gameType,
    score,
    play_duration: playDuration,
  });

  if (error) {
    console.error("게임 기록 저장 실패:", error.message);
  }
}

export async function fetchTopRecord(
  roomId: string,
  gameType: string
): Promise<TopRecord | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("game_records")
    .select("play_duration, user_id")
    .eq("room_id", roomId)
    .eq("game_type", gameType)
    .gte("played_at", getWeeklyResetSince())
    .order("play_duration", { ascending: true })
    .limit(1)
    .single();

  if (error || !data) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname, profile_image_url")
    .eq("id", data.user_id)
    .single();

  return {
    nickname: profile?.nickname ?? "알 수 없음",
    profileImageUrl: profile?.profile_image_url ?? null,
    playDuration: data.play_duration,
  };
}
