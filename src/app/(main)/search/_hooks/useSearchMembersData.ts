"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { REGIONS_WITH_ALL } from "@/lib/constants";
import { MEMBERS_CACHE_KEY, MEMBERS_PAGE_SIZE, SOLO_MEMBER_GENRES } from "../_lib/constants";
import { mergeMembersById, cacheUserSearchInfoFromMembers } from "../_lib/search-utils";
import type { DancerMember, Tab } from "../_types/search";

export function useSearchMembersData(activeTab: Tab) {
  const membersBootstrappedRef = useRef(false);
  const memberSearchPanelRef = useRef<HTMLDivElement | null>(null);
  const [members, setMembers] = useState<DancerMember[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersFullyLoaded, setMembersFullyLoaded] = useState(false);
  const [memberTotalCount, setMemberTotalCount] = useState(0);
  const [memberRegions, setMemberRegions] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberRegion, setMemberRegion] = useState("전체");
  const [memberGenres, setMemberGenres] = useState<string[]>([]);
  const [memberGender, setMemberGender] = useState<"" | "로" | "라">("");
  const [memberSearchMode, setMemberSearchMode] = useState<"basic" | "memberType">("memberType");
  const [selectedMemberTypes, setSelectedMemberTypes] = useState<string[]>([]);
  const [memberViewMode, setMemberViewMode] = useState<"list" | "grid">("grid");
  const [basicFilterLocked, setBasicFilterLocked] = useState(false);

  const availableMemberRegions = useMemo(() => {
    const regionSet = new Set<string>();
    REGIONS_WITH_ALL.forEach((region) => {
      if (region !== "전체") regionSet.add(region);
    });
    memberRegions.forEach((region) => {
      if (region) regionSet.add(region);
    });
    return ["전체", ...Array.from(regionSet)];
  }, [memberRegions]);

  const visibleMembers = members;

  const memberResultCount = memberTotalCount;

  const handleMemberSearchPanelScroll = useCallback(() => {
    const node = memberSearchPanelRef.current;
    if (!node) return;

    const nextMode = node.scrollLeft > node.clientWidth / 2 ? "memberType" : "basic";
    setMemberSearchMode((current) => {
      if (current === nextMode) return current;
      if (nextMode === "memberType" && !basicFilterLocked) {
        setMemberSearch("");
        setMemberRegion("전체");
        setMemberGenres([]);
        setMemberGender("");
      }
      if (nextMode === "basic") {
        setSelectedMemberTypes([]);
      }
      return nextMode;
    });
  }, [basicFilterLocked]);

  useEffect(() => {
    if (activeTab !== "members") return;

    const frame = window.requestAnimationFrame(() => {
      const node = memberSearchPanelRef.current;
      if (!node) return;

      node.scrollLeft = node.clientWidth;
      setMemberSearchMode("memberType");
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeTab]);

  const toggleMemberTypeFilter = useCallback((type: string) => {
    setSelectedMemberTypes((prev) => {
      if (prev.includes(type)) return prev.filter((item) => item !== type);
      return [type];
    });
  }, []);

  const toggleMemberGenre = useCallback((genre: string) => {
    setMemberGenres((prev) => {
      if (prev.includes(genre)) return prev.filter((item) => item !== genre);
      if (SOLO_MEMBER_GENRES.includes(genre)) return [genre];
      if (prev.some((item) => SOLO_MEMBER_GENRES.includes(item))) return [genre];
      if (prev.length >= 2) return prev;
      return [...prev, genre];
    });
  }, []);

  const writeMembersCache = useCallback(
    (nextMembers: DancerMember[], totalCount: number, availableRegions: string[], fullyLoaded: boolean) => {
      try {
        localStorage.setItem(
          MEMBERS_CACHE_KEY,
          JSON.stringify({
            members: nextMembers,
            totalCount,
            availableRegions,
            fullyLoaded,
            ts: Date.now(),
          })
        );
      } catch {}
    },
    []
  );

  const loadMembersFromCache = useCallback(() => {
    try {
      const cached = localStorage.getItem(MEMBERS_CACHE_KEY);
      if (!cached) return { count: 0, fullyLoaded: false, totalCount: 0 };
      const parsed = JSON.parse(cached);
      const cachedMembers = parsed?.members;
      if (!Array.isArray(cachedMembers)) return { count: 0, fullyLoaded: false, totalCount: 0 };

      const hasLegacyRow = cachedMembers.some(
        (member) =>
          !member ||
          typeof member !== "object" ||
          !Object.prototype.hasOwnProperty.call(member, "gender")
      );
      if (hasLegacyRow) {
        localStorage.removeItem(MEMBERS_CACHE_KEY);
        return { count: 0, fullyLoaded: false, totalCount: 0 };
      }

      const totalCount = typeof parsed.totalCount === "number" ? parsed.totalCount : cachedMembers.length;
      const availableRegions = Array.isArray(parsed.availableRegions) ? parsed.availableRegions : [];
      const fullyLoaded = !!parsed.fullyLoaded || cachedMembers.length >= totalCount;
      setMembers(cachedMembers);
      setMemberTotalCount(totalCount);
      setMemberRegions(availableRegions);
      setMembersFullyLoaded(fullyLoaded);
      setMembersLoaded(true);
      return { count: cachedMembers.length, fullyLoaded, totalCount };
    } catch {
      return { count: 0, fullyLoaded: false, totalCount: 0 };
    }
  }, []);

  function buildFilterParams(): string {
    const params = new URLSearchParams();
    if (memberRegion !== "전체") params.set("region", memberRegion);
    if (memberGender) params.set("gender", memberGender);
    if (memberSearch.trim()) params.set("search", memberSearch.trim());
    if (memberGenres.length > 0) params.set("genre", memberGenres.join(","));
    if (selectedMemberTypes.length > 0) params.set("memberType", selectedMemberTypes[0]);
    return params.toString();
  }

  const fetchMembersBatch = useCallback(
    async (offset: number, limit: number, append: boolean) => {
      if (offset === 0) setMembersLoading(true);

      try {
        const filterStr = buildFilterParams();
        const qs = `limit=${limit}&offset=${offset}${filterStr ? `&${filterStr}` : ""}`;
        const res = await fetch(`/api/users/members?${qs}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        const incoming = (json.data ?? []) as DancerMember[];
        const totalCount = typeof json.totalCount === "number" ? json.totalCount : incoming.length;
        const availableRegions = Array.isArray(json.availableRegions) ? json.availableRegions : [];
        const fullyLoaded = offset + incoming.length >= totalCount || incoming.length < limit;

        setMemberTotalCount(totalCount);
        setMemberRegions(availableRegions);
        setMembersFullyLoaded(fullyLoaded);
        setMembersLoaded(true);
        setMembers((prev) => {
          const nextMembers = append ? mergeMembersById(prev, incoming) : incoming;
          writeMembersCache(nextMembers, totalCount, availableRegions, fullyLoaded);
          cacheUserSearchInfoFromMembers(nextMembers);
          return nextMembers;
        });

        return { incomingCount: incoming.length, totalCount, fullyLoaded };
      } finally {
        if (offset === 0) setMembersLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [writeMembersCache, memberRegion, memberGender, memberSearch, memberGenres, selectedMemberTypes]
  );

  const fetchNextPage = useCallback(() => {
    if (membersFullyLoaded || membersLoading) return;
    fetchMembersBatch(members.length, MEMBERS_PAGE_SIZE, true).catch(() => {});
  }, [membersFullyLoaded, membersLoading, members.length, fetchMembersBatch]);

  const removeMemberFromMemberList = useCallback(
    (targetId: string) => {
      setMembers((prev) => {
        const nextMembers = prev.filter((member) => member.id !== targetId);
        const nextTotalCount = Math.max(0, memberTotalCount - 1);
        writeMembersCache(nextMembers, nextTotalCount, memberRegions, membersFullyLoaded);
        return nextMembers;
      });
      setMemberTotalCount((prev) => Math.max(0, prev - 1));
    },
    [memberRegions, memberTotalCount, membersFullyLoaded, writeMembersCache]
  );

  useEffect(() => {
    const shouldBootstrap = activeTab === "members" || activeTab === "finder";
    if (!shouldBootstrap || membersBootstrappedRef.current) return;
    membersBootstrappedRef.current = true;

    queueMicrotask(() => {
      const cached = loadMembersFromCache();
      if (cached.count > 0) return;

      fetchMembersBatch(0, MEMBERS_PAGE_SIZE, false).catch(() => {
        membersBootstrappedRef.current = false;
        if (activeTab === "members") {
          setMembersLoaded(true);
        }
      });
    });
  }, [activeTab, fetchMembersBatch, loadMembersFromCache]);

  const filterKeyRef = useRef("");
  useEffect(() => {
    const key = `${memberRegion}|${memberGender}|${memberSearch.trim()}|${memberGenres.join(",")}|${selectedMemberTypes.join(",")}`;
    if (filterKeyRef.current === key) return;
    if (filterKeyRef.current === "") {
      filterKeyRef.current = key;
      return;
    }
    filterKeyRef.current = key;

    const timer = window.setTimeout(() => {
      setMembers([]);
      setMembersFullyLoaded(false);
      setMemberTotalCount(0);
      fetchMembersBatch(0, MEMBERS_PAGE_SIZE, false).catch(() => {});
    }, 300);
    return () => window.clearTimeout(timer);
  }, [memberRegion, memberGender, memberSearch, memberGenres, selectedMemberTypes, fetchMembersBatch]);

  return {
    memberSearchPanelRef,
    members,
    setMembers,
    membersLoaded,
    membersLoading,
    membersFullyLoaded,
    memberTotalCount,
    memberRegions,
    memberSearch,
    setMemberSearch,
    memberRegion,
    setMemberRegion,
    memberGenres,
    memberGender,
    setMemberGender,
    memberSearchMode,
    selectedMemberTypes,
    memberViewMode,
    setMemberViewMode,
    availableMemberRegions,
    visibleMembers,
    memberResultCount,
    handleMemberSearchPanelScroll,
    toggleMemberGenre,
    toggleMemberTypeFilter,
    basicFilterLocked,
    setBasicFilterLocked,
    writeMembersCache,
    removeMemberFromMemberList,
    fetchNextPage,
  };
}
