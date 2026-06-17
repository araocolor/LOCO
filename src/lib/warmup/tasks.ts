// 웜업 작업 정의
// 각 화면의 "첫 표시" 데이터를 로그인 후 유휴 시간에 미리 받아 캐시에 채운다.
// 캐시 키/형식은 각 화면이 실제로 읽는 것과 동일해야 한다.

import { registerWarmup } from "./manager";
import { prefetchNotifications } from "@/lib/notification-cache";

const HOME_RESULTS_LOCAL_KEY = "loco_home_results_local_v1";
const HOME_RESULTS_PAGE_SIZE = 12;

const CHAT_ROOMS_PREVIEW_CACHE_PREFIX = "loco_chat_rooms_preview_cache_v1:";
// 웜업 받는 순서: 클래스 → 1:1(direct) → 그룹.
const CHAT_PREVIEW_TYPES = ["class", "direct", "group"] as const;

const MY_PAGE_CACHE_KEY = "loco_mypage_cache_local_v3";

// 메인 첫 화면 클래스 목록(기본 필터)을 미리 받아둔다.
// HomeSearchResultsPage가 `${KEY}:all` 캐시를 `{ data, count }` 형식으로 읽으므로 동일하게 저장한다.
async function warmHomeClasses(): Promise<void> {
  const key = `${HOME_RESULTS_LOCAL_KEY}:all`;
  // 이미 캐시가 있으면 건너뛴다. 갱신은 화면 진입 시 자체적으로 한다.
  if (localStorage.getItem(key)) return;
  try {
    const res = await fetch(`/api/classes/search?page=0&limit=${HOME_RESULTS_PAGE_SIZE}`);
    if (!res.ok) return;
    const json = await res.json();
    if (json.error) return;
    const data = (json.data ?? []) as unknown[];
    localStorage.setItem(key, JSON.stringify({ data, count: json.count ?? data.length }));
  } catch {
    // 웜업 실패는 무시. 화면 진입 시 다시 받는다.
  }
}

// 채팅 리스트(미리보기)를 타입별로 미리 받아둔다.
// page-client가 `${PREFIX}${userId}:${type}` 캐시를 `{ data, ts }` 형식으로 읽고
// 읽는 시점에 정규화하므로, raw API 데이터를 그대로 저장한다.
async function warmChatPreview(userId: string): Promise<void> {
  // 동시 요청은 부하로 일부 타입이 통째로 실패할 수 있어 순차로 받는다.
  // 순서: 클래스 → 1:1(direct) → 그룹.
  for (const type of CHAT_PREVIEW_TYPES) {
    const key = `${CHAT_ROOMS_PREVIEW_CACHE_PREFIX}${userId}:${type}`;
    if (localStorage.getItem(key)) continue;
    try {
      const res = await fetch(`/api/chat/rooms/preview?type=${type}`);
      if (!res.ok) continue;
      const json = await res.json();
      const data = (json.data ?? []) as unknown[];
      localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
    } catch {
      // 웜업 실패는 무시. 화면 진입 시 다시 받는다.
    }
  }
}

// 마이페이지(프로필·내 클래스·북마크·지역필터·별/구독 수)를 미리 받아둔다.
// MyPageCacheLoader가 /api/mypage/summary 응답을 그대로 캐시에 저장해 읽으므로,
// 동일하게 raw 응답을 저장한다.
async function warmMyPage(): Promise<void> {
  if (localStorage.getItem(MY_PAGE_CACHE_KEY)) return;
  try {
    const res = await fetch("/api/mypage/summary", { method: "GET", cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    if (json?.needsOnboarding) return;
    localStorage.setItem(MY_PAGE_CACHE_KEY, JSON.stringify(json));
  } catch {
    // 웜업 실패는 무시. 화면 진입 시 다시 받는다.
  }
}

// 로그인 후 실행할 웜업들을 우선순위와 함께 등록한다.
export function registerWarmupTasks(userId: string) {
  registerWarmup({
    name: "home-classes",
    priority: 1,
    run: warmHomeClasses,
  });
  registerWarmup({
    name: "chat-preview",
    priority: 2,
    run: () => warmChatPreview(userId),
  });
  registerWarmup({
    name: "mypage",
    priority: 3,
    run: warmMyPage,
  });
  registerWarmup({
    name: "notifications",
    priority: 4,
    // 기본 탭(class) 알림을 미리 받아 캐시에 채운다. 이미 캐시 있으면 내부에서 건너뛴다.
    run: () => prefetchNotifications(userId),
  });
}
