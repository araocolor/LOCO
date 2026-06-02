"use client";

import { useState, useEffect, useRef } from "react";

const STEPS = [
  { text: "사진을 분석하고 있어요...", duration: 5000 },
  { text: "포스터를 구성하고 있어요...", duration: 10000 },
  { text: "마무리하고 있어요...", duration: Infinity },
];

const CHAR_DELAY = 60;

interface Props {
  active: boolean;
}

export default function TypingLoader({ active }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      setCharIndex(0);
      setFadingOut(false);
      return;
    }

    const step = STEPS[stepIndex];
    if (!step) return;

    if (charIndex < step.text.length) {
      timerRef.current = setTimeout(() => setCharIndex((c) => c + 1), CHAR_DELAY);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }

    if (step.duration === Infinity) return;

    const remaining = step.duration - step.text.length * CHAR_DELAY;
    const waitMs = Math.max(remaining, 500);

    timerRef.current = setTimeout(() => {
      setFadingOut(true);
      setTimeout(() => {
        setStepIndex((s) => s + 1);
        setCharIndex(0);
        setFadingOut(false);
      }, 400);
    }, waitMs);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [active, stepIndex, charIndex]);

  if (!active) return null;

  const step = STEPS[stepIndex];
  if (!step) return null;

  const displayed = step.text.slice(0, charIndex);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-6 px-6">
        <div className="flex items-center gap-1">
          <span
            className={`text-lg font-bold text-[#111111] transition-opacity duration-400 ${fadingOut ? "opacity-0" : "opacity-100"}`}
          >
            {displayed}
          </span>
          <span className="inline-block w-[2px] h-5 bg-[#111111] animate-blink" />
        </div>

        <div className="flex items-center gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === stepIndex
                  ? "w-8 bg-[#111111]"
                  : i < stepIndex
                    ? "w-4 bg-[#111111]"
                    : "w-4 bg-[#d4d4d4]"
              }`}
            />
          ))}
        </div>

        <p className="text-sm text-[#999999]">
          {stepIndex + 1} / {STEPS.length} 단계
        </p>
      </div>
    </div>
  );
}
