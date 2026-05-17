"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { REGIONS_WITH_ALL } from "@/lib/constants";
import { MEMBERS_CACHE_KEY, MEMBERS_PAGE_SIZE, SOLO_MEMBER_GENRES } from "../_lib/constants";
import { mergeMembersById } from "../_lib/search-utils";
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
  const [memberSearchMode, setMemberSearchMode] = useState<"basic" | "memberType">("basic");
  const [selectedMemberTypes, setSelectedMemberTypes] = useState<string[]>([]);
  const [memberViewMode, setMemberViewMode] = useState<"list" | "grid">("grid");

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

  const visibleMembers = useMemo(() => {
    if (memberSearchMode === "memberType") {
      if (selectedMemberTypes.length === 0) return members;

      return members.filter((member) =>
        selectedMemberTypes.some((type) => member.member_type?.includes(type))
      );
    }

    const search = memberSearch.trim().toLowerCase();

    return members.filter((member) => {
      const matchesSearch = search === "" || member.nickname.toLowerCase().includes(search);
      const matchesRegion = memberRegion === "전체" || member.region === memberRegion;
      const selectedSalsaBachata = memberGenres.filter((genre) => genre === "salsa" || genre === "bachata");
      const memberSalsaBachata = (member.favorite_genre ?? []).filter((genre) => genre === "salsa" || genre === "bachata");
      const matchesGenre =
        memberGenres.length === 0 ||
        (memberGenres.includes("kizomba") && member.favorite_genre?.includes("kizomba")) ||
        (selectedSalsaBachata.length > 0 &&
          selectedSalsaBachata.length === memberSalsaBachata.length &&
          selectedSalsaBachata.every((genre) => memberSalsaBachata.includes(genre)));
      const matchesGender = memberGender === "" || member.gender === memberGender;
      return matchesSearch && matchesRegion && matchesGenre && matchesGender;
    });
  }, [members, memberSearch, memberRegion, memberGenres, memberGender, memberSearchMode, selectedMemberTypes]);

  const hasMemberFilter = useMemo(() => {
    if (memberSearchMode === "memberType") return selectedMemberTypes.length > 0;

    return (
      memberSearch.trim() !== "" ||
      memberRegion !== "전체" ||
      memberGenres.length > 0 ||
      memberGender !== ""
    );
  }, [memberSearch, memberRegion, memberGenres, memberGender, memberSearchMode, selectedMemberTypes]);

  const memberResultCount = hasMemberFilter ? visibleMembers.length : Math.max(memberTotalCount, visibleMembers.length);

  const handleMemberSearchPanelScroll = useCallback(() => {
    const node = memberSearchPanelRef.current;
    if (!node) return;

    const nextMode = node.scrollLeft > node.clientWidth / 2 ? "memberType" : "basic";
    setMemberSearchMode((current) => (current === nextMode ? current : nextMode));
  }, []);

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

  const fetchMembersBatch = useCallback(
    async (offset: number, limit: number, append: boolean) => {
      if (offset === 0) setMembersLoading(true);

      try {
        const res = await fetch(`/api/users/members?limit=${limit}&offset=${offset}`);
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
          return nextMembers;
        });

        return { incomingCount: incoming.length, totalCount, fullyLoaded };
      } finally {
        if (offset === 0) setMembersLoading(false);
      }
    },
    [writeMembersCache]
  );

  const fetchRemainingMembers = useCallback(
    (startOffset: number, totalCount: number) => {
      const run = async () => {
        let offset = startOffset;
        let expectedTotal = totalCount;

        while (offset < expectedTotal) {
          const result = await fetchMembersBatch(offset, 100, true);
          if (result.incomingCount === 0 || result.fullyLoaded) break;
          offset += result.incomingCount;
          expectedTotal = result.totalCount;
          await new Promise((resolve) => window.setTimeout(resolve, 250));
        }
      };

      run().catch(() => {});
    },
    [fetchMembersBatch]
  );

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
    const shouldBootstrap = activeTab === "members" || activeTab === "friends";
    if (!shouldBootstrap || membersBootstrappedRef.current) return;
    membersBootstrappedRef.current = true;

    queueMicrotask(() => {
      const cached = loadMembersFromCache();
      if (cached.count > 0) {
        if (!cached.fullyLoaded) {
          fetchMembersBatch(cached.count, MEMBERS_PAGE_SIZE, true)
            .then((result) => {
              const nextOffset = cached.count + result.incomingCount;
              if (!result.fullyLoaded && nextOffset < result.totalCount) {
                fetchRemainingMembers(nextOffset, result.totalCount);
              }
            })
            .catch(() => {});
        }
        return;
      }

      fetchMembersBatch(0, MEMBERS_PAGE_SIZE, false)
        .then((firstResult) => {
          if (firstResult.incomingCount === 0 || firstResult.fullyLoaded) return;
          return fetchMembersBatch(firstResult.incomingCount, MEMBERS_PAGE_SIZE, true).then((secondResult) => {
            const nextOffset = firstResult.incomingCount + secondResult.incomingCount;
            if (!secondResult.fullyLoaded && nextOffset < secondResult.totalCount) {
              fetchRemainingMembers(nextOffset, secondResult.totalCount);
            }
          });
        })
        .catch(() => {
          membersBootstrappedRef.current = false;
          if (activeTab === "members") {
            setMembersLoaded(true);
          }
        });
    });
  }, [activeTab, fetchMembersBatch, fetchRemainingMembers, loadMembersFromCache]);

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
    writeMembersCache,
    removeMemberFromMemberList,
  };
}
