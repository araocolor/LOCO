"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface ApplyButtonProps {
  classId: string;
  classStatus: string;
  capacity: number;
  approvedCount: number;
  datetime: string;
  myApplication: { id: string; status: string } | null;
  isLoggedIn: boolean;
}

export default function ApplyButton({
  classId,
  classStatus,
  capacity,
  approvedCount,
  datetime,
  myApplication,
  isLoggedIn,
}: ApplyButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const isFull = approvedCount >= capacity;
  const isClosed = classStatus !== "recruiting";
  const isCancelled = classStatus === "cancelled";
  const classDate = new Date(datetime);
  const now = new Date();
  const hoursUntilClass = (classDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  const canCancelApplication = hoursUntilClass > 24;

  async function handleApply() {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_id: classId }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const { error } = await res.json();
        alert(error ?? "신청에 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!myApplication) return;
    if (!confirm("신청을 취소하시겠습니까?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/applications/${myApplication.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      } else {
        alert("취소에 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (isCancelled) {
    return (
      <div className="btn-primary opacity-50 cursor-not-allowed text-center">
        취소된 클래스
      </div>
    );
  }

  if (myApplication?.status === "approved") {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={async () => {
            setLoading(true);
            try {
              const res = await fetch(`/api/chat/rooms/class/${classId}`, { method: "POST" });
              if (res.ok) {
                const { data } = await res.json();
                router.push(`/?tab=messages&roomId=${data.id}`);
              } else {
                alert("대화방 입장에 실패했습니다.");
              }
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
          className="btn-primary bg-green-500 border-0"
        >
          {loading ? "입장 중..." : "대화방 입장"}
        </button>
        {canCancelApplication && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="btn-outline text-sm py-3 text-red-500 border-red-200"
          >
            신청 취소
          </button>
        )}
      </div>
    );
  }

  if (myApplication?.status === "pending") {
    return (
      <div className="flex flex-col gap-2">
        <div className="btn-primary opacity-100 cursor-default text-center bg-gray-400 border-0">
          신청 대기 중
        </div>
        {canCancelApplication && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="btn-outline text-sm py-3 text-red-500 border-red-200"
          >
            신청 취소
          </button>
        )}
      </div>
    );
  }

  if (isClosed || isFull) {
    return (
      <div className="btn-primary opacity-50 cursor-not-allowed text-center">
        {isFull ? "정원 마감" : "모집 마감"}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleApply}
      disabled={loading}
      className="btn-primary"
    >
      {loading ? "신청 중..." : isLoggedIn ? "신청하기" : "로그인 후 신청"}
    </button>
  );
}
