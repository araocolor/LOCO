"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Search, UserPlus, X } from "lucide-react";
import type { Conversation, OtherUser } from "../_types";

const SEARCH_CACHE_KEY = "search_prefetch_cache";
const MEMBERS_CACHE_KEY = "search_members_cache_v3";
const SUGGESTIONS_KEY = "search_suggestions_cache";

interface CandidateUser extends OtherUser {
  region?: string | null;
  status?: string;
  is_blocked?: boolean;
  is_hidden?: boolean;
}

interface ChatMemberDrawerProps {
  open: boolean;
  roomId: string | null;
  currentMembers: Conversation["members"];
  onClose: () => void;
  onMemberAdded: (room: unknown) => void;
}

function readArrayFromCache<T>(key: string, field: string) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.[field]) ? (parsed[field] as T[]) : [];
  } catch {
    return [];
  }
}

function uniqueUsers(users: CandidateUser[]) {
  const map = new Map<string, CandidateUser>();
  users.forEach((user) => {
    if (!user.id || user.is_blocked || user.is_hidden) return;
    map.set(user.id, user);
  });
  return Array.from(map.values()).sort((a, b) => a.nickname.localeCompare(b.nickname, "ko"));
}

export default function ChatMemberDrawer({
  open,
  roomId,
  currentMembers,
  onClose,
  onMemberAdded,
}: ChatMemberDrawerProps) {
  const [query, setQuery] = useState("");
  const [mutualFriends, setMutualFriends] = useState<CandidateUser[]>([]);
  const [members, setMembers] = useState<CandidateUser[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const existingIds = useMemo(
    () => new Set((currentMembers ?? []).map((member) => member.user_id)),
    [currentMembers]
  );

  useEffect(() => {
    if (!open) return;

    queueMicrotask(() => {
      const following = readArrayFromCache<CandidateUser>(SEARCH_CACHE_KEY, "following");
      const cachedMembers = readArrayFromCache<CandidateUser>(MEMBERS_CACHE_KEY, "members");
      const suggestions = readArrayFromCache<CandidateUser>(SUGGESTIONS_KEY, "suggestions");

      setMutualFriends(uniqueUsers(following.filter((user) => user.status === "friend")));
      setMembers(uniqueUsers([...cachedMembers, ...suggestions]));
      setError(null);
      setLoadingMembers(true);
    });

    fetch("/api/users/members?limit=100&offset=0")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((json) => {
        const incoming = Array.isArray(json.data) ? (json.data as CandidateUser[]) : [];
        setMembers((prev) => uniqueUsers([...prev, ...incoming]));
      })
      .catch(() => {})
      .finally(() => setLoadingMembers(false));
  }, [open]);

  const filteredMutualFriends = useMemo(
    () => filterCandidates(mutualFriends, query, existingIds),
    [mutualFriends, query, existingIds]
  );

  const filteredMembers = useMemo(
    () => filterCandidates(members, query, existingIds),
    [members, query, existingIds]
  );

  async function handleAddUser(targetId: string) {
    if (!roomId || addingId) return;

    setAddingId(targetId);
    setError(null);
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "사용자를 추가하지 못했습니다.");
        return;
      }

      onMemberAdded(json.data);
    } catch {
      setError("사용자를 추가하지 못했습니다.");
    } finally {
      setAddingId(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[360px] bg-white shadow-2xl flex flex-col">
        <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <UserPlus size={19} className="text-gray-800" />
            <h2 className="font-bold text-gray-900" style={{ fontSize: 17 }}>새 사용자 추가</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-900">
            <X size={20} />
          </button>
        </header>

        <div className="px-4 py-3 border-b border-gray-100">
          <label className="flex h-10 items-center gap-2 rounded-full bg-gray-100 px-3">
            <Search size={17} className="text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="아이디 검색"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
            />
          </label>
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex-1 overflow-y-auto">
          <MemberSection
            title="맞팔"
            users={filteredMutualFriends}
            addingId={addingId}
            onAddUser={handleAddUser}
          />
          <MemberSection
            title={loadingMembers ? "전체회원 불러오는 중" : "전체회원"}
            users={filteredMembers}
            addingId={addingId}
            onAddUser={handleAddUser}
          />
        </div>
      </aside>
    </div>
  );
}

function filterCandidates(users: CandidateUser[], query: string, existingIds: Set<string>) {
  const normalizedQuery = query.trim().toLowerCase();
  return users.filter((user) => {
    if (existingIds.has(user.id)) return false;
    if (!normalizedQuery) return true;
    return user.nickname.toLowerCase().includes(normalizedQuery);
  });
}

function MemberSection({
  title,
  users,
  addingId,
  onAddUser,
}: {
  title: string;
  users: CandidateUser[];
  addingId: string | null;
  onAddUser: (targetId: string) => void;
}) {
  return (
    <section className="py-3">
      <div className="px-4 pb-2 text-xs font-bold text-gray-400">{title}</div>
      {users.length === 0 ? (
        <p className="px-4 py-5 text-sm text-gray-400">표시할 사용자가 없습니다</p>
      ) : (
        users.map((user) => (
          <button
            key={user.id}
            onClick={() => onAddUser(user.id)}
            disabled={addingId !== null}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 disabled:opacity-60"
          >
            {user.profile_image_url ? (
              <Image
                src={user.profile_image_url}
                alt={user.nickname}
                width={38}
                height={38}
                className="h-[38px] w-[38px] rounded-full object-cover"
              />
            ) : (
              <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-500">
                {user.nickname[0] ?? "?"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-gray-900">{user.nickname}</p>
              {user.region && <p className="truncate text-xs text-gray-400">{user.region}</p>}
            </div>
            <span className="text-xs font-semibold text-gray-500">
              {addingId === user.id ? "추가 중" : "추가"}
            </span>
          </button>
        ))
      )}
    </section>
  );
}
