"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { CREDIT_PLANS } from "@/lib/poster-credits/plans";
import CreditChargeGame from "@/components/class/CreditChargeGame";
import LegalDrawer from "@/components/legal/LegalDrawer";
import TermsOfServiceContent from "@/components/legal/TermsOfServiceContent";
import RefundPolicyContent from "@/components/legal/RefundPolicyContent";

const CHAT_FRIENDS_CACHE_KEY = "chat_friends_cache";

interface GameFriendCacheItem {
  id: string;
  nickname: string;
  profile_image_url: string | null;
}

function ensureGameFriendCache() {
  try {
    const raw = localStorage.getItem(CHAT_FRIENDS_CACHE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as {
      following?: GameFriendCacheItem[];
      followers?: GameFriendCacheItem[];
      ts?: number;
    };
    const following = Array.isArray(parsed.following) ? parsed.following : [];
    if (following.length > 0) return true;

    const followers = Array.isArray(parsed.followers) ? parsed.followers : [];
    if (followers.length === 0) return false;

    localStorage.setItem(
      CHAT_FRIENDS_CACHE_KEY,
      JSON.stringify({ ...parsed, following: followers.slice(0, 5), ts: parsed.ts ?? Date.now() })
    );
    return true;
  } catch {
    return false;
  }
}

function writeGameFriendCache(friends: GameFriendCacheItem[]) {
  localStorage.setItem(
    CHAT_FRIENDS_CACHE_KEY,
    JSON.stringify({ following: friends.slice(0, 5), followers: [], ts: Date.now() })
  );
}

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
  const [alreadyUsedPreCharge, setAlreadyUsedPreCharge] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/poster-credits/pre-charge/check")
      .then((r) => r.json())
      .then((d) => setAlreadyUsedPreCharge(d.used === true))
      .catch(() => {});
    if (ensureGameFriendCache()) return;
    fetch("/api/poster-credits/pre-charge/friends")
      .then((r) => r.json())
      .then((d: { friends?: GameFriendCacheItem[] }) => {
        if (!Array.isArray(d.friends)) return;
        writeGameFriendCache(d.friends);
      })
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

        <label className="flex items-center gap-2 mt-4 mb-4 cursor-pointer">
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
            "카카오페이로 결제하기"
          )}
        </button>

        {!alreadyUsedPreCharge && (
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
            setAlreadyUsedPreCharge(true);
            onComplete();
          }}
          onCancel={() => setGameOpen(false)}
        />
      )}

      <LegalDrawer open={termsOpen} onClose={() => setTermsOpen(false)} title="서비스 이용약관">
        <TermsOfServiceContent />
      </LegalDrawer>

      <LegalDrawer open={refundOpen} onClose={() => setRefundOpen(false)} title="환불정책">
        <RefundPolicyContent />
      </LegalDrawer>
    </div>
  );
}
