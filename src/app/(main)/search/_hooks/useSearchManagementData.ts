"use client";

import { useCallback, useEffect, useState } from "react";
import { PENDING_CACHE_KEY } from "../_lib/constants";
import type { PendingMember, SocialListMode, Tab } from "../_types/search";

interface UseSearchManagementDataParams {
  activeTab: Tab;
  socialListMode: SocialListMode;
  refreshSocialLists: () => void;
}

export function useSearchManagementData({
  activeTab,
  socialListMode,
  refreshSocialLists,
}: UseSearchManagementDataParams) {
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [pendingLoaded, setPendingLoaded] = useState(false);
  const [hasBlacklistPin, setHasBlacklistPin] = useState<boolean | null>(null);
  const [isBlacklistUnlocked, setIsBlacklistUnlocked] = useState(false);
  const [blacklistPinInput, setBlacklistPinInput] = useState("");
  const [blacklistPinSubmitting, setBlacklistPinSubmitting] = useState(false);
  const [blacklistPinError, setBlacklistPinError] = useState("");
  const [blacklistPinFailCount, setBlacklistPinFailCount] = useState(0);
  const [removingPendingIds, setRemovingPendingIds] = useState<Set<string>>(new Set());

  const writePendingCache = useCallback((members: PendingMember[]) => {
    try {
      sessionStorage.setItem(PENDING_CACHE_KEY, JSON.stringify({ members, ts: Date.now() }));
    } catch {}
  }, []);

  const invalidatePendingCache = useCallback(() => {
    setPendingLoaded(false);
    try {
      sessionStorage.removeItem(PENDING_CACHE_KEY);
    } catch {}
  }, []);

  const fetchPendingMembers = useCallback(() => {
    fetch("/api/friends/pending")
      .then((r) => r.json())
      .then((json) => {
        const members = json.data ?? [];
        setPendingMembers(members);
        writePendingCache(members);
      })
      .catch(() => {})
      .finally(() => setPendingLoaded(true));
  }, [writePendingCache]);

  useEffect(() => {
    const shouldLoadPending =
      (activeTab === "pending" && isBlacklistUnlocked) ||
      (activeTab === "followings" && socialListMode === "management" && isBlacklistUnlocked);
    if (!shouldLoadPending || pendingLoaded) return;
    try {
      const cached = sessionStorage.getItem(PENDING_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        const members = parsed?.members;
        if (Array.isArray(members)) {
          queueMicrotask(() => {
            setPendingMembers(members);
            setPendingLoaded(true);
          });
          return;
        }
      }
    } catch {}
    fetchPendingMembers();
  }, [activeTab, isBlacklistUnlocked, pendingLoaded, fetchPendingMembers, socialListMode]);

  useEffect(() => {
    const isManagementGuardTab =
      activeTab === "pending" || (activeTab === "followings" && socialListMode === "management");

    if (!isManagementGuardTab) {
      queueMicrotask(() => {
        setIsBlacklistUnlocked(false);
        setBlacklistPinInput("");
        setBlacklistPinError("");
      });
      return;
    }

    if (hasBlacklistPin !== null) return;

    fetch("/api/friends/blacklist-pin")
      .then((r) => r.json())
      .then((json) => {
        setHasBlacklistPin(!!json.hasPin);
      })
      .catch(() => {
        setHasBlacklistPin(true);
      });
  }, [activeTab, hasBlacklistPin, socialListMode]);

  async function playPendingRemoveAnimation(targetId: string) {
    setRemovingPendingIds((prev) => {
      const next = new Set(prev);
      next.add(targetId);
      return next;
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  async function handleUnreportUser(targetId: string) {
    await playPendingRemoveAnimation(targetId);
    const prevPending = pendingMembers;
    const nextPending = pendingMembers.filter((member) => !(member.id === targetId && member.state === "black"));
    setPendingMembers(nextPending);
    writePendingCache(nextPending);
    setRemovingPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });

    try {
      const res = await fetch("/api/black-reports", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId }),
      });
      if (!res.ok) throw new Error();
      refreshSocialLists();
    } catch {
      setPendingMembers(prevPending);
      writePendingCache(prevPending);
      alert("블랙해제 처리 중 오류가 발생했습니다.");
    }
  }

  async function handleUnblockUser(targetId: string) {
    await playPendingRemoveAnimation(targetId);
    const prevPending = pendingMembers;
    const nextPending = pendingMembers.filter((member) => !(member.id === targetId && member.state === "blocked"));
    setPendingMembers(nextPending);
    writePendingCache(nextPending);
    setRemovingPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });

    try {
      const res = await fetch("/api/friends/block", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId }),
      });
      if (!res.ok) throw new Error();
      refreshSocialLists();
    } catch {
      setPendingMembers(prevPending);
      writePendingCache(prevPending);
      alert("차단해제 처리 중 오류가 발생했습니다.");
    }
  }

  async function handleUnhideFriendFromMenu(targetId: string) {
    try {
      const res = await fetch("/api/friends/hide", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId }),
      });

      if (!res.ok) throw new Error();

      setRemovingPendingIds((prev) => {
        const next = new Set(prev);
        next.add(targetId);
        return next;
      });
      setTimeout(() => {
        setRemovingPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
        setPendingMembers((prev) => {
          const next = prev.filter((member) => !(member.id === targetId && member.state === "hidden"));
          writePendingCache(next);
          return next;
        });
        refreshSocialLists();
        invalidatePendingCache();
      }, 1400);
    } catch {
      alert("숨김해제 처리 중 오류가 발생했습니다.");
    }
  }

  async function handleBlacklistPinSubmit() {
    if (blacklistPinSubmitting) return;
    const pin = blacklistPinInput.trim();

    if (!/^\d{4}$/.test(pin)) {
      setBlacklistPinError("숫자 4자리를 입력해 주세요.");
      return;
    }

    setBlacklistPinSubmitting(true);
    setBlacklistPinError("");

    try {
      if (hasBlacklistPin === false) {
        const res = await fetch("/api/friends/blacklist-pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        });

        if (!res.ok) {
          if (res.status === 409) {
            setHasBlacklistPin(true);
            setBlacklistPinError("이미 비밀번호가 설정되어 있어요. 비밀번호를 입력해 주세요.");
            return;
          }
          throw new Error();
        }
        setHasBlacklistPin(true);
        setIsBlacklistUnlocked(true);
        setBlacklistPinInput("");
        return;
      }

      const res = await fetch("/api/friends/blacklist-pin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          const nextFail = blacklistPinFailCount + 1;
          if (nextFail >= 5) {
            try {
              await fetch("/api/friends/blacklist-pin", { method: "DELETE" });
            } catch {}
            setHasBlacklistPin(false);
            setBlacklistPinFailCount(0);
            setBlacklistPinInput("");
            setBlacklistPinError("새 비밀번호 입력하세요 ㅋ");
            return;
          }
          setBlacklistPinFailCount(nextFail);
          setBlacklistPinError(`비밀번호가 맞지 않습니다. (${nextFail}/5)`);
          return;
        }
        if (res.status === 404) {
          setHasBlacklistPin(false);
          setBlacklistPinError("비밀번호를 먼저 설정해 주세요.");
          return;
        }
        throw new Error();
      }

      setIsBlacklistUnlocked(true);
      setBlacklistPinInput("");
      setBlacklistPinFailCount(0);
    } catch {
      setBlacklistPinError("처리 중 오류가 발생했습니다.");
    } finally {
      setBlacklistPinSubmitting(false);
    }
  }

  function handleBlacklistPinInputChange(value: string) {
    setBlacklistPinInput(value.replace(/\D/g, "").slice(0, 4));
    if (blacklistPinError) setBlacklistPinError("");
  }

  return {
    pendingMembers,
    removingPendingIds,
    hasBlacklistPin,
    isBlacklistUnlocked,
    blacklistPinInput,
    blacklistPinSubmitting,
    blacklistPinError,
    writePendingCache,
    invalidatePendingCache,
    handleBlacklistPinSubmit,
    handleBlacklistPinInputChange,
    handleUnhideFriendFromMenu,
    handleUnblockUser,
    handleUnreportUser,
  };
}
