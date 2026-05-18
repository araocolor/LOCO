"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";

interface ApplicantItem {
  id: string;
  status: "pending" | "approved";
  created_at: string;
  applicant: {
    id: string;
    nickname: string;
    profile_image_url: string | null;
  } | null;
}

interface ClassApplicantSheetProps {
  open: boolean;
  classId: string;
  onClose: () => void;
}

export default function ClassApplicantSheet({
  open,
  classId,
  onClose,
}: ClassApplicantSheetProps) {
  const [activeTab, setActiveTab] = useState<"pending" | "approved">("pending");
  const [pending, setPending] = useState<ApplicantItem[]>([]);
  const [approved, setApproved] = useState<ApplicantItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setActiveTab("pending");
      setLoading(true);
      setError(null);
    });

    fetch(`/api/classes/${classId}/applications`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "신청자 목록을 불러오지 못했습니다.");
        const nextPending = Array.isArray(json.data?.pending) ? (json.data.pending as ApplicantItem[]) : [];
        const nextApproved = Array.isArray(json.data?.approved) ? (json.data.approved as ApplicantItem[]) : [];
        setPending(nextPending);
        setApproved(nextApproved);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "신청자 목록을 불러오지 못했습니다.");
      })
      .finally(() => setLoading(false));
  }, [open, classId]);

  const visible = useMemo(
    () => (activeTab === "pending" ? pending : approved),
    [activeTab, pending, approved]
  );

  async function handleApprove(applicationId: string) {
    if (loadingId) return;

    setLoadingId(applicationId);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "승인에 실패했습니다.");
        return;
      }

      const target = pending.find((item) => item.id === applicationId);
      if (!target) return;

      setPending((prev) => prev.filter((item) => item.id !== applicationId));
      setApproved((prev) => [{ ...target, status: "approved" }, ...prev]);
    } catch {
      setError("승인에 실패했습니다.");
    } finally {
      setLoadingId(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120]">
      <button
        type="button"
        aria-label="신청자 목록 닫기"
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
      />
      <section className="absolute bottom-0 left-0 right-0 mx-auto w-full max-w-[500px] rounded-t-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-base font-bold text-gray-900">신청자 목록</h2>
          <button type="button" onClick={onClose} className="p-1 text-gray-500 hover:text-gray-900">
            <X size={20} />
          </button>
        </header>

        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2">
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              activeTab === "pending"
                ? "bg-[#FEE500] text-gray-900"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            신청 대기 {pending.length}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("approved")}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              activeTab === "approved"
                ? "bg-[#FEE500] text-gray-900"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            승인됨 {approved.length}
          </button>
        </div>

        <div className="max-h-[58vh] overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="py-8 text-center text-sm text-gray-400">불러오는 중...</p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-500">{error}</p>
          ) : visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              {activeTab === "pending" ? "대기 중인 신청자가 없습니다." : "승인된 신청자가 없습니다."}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {visible.map((item) => {
                const profile = item.applicant;
                return (
                  <div key={item.id} className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5">
                    {profile?.profile_image_url ? (
                      <Image
                        src={profile.profile_image_url}
                        alt={profile.nickname}
                        width={38}
                        height={38}
                        className="h-[38px] w-[38px] rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-500">
                        {profile?.nickname?.[0] ?? "?"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">{profile?.nickname ?? "알 수 없음"}</p>
                      <p className="truncate text-xs text-gray-400">
                        {new Date(item.created_at).toLocaleString("ko-KR")}
                      </p>
                    </div>
                    {activeTab === "pending" ? (
                      <button
                        type="button"
                        onClick={() => {
                          void handleApprove(item.id);
                        }}
                        disabled={loadingId === item.id}
                        className="rounded-full bg-[#FEE500] px-3 py-1.5 text-xs font-bold text-gray-900 disabled:opacity-60"
                      >
                        {loadingId === item.id ? "승인 중" : "승인"}
                      </button>
                    ) : (
                      <span className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-600">
                        승인됨
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
