"use client";

import { useState } from "react";
import { X, Loader2, Star } from "lucide-react";
import LegalDrawer from "@/components/legal/LegalDrawer";
import TermsOfServiceContent from "@/components/legal/TermsOfServiceContent";
import RefundPolicyContent from "@/components/legal/RefundPolicyContent";

const STAR_PLAN = { baseStars: 20, basePrice: 11000 };

const BONUS_MAP: Record<number, number> = {
  1: 1,
  2: 5,
  3: 10,
  4: 20,
  5: 40,
};

interface StarChargeSheetProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function StarChargeSheet({ open, onClose, onComplete }: StarChargeSheetProps) {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);

  if (!open) return null;

  const totalStars = STAR_PLAN.baseStars * quantity;
  const bonus = BONUS_MAP[quantity] ?? 0;
  const totalPrice = STAR_PLAN.basePrice * quantity;

  const handlePay = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/star/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        setError(errBody?.detail || "결제 준비에 실패했습니다.");
        return;
      }

      const data = await res.json();
      const redirectUrl = data.next_redirect_mobile_url || data.next_redirect_pc_url;

      if (!redirectUrl) {
        setError("결제 페이지를 열 수 없습니다.");
        return;
      }

      window.location.href = redirectUrl;
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={loading ? undefined : onClose}
      />
      <div className="relative w-full max-w-[500px] animate-sheet-slide-up rounded-t-2xl bg-white px-5 pb-8 pt-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[20px] font-extrabold text-[#111]">별 충전하기</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex h-10 w-10 items-center justify-center text-gray-500"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex items-center justify-between rounded-xl border-2 border-[#fee500] bg-[#fffde6] px-5 py-4 mb-4">
          <div className="flex items-center gap-2">
            <Star size={20} className="text-yellow-400 fill-yellow-400" />
            <span className="text-[17px] font-bold text-[#111]">별 20개</span>
          </div>
          <span className="text-[18px] font-extrabold text-[#111]">11,000원</span>
        </div>

        <div className="mb-4">
          <p className="text-[14px] font-semibold text-[#555] mb-2">수량 선택</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuantity(q)}
                className={`flex-1 rounded-xl border-2 py-3 text-center text-[16px] font-bold transition-colors ${
                  quantity === q
                    ? "border-[#fee500] bg-[#fffde6] text-[#111]"
                    : "border-[#e5e7eb] bg-white text-[#999]"
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-gray-50 px-4 py-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-[15px] text-[#555]">기본 별</span>
            <span className="text-[15px] font-bold text-[#111]">{totalStars}개</span>
          </div>
          {bonus > 0 && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-[15px] text-[#E84040]">보너스 별</span>
              <span className="text-[15px] font-bold text-[#E84040]">+{bonus}개</span>
            </div>
          )}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
            <span className="text-[16px] font-bold text-[#111]">총 별</span>
            <span className="text-[17px] font-extrabold text-[#111]">{totalStars + bonus}개</span>
          </div>
        </div>

        {error && (
          <p className="mb-3 text-center text-[14px] font-medium text-red-500">{error}</p>
        )}

        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="w-4 h-4 accent-[#fee500] rounded"
          />
          <span className="text-[13px] text-[#555]">
            <button type="button" onClick={() => setTermsOpen(true)} className="underline text-[#333] font-semibold">이용약관</button>
            {" 및 "}
            <button type="button" onClick={() => setRefundOpen(true)} className="underline text-[#333] font-semibold">환불정책</button>
            에 동의합니다
          </span>
        </label>

        <button
          type="button"
          onClick={handlePay}
          disabled={loading || !agreed}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#fee500] py-4 text-[16px] font-bold text-[#191600] transition active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              결제 준비 중...
            </>
          ) : (
            `${totalPrice.toLocaleString()}원 카카오페이로 결제하기`
          )}
        </button>
      </div>

      <LegalDrawer open={termsOpen} onClose={() => setTermsOpen(false)} title="서비스 이용약관">
        <TermsOfServiceContent />
      </LegalDrawer>

      <LegalDrawer open={refundOpen} onClose={() => setRefundOpen(false)} title="환불정책">
        <RefundPolicyContent />
      </LegalDrawer>
    </div>
  );
}
