"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import Avatar from "@/components/ui/Avatar";

const SOCIAL_CACHE_KEY = "search_social_cache";

interface CachedUser {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  status?: string;
}

interface UserItem {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  priority: number;
}

interface CreateChatDrawerProps {
  open: boolean;
  onClose: () => void;
  onRoomCreated: (roomId: string) => void;
}

const MAX_SELECT = 50;
const PAGE_SIZE = 30;

function readCacheArray<T>(key: string, field: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.[field]) ? (parsed[field] as T[]) : [];
  } catch {
    return [];
  }
}

export default function CreateChatDrawer({ open, onClose, onRoomCreated }: CreateChatDrawerProps) {
  const [query, setQuery] = useState("");
  const [allUsers, setAllUsers] = useState<UserItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [slideIn, setSlideIn] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setSlideIn(false);
      return;
    }
    requestAnimationFrame(() => setSlideIn(true));
    setQuery("");
    setSelectedIds(new Set());
    setVisibleCount(PAGE_SIZE);
    loadUsersFromCache();
  }, [open]);

  function loadUsersFromCache() {
    const following = readCacheArray<CachedUser>(SOCIAL_CACHE_KEY, "following");
    const followers = readCacheArray<CachedUser>(SOCIAL_CACHE_KEY, "followers");

    const friendIds = new Set<string>();
    following.forEach((u) => {
      if (u.status === "friend") friendIds.add(u.id);
    });

    const userMap = new Map<string, UserItem>();

    for (const u of following) {
      if (!u.id) continue;
      userMap.set(u.id, {
        id: u.id,
        nickname: u.nickname ?? "",
        profile_image_url: u.profile_image_url ?? null,
        priority: friendIds.has(u.id) ? 0 : 1,
      });
    }

    for (const u of followers) {
      if (!u.id || userMap.has(u.id)) continue;
      userMap.set(u.id, {
        id: u.id,
        nickname: u.nickname ?? "",
        profile_image_url: u.profile_image_url ?? null,
        priority: 2,
      });
    }

    const sorted = Array.from(userMap.values()).sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.nickname.localeCompare(b.nickname, "en");
    });

    setAllUsers(sorted);
  }

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allUsers;
    return allUsers.filter((u) => u.nickname.toLowerCase().includes(q));
  }, [allUsers, query]);

  const friendUsers = useMemo(() => filteredUsers.filter((u) => u.priority === 0), [filteredUsers]);
  const followingUsers = useMemo(() => filteredUsers.filter((u) => u.priority === 1), [filteredUsers]);
  const followerUsers = useMemo(() => filteredUsers.filter((u) => u.priority === 2), [filteredUsers]);

  const selectedUsers = useMemo(
    () => allUsers.filter((u) => selectedIds.has(u.id)),
    [allUsers, selectedIds]
  );

  const toggleUser = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_SELECT) {
        next.add(id);
      }
      return next;
    });
  }, []);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredUsers.length));
    }
  }

  async function handleConfirm() {
    if (selectedIds.size === 0 || creating) return;
    setCreating(true);

    try {
      const ids = Array.from(selectedIds);

      if (ids.length === 1) {
        const res = await fetch("/api/chat/rooms/direct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_id: ids[0] }),
        });
        const json = await res.json();
        if (res.ok && json.data?.id) {
          onRoomCreated(json.data.id);
          return;
        }
      } else {
        const res = await fetch("/api/chat/rooms/group", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ member_ids: ids }),
        });
        const json = await res.json();
        if (res.ok && json.data?.id) {
          onRoomCreated(json.data.id);
          return;
        }
      }
    } catch {
      // 에러 무시
    } finally {
      setCreating(false);
    }
  }

  function handleClose() {
    setSlideIn(false);
    setTimeout(onClose, 300);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${slideIn ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
      />
      <div
        className={`absolute inset-0 bg-white flex flex-col transition-transform duration-300 ease-out ${slideIn ? "translate-y-0" : "-translate-y-full"}`}
      >
        {/* 헤더 */}
        <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-gray-100">
          <button onClick={handleClose} className="p-1 text-gray-500 hover:text-gray-900">
            <X size={22} />
          </button>
          <h2 className="font-bold text-gray-900 text-[17px]">대화상대 선택</h2>
          <button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0 || creating}
            className="flex items-center gap-1 rounded-full bg-yellow-400 px-3 py-1.5 text-[13px] font-bold text-gray-900 disabled:opacity-40"
          >
            {selectedIds.size > 0 && <span>{selectedIds.size}</span>}
            확인
          </button>
        </header>

        {/* 검색폼 */}
        <div className="px-4 py-3 border-b border-gray-100">
          <label className="flex h-10 items-center gap-2 rounded-full bg-gray-100 px-3">
            <Search size={17} className="text-gray-400" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder="아이디 검색"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
            />
          </label>
        </div>

        {/* 선택된 회원 */}
        <div className="border-b border-gray-100 bg-white shrink-0 py-4 flex flex-col items-center">
          {selectedUsers.length > 0 ? (
            <div className="overflow-x-auto scrollbar-hide w-full py-2" style={{ WebkitOverflowScrolling: "touch" }}>
              <div className="flex gap-3 px-4 w-max">
                {selectedUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => toggleUser(user.id)}
                    className="flex flex-col items-center gap-1 shrink-0"
                  >
                    <div className="relative">
                      <Avatar src={user.profile_image_url} nickname={user.nickname} size={70} />
                      <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center">
                        <X size={14} className="text-white" />
                      </div>
                    </div>
                    <span className="text-[15px] text-gray-700 truncate max-w-[70px] text-center">{user.nickname}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[14px] text-gray-400 py-6">대화할 상대를 선택하세요</p>
          )}
        </div>

        {/* 회원 목록 */}
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-3">
          {filteredUsers.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10">표시할 사용자가 없습니다</p>
          ) : (
            <>
              <UserSection title="친구들" users={friendUsers} selectedIds={selectedIds} onToggle={toggleUser} />
              <UserSection title="팔로잉" users={followingUsers} selectedIds={selectedIds} onToggle={toggleUser} />
              <UserSection title="팔로워" users={followerUsers} selectedIds={selectedIds} onToggle={toggleUser} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function UserSection({ title, users, selectedIds, onToggle }: { title: string; users: UserItem[]; selectedIds: Set<string>; onToggle: (id: string) => void }) {
  if (users.length === 0) return null;
  return (
    <section className="mb-4">
      <div className="mb-2 text-center">
        <span className="inline-block px-3 py-1 rounded-full bg-gray-200 text-[13px] font-bold text-gray-700">{title}</span>
      </div>
      <div className="grid grid-cols-5 gap-x-2 gap-y-4">
        {users.map((user) => (
          <button
            key={user.id}
            onClick={() => onToggle(user.id)}
            className="flex flex-col items-center gap-1.5"
          >
            <AvatarCircle user={user} size={52} selected={selectedIds.has(user.id)} />
            <span className="text-[11px] text-gray-700 truncate w-full text-center leading-tight">
              {user.nickname}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function AvatarCircle({ user, size, selected }: { user: UserItem; size: number; selected: boolean }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <Avatar src={user.profile_image_url} nickname={user.nickname} size={size} />
      {selected && (
        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center border-2 border-white">
          <Check size={11} className="text-white" strokeWidth={3} />
        </div>
      )}
    </div>
  );
}
