import type { SocialListMode } from "../_types/search";

export const SEARCH_CACHE_KEY = "search_prefetch_cache";
export const MEMBERS_CACHE_KEY = "search_members_cache_v3";
export const PENDING_CACHE_KEY = "search_pending_members_cache_v2";
export const MYPAGE_CACHE_KEY = "loco_mypage_cache_local_v2";
export const SEARCH_TAB_CHANGE_EVENT = "loco-search-tab-change";
export const MEMBERS_PAGE_SIZE = 30;

export const SOCIAL_LIST_OPTIONS: { value: SocialListMode; label: string }[] = [
  { value: "mySubscribers", label: "구독자" },
  { value: "followers", label: "팔로워" },
  { value: "subscriptions", label: "내구독" },
  { value: "following", label: "팔로잉" },
  { value: "management", label: "회원관리" },
];

export const SOCIAL_LIST_ROWS: SocialListMode[][] = [
  ["subscriptions", "mySubscribers"],
  ["following", "followers", "management"],
];

export const MEMBER_GENRE_OPTIONS = [
  { value: "salsa", label: "살사" },
  { value: "bachata", label: "바차타" },
  { value: "kizomba", label: "키좀바" },
  { value: "other", label: "기타" },
] as const;

export const SOLO_MEMBER_GENRES = ["kizomba", "other"];
