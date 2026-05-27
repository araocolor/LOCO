import type { Tab } from "../_types/search";
import { SEARCH_TAB_CHANGE_EVENT } from "./constants";

export function getSearchTab(): Tab {
  if (typeof window === "undefined") return "finder";
  const tab = new URLSearchParams(window.location.search).get("tab");
  if (tab === "friends") return "friends";
  if (tab === "members") return "members";
  if (tab === "followings") return "followings";
  if (tab === "pending") return "pending";
  if (tab === "finder") return "finder";
  return "finder";
}

export function subscribeSearchTab(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener(SEARCH_TAB_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener(SEARCH_TAB_CHANGE_EVENT, onStoreChange);
  };
}

export function replaceSearchTab(tab: Tab) {
  const url = new URL(window.location.href);
  url.searchParams.set("tab", tab);
  url.searchParams.delete("mode");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new Event(SEARCH_TAB_CHANGE_EVENT));
}

export function getInitialFriendListMode(): "following" | "friends" {
  if (typeof window === "undefined") return "following";
  const mode = new URLSearchParams(window.location.search).get("mode");
  if (mode === "friends") return "friends";
  return "following";
}
