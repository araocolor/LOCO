"use client";

import { useMemo, useState } from "react";
import type { UserRole } from "@/types/user";

interface AdminUserItem {
  id: string;
  email: string | null;
  nickname: string;
  role: UserRole;
  created_at: string;
}

export interface AdminMembersTabProps {
  initialUsers: AdminUserItem[];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

const ROLE_LABELS: Record<UserRole, string> = {
  member: "일반회원",
  pro: "프로",
  admin: "관리자",
  suspended: "정지",
};

type RoleFilter = "all" | "member" | "pro" | "suspended";

export default function AdminMembersTab({
  initialUsers,
}: AdminMembersTabProps) {
  const [users, setUsers] = useState(initialUsers);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [runningUserId, setRunningUserId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const filteredUsers = useMemo(() => {
    let list = users;
    if (roleFilter !== "all") list = list.filter((u) => u.role === roleFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((u) =>
        u.nickname.toLowerCase().includes(q) || (u.email && u.email.toLowerCase().includes(q))
      );
    }
    return list;
  }, [users, roleFilter, searchQuery]);

  async function handleChangeRole(userId: string, nextRole: "member" | "pro" | "suspended") {
    setError("");
    setSuccess("");
    setRunningUserId(userId);

    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "등급 변경 중 오류가 발생했습니다.");
        return;
      }

      setUsers((prev) =>
        prev.map((item) =>
          item.id === userId ? { ...item, role: data.role as UserRole } : item
        )
      );
      setSuccess("회원 등급이 변경되었습니다.");
    } catch {
      setError("등급 변경 중 오류가 발생했습니다.");
    } finally {
      setRunningUserId("");
    }
  }

  async function handleDeleteUser(userId: string, nickname: string) {
    const confirmed = confirm(`${nickname || "이 회원"} 계정을 삭제할까요? 삭제 후 되돌릴 수 없습니다.`);
    if (!confirmed) return;

    setError("");
    setSuccess("");
    setRunningUserId(userId);

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "회원 삭제 중 오류가 발생했습니다.");
        return;
      }

      setUsers((prev) => prev.filter((item) => item.id !== userId));
      setSuccess("회원이 삭제되었습니다.");
    } catch {
      setError("회원 삭제 중 오류가 발생했습니다.");
    } finally {
      setRunningUserId("");
    }
  }

  return (
    <div className="space-y-5">
      <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="닉네임 또는 이메일 검색"
          className="w-full text-sm py-2.5 px-3 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400"
        />

      {error && <p className="error-text">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <section className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">회원관리 <span className="text-sm font-normal text-gray-500">총 {users.length}명</span></h2>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
            className="text-xs py-1.5 px-2 rounded-lg border border-gray-200 bg-white text-gray-700"
          >
            <option value="all">전체</option>
            <option value="member">일반회원</option>
            <option value="pro">프로</option>
            <option value="suspended">정지</option>
          </select>
        </div>

        {filteredUsers.length === 0 ? (
          <p className="text-sm text-gray-500">회원이 없습니다.</p>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredUsers.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {item.nickname || "닉네임 없음"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{item.email || "이메일 없음"}</p>
                  <p className="text-xs text-gray-500 mt-1">가입일: {formatDate(item.created_at)}</p>
                </div>

                <div className="flex items-center gap-2">
                  {item.role === "admin" ? (
                    <span className="text-xs text-gray-600">{ROLE_LABELS[item.role]}</span>
                  ) : (
                    <>
                      <select
                        value={item.role}
                        disabled={runningUserId === item.id}
                        onChange={(e) => {
                          const next = e.target.value as "member" | "pro" | "suspended";
                          if (next !== item.role) handleChangeRole(item.id, next);
                        }}
                        className="text-xs py-1.5 px-2 rounded-lg border border-gray-200 bg-white text-gray-700"
                      >
                        <option value="member">{ROLE_LABELS.member}</option>
                        <option value="pro">{ROLE_LABELS.pro}</option>
                        <option value="suspended">{ROLE_LABELS.suspended}</option>
                      </select>
                      <button
                        type="button"
                        className="btn-outline text-xs py-1.5 px-3 text-red-500 border-red-200"
                        disabled={runningUserId === item.id}
                        onClick={() => handleDeleteUser(item.id, item.nickname)}
                      >
                        삭제
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
