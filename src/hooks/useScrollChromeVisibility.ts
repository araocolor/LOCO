"use client";

import { useEffect, useRef, useState } from "react";

const SHOW_ON_UP_SCROLL_SPEED = 1.5;

export function useScrollChromeVisibility(enabled = true) {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const lastTimeRef = useRef(0);
  const tickingRef = useRef(false);

  useEffect(() => {
    const resetFrame = window.requestAnimationFrame(() => setIsVisible(true));

    if (!enabled) {
      return () => window.cancelAnimationFrame(resetFrame);
    }

    lastScrollYRef.current = window.scrollY;
    lastTimeRef.current = performance.now();

    function updateVisibility() {
      const currentScrollY = window.scrollY;
      const currentTime = performance.now();
      const delta = currentScrollY - lastScrollYRef.current;
      const elapsedMs = Math.max(1, currentTime - lastTimeRef.current);
      const speed = Math.abs(delta) / elapsedMs;

      if (currentScrollY <= 12) {
        setIsVisible(true);
      } else if (delta > 6) {
        setIsVisible(false);
      } else if (delta < -8 && speed >= SHOW_ON_UP_SCROLL_SPEED) {
        setIsVisible(true);
      }

      lastScrollYRef.current = currentScrollY;
      lastTimeRef.current = currentTime;
      tickingRef.current = false;
    }

    function handleScroll() {
      if (tickingRef.current) return;
      tickingRef.current = true;
      window.requestAnimationFrame(updateVisibility);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(resetFrame);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [enabled]);

  return enabled ? isVisible : true;
}
