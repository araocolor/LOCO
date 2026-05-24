"use client";

export type ChatDrawerTab = "all" | "members" | "class" | "archive";

interface ChatDrawerTabsProps {
  displayedActiveTab: ChatDrawerTab;
  isClassRoom: boolean;
  isDirectRoom: boolean;
  onTabChange: (tab: ChatDrawerTab) => void;
}

export default function ChatDrawerTabs({
  displayedActiveTab,
  isClassRoom,
  isDirectRoom,
  onTabChange,
}: ChatDrawerTabsProps) {
  return (
    <div className="shrink-0 flex items-end px-4 border-b border-[#e5e7eb]">
      <div className="flex gap-5">
        {!isDirectRoom && (
          <button
            type="button"
            onClick={() => onTabChange("class")}
            style={{ fontSize: 17 }}
            className={`pb-2 font-bold border-b-2 transition-colors ${
              displayedActiveTab === "class" ? "border-black text-black" : "border-transparent text-gray-400"
            }`}
          >
            공지/투표
          </button>
        )}
        <button
          type="button"
          onClick={() => onTabChange("all")}
          style={{ fontSize: 17 }}
          className={`pb-2 font-bold border-b-2 transition-colors ${
            displayedActiveTab === "all" ? "border-black text-black" : "border-transparent text-gray-400"
          }`}
        >
          {isDirectRoom ? "1:1 대화" : isClassRoom ? "클래스" : "전체대화"}
        </button>
        {!isDirectRoom && (
          <button
            type="button"
            onClick={() => onTabChange("members")}
            style={{ fontSize: 17 }}
            className={`pb-2 font-bold border-b-2 transition-colors ${
              displayedActiveTab === "members" ? "border-black text-black" : "border-transparent text-gray-400"
            }`}
          >
            참여회원들
          </button>
        )}
        <button
          type="button"
          onClick={() => onTabChange("archive")}
          style={{ fontSize: 17 }}
          className={`pb-2 font-bold border-b-2 transition-colors ${
            displayedActiveTab === "archive" ? "border-black text-black" : "border-transparent text-gray-400"
          }`}
        >
          보관함
        </button>
      </div>
    </div>
  );
}
