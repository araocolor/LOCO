"use client";

import { useEffect } from "react";
import { parseBookmarkEntries } from "@/lib/bookmarks/local";

const BOOKMARKS_CACHE_KEY = "loco_bookmark_ids_v1";

function sendSyncBeacon() {
  const raw = localStorage.getItem(BOOKMARKS_CACHE_KEY);
  const bookmarks = parseBookmarkEntries(raw);
  if (bookmarks.length === 0) return;

  const body = JSON.stringify({ bookmarks });
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/bookmarks/sync", blob);
    return;
  }

  void fetch("/api/bookmarks/sync", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
  });
}

export default function BookmarkSyncOnExit() {
  useEffect(() => {
    function handlePageHide() {
      sendSyncBeacon();
    }

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  return null;
}
