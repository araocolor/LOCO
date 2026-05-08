import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const REGIONS = ["서울", "부산", "대구", "인천", "광주", "대전", "수원", "제주"];
const GENRES = ["힙합", "재즈", "발레", "현대무용", "K-POP", "라틴", "탭댄스", "왈츠"];
const MEMBER_TYPES = ["댄서", "강사", "학생", "취미"];
const BIOS = [
  "춤추는 게 좋아요!", "댄스로 하루를 시작합니다", "몸으로 말해요",
  "댄스 입문 중입니다", "함께 춰요!", "리듬을 타는 게 즐거워요",
  "무대가 좋아요", "매일 연습 중", "댄스로 친구 사귀어요", "열정 넘치는 댄서",
];

function pad(n) {
  return String(n).padStart(2, "0");
}

async function main() {
  console.log("시드 유저 100명 생성 시작...");

  for (let i = 1; i <= 100; i++) {
    const id = `loco${pad(i)}`;
    const email = `${id}@loco.kr`;
    const nickname = id;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: "loco1234",
      email_confirm: true,
    });

    if (authError) {
      console.error(`[${i}] Auth 생성 실패 (${email}):`, authError.message);
      continue;
    }

    const userId = authData.user.id;

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      email,
      nickname,
      bio: BIOS[(i - 1) % BIOS.length],
      region: REGIONS[(i - 1) % REGIONS.length],
      role: "member",
      kakao_notification_enabled: true,
    });

    if (profileError) {
      console.error(`[${i}] 프로필 생성 실패 (${email}):`, profileError.message);
    } else {
      console.log(`[${i}] 완료: ${email}`);
    }
  }

  console.log("완료!");
}

main();
