export type MainTabId = "home" | "messages" | "search" | "mypage";

const MAIN_TAB_CHANGE_EVENT = "main-tab-change";

export function getMainTab(): MainTabId {
  if (typeof window === "undefined") return "home";
  const tab = new URLSearchParams(window.location.search).get("tab");
  if (tab === "messages") return "messages";
  if (tab === "search") return "search";
  if (tab === "mypage") return "mypage";
  return "home";
}

export function subscribeMainTab(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener(MAIN_TAB_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener(MAIN_TAB_CHANGE_EVENT, onStoreChange);
  };
}

export function replaceMainTab(tab: MainTabId) {
  const url = new URL(window.location.href);
  if (tab === "home") {
    url.searchParams.delete("tab");
  } else {
    url.searchParams.set("tab", tab);
  }
  const qs = url.searchParams.toString();
  window.history.replaceState(
    { ...window.history.state, mainTab: tab },
    "",
    `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`
  );
  window.dispatchEvent(new Event(MAIN_TAB_CHANGE_EVENT));
}
