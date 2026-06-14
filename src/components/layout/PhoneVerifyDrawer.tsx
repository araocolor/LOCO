"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, CheckCircle } from "lucide-react";

interface PhoneVerifyDrawerProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
}

export default function PhoneVerifyDrawer({ open, onClose, onVerified }: PhoneVerifyDrawerProps) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);
  const [remainSec, setRemainSec] = useState(0);
  const [sendCount, setSendCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setPhone("");
      setCode("");
      setCodeSent(false);
      setError("");
      setVerified(false);
      setRemainSec(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [open]);

  useEffect(() => {
    if (remainSec <= 0 && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [remainSec]);

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    setRemainSec(180);
    timerRef.current = setInterval(() => {
      setRemainSec((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
  }

  function formatPhone(value: string) {
    const nums = value.replace(/[^0-9]/g, "").slice(0, 11);
    if (nums.length <= 3) return nums;
    if (nums.length <= 7) return `${nums.slice(0, 3)}-${nums.slice(3)}`;
    return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7)}`;
  }

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  async function handleSendCode() {
    const cleaned = phone.replace(/[^0-9]/g, "");
    if (cleaned.length < 10) {
      setError("올바른 전화번호를 입력하세요");
      return;
    }
    if (sendCount >= 3) {
      setError("발송횟수가 초과되었습니다");
      fetch("/api/phone/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleaned, blocked: true }),
      }).catch(() => {});
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/phone/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleaned }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "발송 실패");
        return;
      }
      setSendCount((prev) => prev + 1);
      setCodeSent(true);
      startTimer();
    } catch {
      setError("네트워크 오류");
    } finally {
      setSending(false);
    }
  }

  async function handleVerify() {
    if (code.length !== 6) {
      setError("6자리 인증번호를 입력하세요");
      return;
    }
    if (remainSec <= 0) {
      setError("인증번호가 만료되었습니다. 다시 요청해주세요");
      return;
    }
    setVerifying(true);
    setError("");
    try {
      const cleaned = phone.replace(/[^0-9]/g, "");
      const res = await fetch("/api/phone/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleaned, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "인증 실패");
        return;
      }
      setVerified(true);
    } catch {
      setError("네트워크 오류");
    } finally {
      setVerifying(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[250] bg-black/40 transition-opacity duration-300"
        onClick={onClose}
      />

      <div
        className="fixed inset-0 z-[300] flex flex-col bg-white transition-transform duration-300 ease-in-out translate-x-0"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="relative flex-shrink-0 px-4 pt-3 pb-2">
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center text-[#333]">
            <ChevronLeft size={25} />
          </button>
          <p className="pointer-events-none absolute left-1/2 top-[32px] -translate-x-1/2 -translate-y-1/2 text-[21px] font-bold text-[#333]">
            본인인증
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-16">
          <div className="flex justify-center mb-6">
            <Image
              src="/character/tino.png"
              alt="TINO"
              width={90}
              height={90}
              className="h-auto w-[90px] object-contain"
            />
          </div>
          <h2 className="text-[22px] font-bold text-[#333] leading-[1.35] mb-2 text-center">
            전화번호를 인증해주세요
          </h2>
          <p className="text-[15px] text-gray-500 mb-10 text-center">
            공식프로필 등록을 위해 본인 확인이 필요합니다
          </p>

          <div className="space-y-4">
            <div>
              <label className="text-[14px] font-semibold text-[#333] mb-1 block">전화번호</label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={formatPhone(phone)}
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 11))}
                  placeholder="010-1234-5678"
                  maxLength={13}
                  disabled={codeSent && remainSec > 0}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-[16px] focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:bg-gray-50 disabled:text-gray-400"
                />
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={sending || phone.length < 10}
                  className="px-4 py-3 rounded-xl bg-[#FACC15] text-[#333] text-[14px] font-bold whitespace-nowrap disabled:opacity-40 active:brightness-95 transition-all"
                >
                  {sending ? "발송중..." : codeSent ? "재발송" : "인증요청"}
                </button>
              </div>
            </div>

            {codeSent && (
              <div>
                <label className="text-[14px] font-semibold text-[#333] mb-1 block">인증번호</label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                    placeholder="6자리 입력"
                    maxLength={6}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-[16px] focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                  {remainSec > 0 && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] text-red-500 font-medium">
                      {formatTime(remainSec)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {error && (
              <p className="text-[14px] text-red-500">{error}</p>
            )}

            {codeSent && (
              <button
                type="button"
                onClick={handleVerify}
                disabled={verifying || code.length !== 6 || remainSec <= 0}
                className="w-full py-4 rounded-full bg-[#FACC15] text-[17px] font-bold text-[#333] active:brightness-95 transition-all disabled:opacity-40 mt-2"
              >
                {verifying ? "확인중..." : "인증완료"}
              </button>
            )}
          </div>
        </div>
      </div>

      {verified && (
        <>
          <div className="fixed inset-0 z-[400] bg-black/40" />
          <div className="fixed inset-0 z-[401] flex items-center justify-center">
            <div className="bg-white rounded-2xl mx-8 p-8 max-w-sm w-full text-center">
              <div className="flex justify-center mb-4">
                <div className="w-[60px] h-[60px] rounded-full bg-yellow-100 flex items-center justify-center">
                  <CheckCircle size={36} className="text-yellow-400" />
                </div>
              </div>
              <p className="text-[20px] font-bold text-[#333] mb-2">인증 완료!</p>
              <p className="text-[15px] text-gray-500 mb-6">본인인증이 완료되었습니다</p>
              <button
                type="button"
                onClick={onVerified}
                className="w-full py-4 rounded-full bg-[#FACC15] text-[17px] font-bold text-[#333] active:brightness-95 transition-all"
              >
                확인
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
