"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Ban,
  BadgeCheck,
  Bookmark,
  ChevronRight,
  FileText,
  HelpCircle,
  Languages,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  Eye,
  UserCircle,
  X,
} from "lucide-react";
import { RiVerifiedBadgeFill } from "react-icons/ri";
import { createClient } from "@/lib/supabase/client";
import type { ReactNode } from "react";

type SubItem = { label: string };

type SelectGroup = { group: string; values: string[] };

type MenuItemDef = {
  id: string;
  icon: ReactNode | null;
  label: string;
  subItems: SubItem[];
  selectOptions?: SelectGroup[];
  infoLines?: string[];
  actionLabel?: string;
  emptyText?: string;
  blacklistGrid?: boolean;
  danger?: boolean;
  subtle?: boolean;
  noAccordion?: boolean;
};

type SectionDef = {
  title?: string;
  items: MenuItemDef[];
};

type MyPageTab = "all" | "my" | "bookmark";

const MY_PAGE_TABS: Array<{ key: MyPageTab; label: string }> = [
  { key: "all", label: "프로필" },
  { key: "my", label: "내클래스" },
  { key: "bookmark", label: "북마크" },
];

const SECTIONS: SectionDef[] = [
  {
    title: "클래스 공개범위 설정",
    items: [
      {
        id: "class-privacy",
        icon: <SlidersHorizontal size={18} />,
        label: "업로드 클래스",
        subItems: [{ label: "전체공개" }, { label: "친구공개" }, { label: "비공개" }],
      },
      {
        id: "bookmark",
        icon: <Bookmark size={18} />,
        label: "북마크 클래스",
        subItems: [{ label: "전체공개" }, { label: "친구공유" }, { label: "비공개" }],
      },
    ],
  },
  {
    title: "내 프로필 공개범위 설정",
    items: [
      {
        id: "profile-privacy",
        icon: <Eye size={18} />,
        label: "내 프로필 공개",
        subItems: [{ label: "모든사람" }, { label: "내 친구" }, { label: "비공개" }],
      },
      {
        id: "profile-badge",
        icon: <BadgeCheck size={18} />,
        label: "프로필 인증마크",
        subItems: [],
        infoLines: [
          "앱 서비스 기능사용 권한과 추가 기능이 부여됩니다.",
          "동호회, 아카데미, 행사 대표자 및 운영자를 인증합니다.",
        ],
        actionLabel: "프로필 배지 신청",
      },
    ],
  },
  {
    title: "메세지 공개범위 설정 / 블랙",
    items: [
      {
        id: "message-privacy",
        icon: <MessageCircle size={18} />,
        label: "메시지 설정",
        subItems: [{ label: "모든사람" }, { label: "친구끼리" }, { label: "비공개" }],
      },
      {
        id: "tag-privacy",
        icon: <Tag size={18} />,
        label: "친구 표시",
        subItems: [{ label: "모든사람" }, { label: "비공개" }],
      },
      {
        id: "blacklist",
        icon: <Ban size={18} />,
        label: "블랙목록",
        subItems: [],
        blacklistGrid: true,
      },
    ],
  },
  {
    title: "개인정보 및 도움말",
    items: [
      {
        id: "help",
        icon: <HelpCircle size={18} />,
        label: "도움말",
        noAccordion: true,
        subItems: [],
      },
      {
        id: "privacy-center",
        icon: <ShieldCheck size={18} />,
        label: "개인정보보호센터",
        noAccordion: true,
        subItems: [],
      },
      {
        id: "terms",
        icon: <FileText size={18} />,
        label: "이용 약관",
        noAccordion: true,
        subItems: [],
      },
    ],
  },
  {
    title: "국가 및 언어",
    items: [
      {
        id: "logout",
        icon: <LogOut size={18} />,
        label: "로그아웃",
        subItems: [],
        noAccordion: true,
      },
      {
        id: "language",
        icon: <Languages size={18} />,
        label: "표시언어",
        subItems: [{ label: "샘플 1" }],
        selectOptions: [
          {
            group: "",
            values: ["한국어", "English", "Español", "Français", "Italiano", "Deutsch", "Português", "中文", "日本語", "Tiếng Việt", "ภาษาไทย", "हिंदी"],
          },
        ],
      },
      {
        id: "location",
        icon: <MapPin size={18} />,
        label: "국가",
        subItems: [{ label: "샘플 1" }],
        selectOptions: [
          {
            group: "유럽",
            values: ["스페인", "프랑스", "이탈리아", "영국", "독일", "네덜란드", "벨기에", "포르투갈", "스위스", "오스트리아", "폴란드", "체코", "헝가리", "루마니아", "불가리아", "그리스", "세르비아", "크로아티아", "스웨덴", "노르웨이"],
          },
          {
            group: "아시아",
            values: ["한국", "일본", "중국", "대만", "홍콩", "싱가포르", "태국", "베트남", "필리핀", "인도"],
          },
          {
            group: "아메리카 대륙",
            values: ["미국", "캐나다", "멕시코", "쿠바", "도미니카공화국", "푸에르토리코", "콜롬비아", "페루", "브라질", "아르헨티나"],
          },
        ],
      },
    ],
  },
];

export default function MyPageHeader() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = (searchParams.get("section") as MyPageTab | null) ?? "all";
  const [open, setOpen] = useState(false);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    "bookmark-0": true,
    "myclasses-0": true,
    "class-privacy-0": true,
    "profile-privacy-0": true,
    "message-privacy-0": true,
    "tag-privacy-0": true,
  });
  const [selections, setSelections] = useState<Record<string, string>>({});

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function handleItemClick(id: string, noAccordion?: boolean) {
    if (noAccordion) return;
    setOpenIds((prev) => {
      if (prev.has(id)) return new Set<string>();
      return new Set<string>([id]);
    });
  }

  function handleToggle(key: string) {
    setToggles((prev) => {
      if (prev[key]) return prev;
      const itemId = key.split("-").slice(0, -1).join("-");
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (k.startsWith(itemId + "-")) next[k] = false;
      });
      next[key] = true;
      return next;
    });
  }

  async function handleLogout() {
    localStorage.clear();
    sessionStorage.clear();
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <>
      <header className="sticky top-0 z-50 bg-white border-b border-[#e5e7eb]">
        <div className="h-14 px-4 relative flex items-center">
          <button type="button" onClick={() => setOpen(true)} className="p-1 -mr-1 ml-auto">
            <Menu className="w-6 h-6 text-gray-700" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 font-bold text-xl text-[#4d4d4d] leading-none">
            XLATIN
          </div>
        </div>
        <div className="flex pl-4 pr-4 gap-5 pb-0 overflow-x-auto scrollbar-hide whitespace-nowrap">
          {MY_PAGE_TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => router.push(key === "all" ? "/?tab=mypage" : `/?tab=mypage&section=${key}`)}
              className={`pb-2 font-bold transition-colors ${currentTab === key ? "text-black" : "text-gray-400"}`}
              style={{ fontSize: currentTab === key ? 18 : 17 }}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* 배경 오버레이 */}
      <div
        className={`fixed inset-0 z-[150] bg-black/40 transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpen(false)}
      />

      {/* 슬라이드 시트 */}
      <div
        className={`fixed top-0 left-0 h-full w-full bg-white z-[200] flex flex-col transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* 시트 헤더 - 고정 */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 h-14 border-b border-gray-100">
          <span className="text-[20px] font-bold text-[#333333]">설정</span>
          <button type="button" onClick={() => setOpen(false)}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 섹션 목록 - 스크롤 */}
        <div className="flex-1 overflow-y-auto">
        {SECTIONS.map((section) => (
          <div key={section.title ?? "default"} className="border-t border-gray-100">
            {section.title && (
              <p className="h-2 overflow-hidden px-5 text-[0px] leading-none text-white">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const isOpen = openIds.has(item.id);
              return (
                <div key={item.id}>
                  <button
                    type="button"
                    className={`flex items-center gap-3 w-full px-5 text-left transition-colors duration-200 active:bg-gray-100 ${
                      item.id === "logout" ? "py-4" : "py-2.5"
                    } ${isOpen ? "bg-gray-50" : "hover:bg-gray-50"}`}
                    onClick={() => {
                      if (item.id === "logout") {
                        handleLogout();
                      } else {
                        handleItemClick(item.id, item.noAccordion);
                      }
                    }}
                  >
                    {item.icon && (
                      <span className={item.subtle ? "text-white" : item.danger ? "text-red-500" : "text-gray-400"}>
                        {item.icon}
                      </span>
                    )}
                    <span
                      className={`${item.subtle ? "" : "flex-1"} ${
                        item.subtle
                          ? "text-[14px] text-white"
                          : item.danger
                          ? "text-[17px] text-red-500"
                          : "text-[17px] text-[#333333]"
                      } ${isOpen ? "font-bold" : ""}`}
                    >
                      {item.label}
                    </span>
                    {!item.noAccordion && (
                      <ChevronRight
                        size={16}
                        className={`text-gray-300 shrink-0 transition-transform duration-200 ${
                          isOpen ? "rotate-90" : ""
                        }`}
                      />
                    )}
                  </button>

                  {/* 아코디언 서브 항목 */}
                  {isOpen && (
                    <div className="bg-gray-50 border-t border-gray-100 pl-[50px] pr-5 py-1.5">
                      {item.blacklistGrid ? (
                        <div className="grid grid-cols-6 gap-2 py-1">
                          {[0, 1, 2].map((i) => (
                            <div
                              key={i}
                              className="flex flex-col items-center gap-1"
                            >
                              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <UserCircle size={28} className="text-gray-400" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : item.emptyText ? (
                        <p className="text-[14px] text-gray-400 py-1">{item.emptyText}</p>
                      ) : item.infoLines ? (
                        <div className="space-y-1.5">
                          {item.infoLines.map((line) => (
                            <p key={line} className="text-[14px] text-gray-500 leading-snug">{line}</p>
                          ))}
                          {item.actionLabel && (
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                className="rounded-xl bg-[#FEE500] px-5 py-2 text-[14px] font-bold text-[#191919]"
                              >
                                {item.actionLabel}
                              </button>
                              <RiVerifiedBadgeFill size={34} color="#1D9BF0" />
                            </div>
                          )}
                        </div>
                      ) : item.selectOptions ? (
                        <select
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[15px] text-[#333333] focus:outline-none"
                          value={selections[item.id] ?? ""}
                          onChange={(e) =>
                            setSelections((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                        >
                          <option value="" disabled>선택해주세요</option>
                          {item.selectOptions.map((group) =>
                            group.group ? (
                              <optgroup key={group.group} label={group.group}>
                                {group.values.map((v) => (
                                  <option key={v} value={v}>{v}</option>
                                ))}
                              </optgroup>
                            ) : (
                              group.values.map((v) => (
                                <option key={v} value={v}>{v}</option>
                              ))
                            )
                          )}
                        </select>
                      ) : (
                        item.subItems.map((sub, idx) => {
                          const key = `${item.id}-${idx}`;
                          const checked = toggles[key] ?? false;
                          return (
                            <div
                              key={key}
                              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
                            >
                              <span className="text-[15px] text-[#333333]">{sub.label}</span>
                              <IosToggle
                                checked={checked}
                                onChange={() => handleToggle(key)}
                              />
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        </div>
      </div>
    </>
  );
}

function IosToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-[22px] w-[36px] shrink-0 rounded-full transition-colors duration-200 focus:outline-none ${
        checked ? "bg-[#34C759]" : "bg-[#E5E5EA]"
      }`}
    >
      <span
        className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow-md transition-transform duration-200 mt-[2px] ${
          checked ? "translate-x-[16px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}
