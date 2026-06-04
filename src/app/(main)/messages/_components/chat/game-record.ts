import { createClient } from "@/lib/supabase/client";

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
