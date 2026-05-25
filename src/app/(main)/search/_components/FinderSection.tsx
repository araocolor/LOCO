"use client";

import { useCallback, useState } from "react";
import { Bell, BellOff, RefreshCw } from "lucide-react";
import NearbyMap, { type NearbyRefreshControl } from "@/components/features/NearbyMap";

const FINDER_SOUND_ENABLED_KEY = "loco_finder_sound_enabled";

function readFinderSoundEnabled() {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(FINDER_SOUND_ENABLED_KEY);
    return raw === null ? true : raw === "true";
  } catch {
    return true;
  }
}

export default function FinderSection() {
  const [finderSoundEnabled, setFinderSoundEnabled] = useState(readFinderSoundEnabled);
  const [refreshControl, setRefreshControl] = useState<NearbyRefreshControl>({
    disabled: true,
    spinning: false,
    onRefresh: () => {},
  });

  const handleRefreshControlChange = useCallback((control: NearbyRefreshControl) => {
    setRefreshControl(control);
  }, []);

  function toggleFinderSound() {
    setFinderSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(FINDER_SOUND_ENABLED_KEY, String(next));
      } catch {}
      return next;
    });
  }

  return (
    <div className="bg-white">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <p className="text-base font-bold" style={{ color: "#333333" }}>검색범위</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleFinderSound}
            className={`p-1 transition-colors ${
              finderSoundEnabled ? "text-gray-800 hover:text-gray-900" : "text-gray-400 hover:text-gray-500"
            }`}
            aria-label={finderSoundEnabled ? "Finder 알림음 끄기" : "Finder 알림음 켜기"}
            aria-pressed={finderSoundEnabled}
          >
            {finderSoundEnabled ? <Bell size={17} /> : <BellOff size={17} />}
          </button>
          <button
            onClick={refreshControl.onRefresh}
            disabled={refreshControl.disabled}
            className={`p-1 ${refreshControl.disabled ? "text-gray-400 cursor-not-allowed" : "text-gray-800 hover:text-gray-900"}`}
            aria-label="내근처 새로고침"
          >
            <RefreshCw size={18} className={refreshControl.spinning ? "animate-spin" : ""} style={{ animationDuration: "0.8s" }} />
          </button>
        </div>
      </div>
      <NearbyMap soundEnabled={finderSoundEnabled} onRefreshControlChange={handleRefreshControlChange} />
    </div>
  );
}
