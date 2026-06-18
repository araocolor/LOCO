"use client";

import Link from "next/link";
import { useState } from "react";

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

export interface AdminClassesTabProps {
  initialClasses: AdminClassItem[];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

const CLASS_STATUS_LABELS: Record<AdminClassItem["status"], string> = {
  recruiting: "모집중",
  closed: "마감",
  cancelled: "취소",
};

const CLASS_TYPE_LABELS: Record<AdminClassItem["type"], string> = {
  class: "클래스",
  event: "이벤트",
};

export default function AdminClassesTab({ initialClasses }: AdminClassesTabProps) {
  const [classes, setClasses] = useState(initialClasses);
  const [runningClassId, setRunningClassId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
    <div className="space-y-5">
      {error && <p className="error-text">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <section className="card p-4 space-y-3">
        <h2 className="text-base font-semibold">클래스/이벤트 관리 <span className="text-sm font-normal text-gray-500">총 {classes.length}건</span></h2>

        {classes.length === 0 ? (
          <p className="text-sm text-gray-500">등록된 클래스/이벤트가 없습니다.</p>
        ) : (
          <div className="divide-y divide-gray-200">
            {classes.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/classes/${item.id}`} className="text-sm font-semibold text-gray-900 block truncate">
                    {item.title}
                  </Link>
                  <p className="text-xs text-gray-500 mt-1">
                    {CLASS_TYPE_LABELS[item.type]} · {CLASS_STATUS_LABELS[item.status]} · 개설자 {item.host?.nickname || "알 수 없음"} · {formatDate(item.created_at)}
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
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
