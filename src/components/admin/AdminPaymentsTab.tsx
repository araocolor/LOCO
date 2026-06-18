"use client";

import { useEffect, useMemo, useState } from "react";

interface PaymentItem {
  id: string;
  user_id: string;
  nickname: string;
  email: string | null;
  amount: number;
  credit_amount: number;
  payment_type: string;
  status: string;
  partner_order_id: string;
  created_at: string;
  approved_at: string | null;
}

type StatusFilter = "all" | "approved" | "ready" | "failed";

const STATUS_LABELS: Record<string, string> = {
  approved: "승인",
  ready: "대기",
  failed: "실패",
};

const STATUS_COLORS: Record<string, string> = {
  approved: "text-green-600",
  ready: "text-yellow-600",
  failed: "text-red-500",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatAmount(amount: number) {
  return amount.toLocaleString("ko-KR") + "원";
}

function getPaymentLabel(partnerOrderId: string) {
  if (partnerOrderId.startsWith("star_")) return "별 충전";
  if (partnerOrderId.startsWith("poster_")) return "크레딧 충전";
  return "기타";
}

export default function AdminPaymentsTab() {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    async function fetchPayments() {
      try {
        const res = await fetch("/api/admin/payments");
        if (res.ok) {
          const data = await res.json();
          setPayments(data.payments);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchPayments();
  }, []);

  const filteredPayments = useMemo(() => {
    let list = payments;
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.nickname.toLowerCase().includes(q) ||
          (p.email && p.email.toLowerCase().includes(q))
      );
    }
    return list;
  }, [payments, statusFilter, searchQuery]);

  const totalApproved = useMemo(
    () => payments.filter((p) => p.status === "approved").reduce((sum, p) => sum + p.amount, 0),
    [payments]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-sm text-gray-400">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <div className="card p-3 text-center">
          <p className="text-xs text-gray-500">전체 건수</p>
          <p className="text-lg font-bold text-gray-900">{payments.length}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-gray-500">승인 건수</p>
          <p className="text-lg font-bold text-green-600">
            {payments.filter((p) => p.status === "approved").length}
          </p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-gray-500">승인 총액</p>
          <p className="text-lg font-bold text-gray-900">{formatAmount(totalApproved)}</p>
        </div>
      </div>

      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="닉네임 또는 이메일 검색"
        className="w-full text-sm py-2.5 px-3 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400"
      />

      <section className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            결제 내역{" "}
            <span className="text-sm font-normal text-gray-500">
              {filteredPayments.length}건
            </span>
          </h2>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="text-xs py-1.5 px-2 rounded-lg border border-gray-200 bg-white text-gray-700"
          >
            <option value="all">전체</option>
            <option value="approved">승인</option>
            <option value="ready">대기</option>
            <option value="failed">실패</option>
          </select>
        </div>

        {filteredPayments.length === 0 ? (
          <p className="text-sm text-gray-500">결제 내역이 없습니다.</p>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredPayments.map((item) => (
              <div key={item.id} className="py-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">
                    {item.nickname}
                  </p>
                  <span
                    className={`text-xs font-semibold ${STATUS_COLORS[item.status] ?? "text-gray-500"}`}
                  >
                    {STATUS_LABELS[item.status] ?? item.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    {getPaymentLabel(item.partner_order_id)} · {item.credit_amount}개
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatAmount(item.amount)}
                  </p>
                </div>
                <p className="text-xs text-gray-400">
                  {formatDate(item.created_at)}
                  {item.approved_at && ` · 승인 ${formatDate(item.approved_at)}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
