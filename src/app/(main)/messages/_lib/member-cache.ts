import type { Conversation } from "../_types";

// 방 회원 스냅샷 캐시
// 방 진입 시 받은 회원 목록을 방별로 저장해, 다음 진입 시 즉시 표시(게임 12명 + 회원보기)한다.
// 100명+ 방을 대비해 방당 회원 수와 캐시 방 개수에 상한을 둔다.

type RoomMembers = NonNullable<Conversation["members"]>;

const MEMBER_CACHE_PREFIX = "loco_chat_room_members_v1:";
const MEMBER_CACHE_INDEX_KEY = "loco_chat_room_members_index_v1";

// 방당 캐시할 최대 회원 수(게임 12명 + 회원보기 첫 화면을 충분히 덮음).
const MAX_MEMBERS_PER_ROOM = 60;
// 캐시를 유지할 최대 방 개수(오래된 방부터 정리).
const MAX_CACHED_ROOMS = 20;

function getMemberCacheKey(roomId: string) {
  return `${MEMBER_CACHE_PREFIX}${roomId}`;
}

// 가벼운 필드만 남겨 저장한다(용량 절약).
function slimMembers(members: RoomMembers): RoomMembers {
  return members.slice(0, MAX_MEMBERS_PER_ROOM).map((m) => ({
    user_id: m.user_id,
    role: m.role,
    created_at: m.created_at ?? null,
    profile: m.profile
      ? {
          id: m.profile.id,
          nickname: m.profile.nickname,
          profile_image_url: m.profile.profile_image_url,
          nickname_changed_at: m.profile.nickname_changed_at ?? null,
        }
      : null,
  }));
}

function readIndex(): string[] {
  try {
    const raw = localStorage.getItem(MEMBER_CACHE_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

// 최근 사용한 방을 앞으로 옮기고, 상한을 넘는 오래된 방 캐시는 삭제한다.
function touchIndex(roomId: string) {
  try {
    const index = readIndex().filter((id) => id !== roomId);
    index.unshift(roomId);
    const evicted = index.slice(MAX_CACHED_ROOMS);
    evicted.forEach((id) => localStorage.removeItem(getMemberCacheKey(id)));
    localStorage.setItem(MEMBER_CACHE_INDEX_KEY, JSON.stringify(index.slice(0, MAX_CACHED_ROOMS)));
  } catch {}
}

export function readRoomMembersCache(roomId: string): RoomMembers | null {
  try {
    const raw = localStorage.getItem(getMemberCacheKey(roomId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RoomMembers) : null;
  } catch {
    return null;
  }
}

export function writeRoomMembersCache(roomId: string, members: RoomMembers | undefined) {
  if (!members || members.length === 0) return;
  try {
    localStorage.setItem(getMemberCacheKey(roomId), JSON.stringify(slimMembers(members)));
    touchIndex(roomId);
  } catch {}
}
