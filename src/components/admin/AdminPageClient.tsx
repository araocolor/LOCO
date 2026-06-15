"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { UserRole } from "@/types/user";

interface AdminUserItem {
  id: string;
  email: string | null;
  nickname: string;
  role: UserRole;
  created_at: string;
}

interface ProRequestItem {
  id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected";
  message: string | null;
  created_at: string;
  user: {
    id: string;
    nickname: string;
    email: string | null;
  } | null;
}

interface AdminClassItem {
  id: string;
  title: string;
  type: "class" | "event";
  status: "recruiting" | "closed" | "cancelled";
  created_at: string;
  host: {
    id: string;
    nickname: string;
  } | null;
}

interface AdminPageClientProps {
  initialUsers: AdminUserItem[];
  initialProRequests: ProRequestItem[];
  initialClasses: AdminClassItem[];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

const ROLE_LABELS: Record<UserRole, string> = {
  member: "일반회원",
  pro: "프로",
  admin: "관리자",
};

const CLASS_STATUS_LABELS: Record<AdminClassItem["status"], string> = {
  recruiting: "모집중",
  closed: "마감",
  cancelled: "취소",
};

const CLASS_TYPE_LABELS: Record<AdminClassItem["type"], string> = {
  class: "클래스",
  event: "이벤트",
};

export default function AdminPageClient({
  initialUsers,
  initialProRequests,
  initialClasses,
}: AdminPageClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [proRequests, setProRequests] = useState(initialProRequests);
  const [classes, setClasses] = useState(initialClasses);

  const [runningUserId, setRunningUserId] = useState("");
  const [runningProReqId, setRunningProReqId] = useState("");
  const [runningClassId, setRunningClassId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const pendingCount = useMemo(
    () => proRequests.filter((item) => item.status === "pending").length,
    [proRequests]
  );

  async function handleChangeRole(userId: string, nextRole: "member" | "pro") {
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
      setProRequests((prev) => prev.filter((item) => item.user_id !== userId));
      setSuccess("회원이 삭제되었습니다.");
    } catch {
      setError("회원 삭제 중 오류가 발생했습니다.");
    } finally {
      setRunningUserId("");
    }
  }

  async function handleProRequest(requestId: string, action: "approve" | "reject") {
    setError("");
    setSuccess("");
    setRunningProReqId(requestId);

    try {
      const res = await fetch(`/api/admin/pro-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "처리 중 오류가 발생했습니다.");
        return;
      }

      setProRequests((prev) =>
        prev.map((item) =>
          item.id === requestId
            ? {
                ...item,
                status: data.status as ProRequestItem["status"],
              }
            : item
        )
      );

      if (action === "approve") {
        setUsers((prev) =>
          prev.map((item) =>
            item.id === data.user_id ? { ...item, role: "pro" } : item
          )
        );
      }

      setSuccess(action === "approve" ? "프로 승인이 완료되었습니다." : "프로 신청이 거절되었습니다.");
    } catch {
      setError("처리 중 오류가 발생했습니다.");
    } finally {
      setRunningProReqId("");
    }
  }

  async function handleForceDeleteClass(classId: string) {
    const confirmed = confirm("이 클래스를 관리자 권한으로 즉시 삭제할까요?");
    if (!confirmed) return;

    setError("");
    setSuccess("");
    setRunningClassId(classId);

    try {
      const res = await fetch(`/api/admin/classes/${classId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "삭제 중 오류가 발생했습니다.");
        return;
      }

      setClasses((prev) => prev.filter((item) => item.id !== classId));
      setSuccess("클래스가 삭제되었습니다.");
    } catch {
      setError("삭제 중 오류가 발생했습니다.");
    } finally {
      setRunningClassId("");
    }
  }

  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#f6f8fb]">
      <div className="max-w-5xl mx-auto px-4 py-4 pb-24 space-y-5">
        <div className="sticky top-0 z-30 bg-[#f6f8fb] py-2">
          <h1 className="text-xl font-bold">관리자 페이지</h1>
        </div>

      {error && <p className="error-text">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <section className="card p-4 space-y-3">
        <h2 className="text-base font-semibold">프로 신청 관리</h2>
        <p className="text-xs text-gray-500">대기 중 {pendingCount}건</p>

        {proRequests.length === 0 ? (
          <p className="text-sm text-gray-500">프로 신청 내역이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {proRequests.map((item) => (
              <div key={item.id} className="border border-gray-100 rounded-xl p-3 bg-white">
                <p className="text-sm font-semibold text-gray-900">
                  {item.user?.nickname || "알 수 없음"}
                </p>
                <p className="text-xs text-gray-500">{item.user?.email || "이메일 없음"}</p>
                <p className="text-xs text-gray-500 mt-1">신청일: {formatDate(item.created_at)}</p>
                <p className="text-xs mt-1 text-gray-600">상태: {item.status}</p>
                {item.message && (
                  <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{item.message}</p>
                )}

                {item.status === "pending" && (
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      className="btn-primary text-sm py-2 flex-1"
                      disabled={runningProReqId === item.id}
                      onClick={() => handleProRequest(item.id, "approve")}
                    >
                      승인
                    </button>
                    <button
                      type="button"
                      className="btn-outline text-sm py-2 flex-1 text-red-500 border-red-200"
                      disabled={runningProReqId === item.id}
                      onClick={() => handleProRequest(item.id, "reject")}
                    >
                      거절
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="text-base font-semibold">회원 등급 관리</h2>

        {users.length === 0 ? (
          <p className="text-sm text-gray-500">회원이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {users.map((item) => (
              <div key={item.id} className="border border-gray-100 rounded-xl p-3 bg-white">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {item.nickname || "닉네임 없음"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{item.email || "이메일 없음"}</p>
                    <p className="text-xs text-gray-500 mt-1">가입일: {formatDate(item.created_at)}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">{ROLE_LABELS[item.role]}</span>
                    {item.role !== "admin" && (
                      <>
                        <button
                          type="button"
                          className="btn-outline text-xs py-1.5 px-3"
                          disabled={runningUserId === item.id}
                          onClick={() => handleChangeRole(item.id, item.role === "pro" ? "member" : "pro")}
                        >
                          {item.role === "pro" ? "member로" : "pro로"}
                        </button>
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
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="text-base font-semibold">클래스/이벤트 관리</h2>

        {classes.length === 0 ? (
          <p className="text-sm text-gray-500">등록된 클래스/이벤트가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {classes.map((item) => (
              <div key={item.id} className="border border-gray-100 rounded-xl p-3 bg-white">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/classes/${item.id}`} className="text-sm font-semibold text-gray-900 block truncate">
                      {item.title}
                    </Link>
                    <p className="text-xs text-gray-500 mt-1">
                      {CLASS_TYPE_LABELS[item.type]} · {CLASS_STATUS_LABELS[item.status]} · 개설자 {item.host?.nickname || "알 수 없음"}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn-outline text-xs py-1.5 px-3 text-red-500 border-red-200"
                    disabled={runningClassId === item.id}
                    onClick={() => handleForceDeleteClass(item.id)}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
