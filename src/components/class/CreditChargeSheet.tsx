"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { CREDIT_PLANS } from "@/lib/poster-credits/plans";
import CreditChargeGame from "@/components/class/CreditChargeGame";

interface CreditChargeSheetProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function CreditChargeSheet({ open, onClose, onComplete }: CreditChargeSheetProps) {
  const [selectedPlan, setSelectedPlan] = useState<string>(CREDIT_PLANS[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [gameOpen, setGameOpen] = useState(false);
  const [alreadyUsedFreeCharge, setAlreadyUsedFreeCharge] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/poster-credits/free-charge/check")
      .then((r) => r.json())
      .then((d) => setAlreadyUsedFreeCharge(d.used === true))
      .catch(() => {});
  }, [open]);

  if (!open) return null;

  const handlePay = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/poster-credits/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlan }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        setError(errBody?.detail || "결제 준비에 실패했습니다.");
        return;
      }

      const data = await res.json();

      const redirectUrl =
        data.next_redirect_mobile_url || data.next_redirect_pc_url;

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
    <div className="fixed inset-0 z-[200] flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={loading ? undefined : onClose}
      />
      <div className="relative w-full max-w-[500px] animate-sheet-slide-up rounded-t-2xl bg-white px-5 pb-8 pt-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[20px] font-extrabold text-[#111]">크레딧(횟수) 충전하기</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex h-10 w-10 items-center justify-center text-gray-500"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {CREDIT_PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedPlan(plan.id)}
                className={`flex items-center justify-between rounded-xl border-2 px-5 py-4 transition-colors ${
                  isSelected
                    ? "border-[#fee500] bg-[#fffde6]"
                    : "border-[#e5e7eb] bg-white"
                }`}
              >
                <div className="flex flex-col items-start">
                  <span className="text-[17px] font-bold text-[#111]">{plan.label}</span>
                  {plan.id === "plan_25" && (
                    <span className="mt-0.5 text-[12px] text-[#E84040]">
                      25% 할인
                    </span>
                  )}
                </div>
                <span className="text-[18px] font-extrabold text-[#111]">
                  {plan.amount.toLocaleString()}원
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <p className="mt-3 text-center text-[14px] font-medium text-red-500">{error}</p>
        )}

        <button
          type="button"
          onClick={handlePay}
          disabled={loading}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#fee500] py-4 text-[16px] font-bold text-[#191600] transition active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              결제 준비 중...
            </>
          ) : (
            "카카오페이로 결제하기"
          )}
        </button>

        {!alreadyUsedFreeCharge && (
          <button
            type="button"
            onClick={() => setGameOpen(true)}
            className="mt-3 w-full text-center text-[14px] font-semibold text-[#666] underline underline-offset-2 transition active:opacity-60"
          >
            외상충전 →
          </button>
        )}
      </div>

      {gameOpen && (
        <CreditChargeGame
          onSuccess={() => {
            setGameOpen(false);
            onComplete();
          }}
          onCancel={() => setGameOpen(false)}
        />
      )}
    </div>
  );
}
