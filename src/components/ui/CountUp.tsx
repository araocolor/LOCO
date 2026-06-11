"use client";

import { useState, useEffect } from "react";

interface CountUpProps {
  value: number;
  duration?: number;
  animate?: boolean;
  className?: string;
  onAnimationEnd?: () => void;
}

export default function CountUp({ value, duration = 1500, animate = true, className, onAnimationEnd }: CountUpProps) {
  const [display, setDisplay] = useState<number | null>(animate ? null : value);

  useEffect(() => {
    if (!animate) {
      setDisplay(value);
      return;
    }

    const max = Math.max(value * 3, 30);
    const end = Date.now() + duration;

    const timer = setInterval(() => {
      if (Date.now() >= end) {
        setDisplay(value);
        clearInterval(timer);
        onAnimationEnd?.();
        return;
      }
      setDisplay(Math.floor(Math.random() * max));
    }, 50);

    return () => clearInterval(timer);
  }, [value, duration, animate]);

  return <span className={className}>{display ?? 0}</span>;
}
