"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CancelClassButton({ classId }: { classId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    const confirmed = confirm(
      "신청자가 있을 경우 클래스가 취소 처리되고 알림이 발송됩니다. 계속하시겠습니까?"
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/classes/${classId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        if (data.deleted) {
          router.push("/?tab=mypage");
        } else {
          router.refresh();
        }
      } else {
        alert(data.error ?? "오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCancel}
      disabled={loading}
      className="flex-1 btn-outline text-sm py-3 text-red-500 border-red-200 disabled:opacity-50"
    >
      {loading ? "처리 중..." : "취소/삭제"}
    </button>
  );
}
