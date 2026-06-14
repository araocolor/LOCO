"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  BadgeCheck,
  Bell,
  BellRing,
  Bookmark,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Eye,
  FileText,
  Heart,
  Lock,
  MapPin,
  MessageCircle,
  Monitor,
  Search,
  Settings,
  Shield,
  Users,
  UserCircle,
  Volume2,
  X,
} from "lucide-react";
import { RiVerifiedBadgeFill } from "react-icons/ri";
import { createClient } from "@/lib/supabase/client";
import LegalDrawer from "@/components/legal/LegalDrawer";
import RefundPolicyContent from "@/components/legal/RefundPolicyContent";
import PrivacyPolicyContent from "@/components/legal/PrivacyPolicyContent";
import TermsOfServiceContent from "@/components/legal/TermsOfServiceContent";

type MyPageTab = "all";

interface SettingsProfile {
  nickname: string;
  email: string | null;
  profile_image_url: string | null;
}

function useSettingsProfile(): SettingsProfile | null {
  const [profile, setProfile] = useState<SettingsProfile | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("loco_mypage_cache_local_v3");
      if (raw) {
        const parsed = JSON.parse(raw);
        const p = parsed?.profile;
        if (p?.nickname) {
          setProfile({
            nickname: p.nickname,
            email: p.email ?? null,
            profile_image_url: p.profile_image_url ?? null,
          });
        }
      }
    } catch {}
  }, []);

  return profile;
}

export default function MyPageHeader() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = (searchParams.get("section") as MyPageTab | null) ?? "all";
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const settingsProfile = useSettingsProfile();

  const [toggles, setToggles] = useState<Record<string, boolean>>({
    sound: true,
    push: true,
    friendAlert: true,
    locationConsent: true,
    // 알림설정 탭
    chatAllSound: true,
    chatBadge: true,
    chatDm: true,
    chatGroup: true,
    chatClass: true,
    newsAllSound: true,
    newsBadge: true,
    newsClass: true,
    newsComment: true,
    newsLike: true,
    newsReply: true,
    newsPayment: true,
  });

  const [classPrivacy, setClassPrivacy] = useState("public");
  const [messagePrivacy, setMessagePrivacy] = useState("public");
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [firstScreen, setFirstScreen] = useState("search");

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const chatSubKeys = ["chatDm", "chatGroup", "chatClass"];
  const newsSubKeys = ["newsClass", "newsComment", "newsLike", "newsReply"];

  function handleToggle(key: string) {
    if (key === "newsPayment") return;
    setToggles((prev) => {
      const next = { ...prev, [key]: !prev[key] };

      if (key === "chatAllSound") {
        const val = next.chatAllSound;
        chatSubKeys.forEach((k) => { next[k] = val; });
      } else if (chatSubKeys.includes(key)) {
        const allOn = chatSubKeys.every((k) => next[k]);
        next.chatAllSound = allOn;
      }

      if (key === "newsAllSound") {
        const val = next.newsAllSound;
        newsSubKeys.forEach((k) => { next[k] = val; });
      } else if (newsSubKeys.includes(key)) {
        const allOn = newsSubKeys.every((k) => next[k]);
        next.newsAllSound = allOn;
      }

      return next;
    });
  }

  function toggleExpand(id: string) {
    setExpandedCard((prev) => (prev === id ? null : id));
  }

  return (
    <>
      <header className="sticky top-0 z-50 bg-white border-b border-[#e5e7eb]">
        <div className="relative h-14 px-4 flex items-center">
          <div className="font-black text-[22px] text-[#4d4d4d] leading-none">
            프로필
          </div>
          <button type="button" onClick={() => { setOpen(true); scrollRef.current?.scrollTo(0, 0); }} className="ml-auto h-12 w-12 -mr-2 flex items-center justify-center text-gray-700">
            <Settings size={22} strokeWidth={2.2} />
          </button>
        </div>
        <div className="flex pl-4 pr-4 gap-2 pb-2">
          <button
            type="button"
            onClick={() => router.push("/?tab=mypage")}
            className="px-3.5 py-1.5 rounded-full text-[15px] font-semibold bg-black text-white"
          >
            프로필
          </button>
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
        className={`fixed top-0 left-0 h-full w-full bg-[#f2f2f7] z-[200] flex flex-col transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {/* 닫기 버튼 */}
        <div className="flex-shrink-0 flex justify-end px-4 pt-3">
          <button type="button" onClick={() => setOpen(false)}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 콘텐츠 영역 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <GeneralSettings
            profile={settingsProfile}
            toggles={toggles}
            onToggle={handleToggle}
            classPrivacy={classPrivacy}
            onClassPrivacy={setClassPrivacy}
            messagePrivacy={messagePrivacy}
            onMessagePrivacy={setMessagePrivacy}
            expandedCard={expandedCard}
            onToggleExpand={toggleExpand}
            firstScreen={firstScreen}
            onFirstScreen={setFirstScreen}
          />
        </div>
      </div>

      <LegalDrawer open={refundOpen} onClose={() => setRefundOpen(false)} title="환불정책">
        <RefundPolicyContent />
      </LegalDrawer>

      <LegalDrawer open={privacyOpen} onClose={() => setPrivacyOpen(false)} title="개인정보처리방침">
        <PrivacyPolicyContent />
      </LegalDrawer>

      <LegalDrawer open={termsOpen} onClose={() => setTermsOpen(false)} title="서비스 이용약관">
        <TermsOfServiceContent />
      </LegalDrawer>
    </>
  );
}

/* ── 일반설정 탭 ── */

function GeneralSettings({
  profile,
  toggles,
  onToggle,
  classPrivacy,
  onClassPrivacy,
  messagePrivacy,
  onMessagePrivacy,
  expandedCard,
  onToggleExpand,
  firstScreen,
  onFirstScreen,
}: {
  profile: SettingsProfile | null;
  toggles: Record<string, boolean>;
  onToggle: (key: string) => void;
  classPrivacy: string;
  onClassPrivacy: (v: string) => void;
  messagePrivacy: string;
  onMessagePrivacy: (v: string) => void;
  expandedCard: string | null;
  onToggleExpand: (id: string) => void;
  firstScreen: string;
  onFirstScreen: (v: string) => void;
}) {
  return (
    <div className="px-4 pb-10">
      {/* 설정 제목 */}
      <p className="text-[28px] font-bold text-[#333] pt-2 pb-3">설정</p>
      <div className="bg-white rounded-xl overflow-hidden">

        <button type="button" className="flex items-center w-full px-4 py-3 active:bg-gray-50">
          <div className="w-[60px] h-[60px] rounded-full overflow-hidden flex-shrink-0 bg-gray-100">
            {profile?.profile_image_url ? (
              <Image
                src={profile.profile_image_url}
                alt="프로필"
                width={60}
                height={60}
                className="w-[60px] h-[60px] object-cover"
                unoptimized
              />
            ) : (
              <UserCircle size={60} className="text-gray-300" />
            )}
          </div>
          <div className="ml-3 flex-1 text-left">
            <p className="text-[17px] font-bold text-[#333]">{profile?.nickname ?? "사용자"}</p>
            <p className="text-[13px] text-gray-400">{profile?.email ?? ""}</p>
          </div>
          <ChevronRight size={18} className="text-gray-300" />
        </button>
        <div className="h-[1px] bg-gray-100 mx-4" />
        <button type="button" className="flex items-center w-full px-4 py-3.5 active:bg-gray-50">
          <span className="ml-[52px] flex items-center gap-1 flex-1 text-[15px] text-[#333]">
            <RiVerifiedBadgeFill size={22} color="#1D9BF0" className="shrink-0" />
            프로필 인증신청
          </span>
          <ChevronRight size={18} className="text-gray-300" />
        </button>
      </div>

      {/* 2. 일반 */}
      <div className="pt-6" />
      <div className="bg-white rounded-xl overflow-hidden">
        <SettingsRow
          icon={<Volume2 size={20} />}
          label="전체소리설정"
          right={<IosToggle checked={toggles.sound} onChange={() => onToggle("sound")} />}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsRow
          icon={<BellRing size={20} />}
          label="알림 푸시"
          right={<IosToggle checked={toggles.push} onChange={() => onToggle("push")} />}
        />
      </div>

      {/* 채팅알림 */}
      <div className="pt-6" />
      <div className="bg-white rounded-xl overflow-hidden">
        <SettingsRow
          icon={<MessageCircle size={20} />}
          label="채팅알림"
          right={<IosToggle checked={toggles.chatAllSound} onChange={() => onToggle("chatAllSound")} />}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsRow
          icon={<Users size={20} />}
          label="1:1대화"
          right={<IosToggle checked={toggles.chatDm} onChange={() => onToggle("chatDm")} />}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsRow
          icon={<Users size={20} />}
          label="그룹"
          right={<IosToggle checked={toggles.chatGroup} onChange={() => onToggle("chatGroup")} />}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsRow
          icon={<Bookmark size={20} />}
          label="클래스"
          right={<IosToggle checked={toggles.chatClass} onChange={() => onToggle("chatClass")} />}
        />
      </div>

      {/* 소식알림 */}
      <div className="pt-6" />
      <div className="bg-white rounded-xl overflow-hidden">
        <SettingsRow
          icon={<Bell size={20} />}
          label="전체소식알림"
          right={<IosToggle checked={toggles.newsAllSound} onChange={() => onToggle("newsAllSound")} />}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsRow
          icon={<FileText size={20} />}
          label="수업신청"
          right={<IosToggle checked={toggles.newsClass} onChange={() => onToggle("newsClass")} />}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsRow
          icon={<MessageCircle size={20} />}
          label="댓글알림"
          right={<IosToggle checked={toggles.newsComment} onChange={() => onToggle("newsComment")} />}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsRow
          icon={<Heart size={20} />}
          label="좋아요알림"
          right={<IosToggle checked={toggles.newsLike} onChange={() => onToggle("newsLike")} />}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <div className="opacity-50">
          <SettingsRow
            icon={<CreditCard size={20} />}
            label="결제알림"
            right={<IosToggle checked={true} onChange={() => {}} />}
          />
        </div>
      </div>

      {/* 클래스 설정 */}
      <div className="pt-6" />
      <div className="bg-white rounded-xl overflow-hidden">
        <SettingsRow
          icon={<Eye size={20} />}
          label="클래스전체공개"
          right={<IosToggle checked={classPrivacy === "public"} onChange={() => onClassPrivacy("public")} />}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsRow
          icon={<Users size={20} />}
          label="친구허용"
          right={<IosToggle checked={classPrivacy === "friends"} onChange={() => onClassPrivacy("friends")} />}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsRow
          icon={<Lock size={20} />}
          label="전체비공개"
          right={<IosToggle checked={classPrivacy === "private"} onChange={() => onClassPrivacy("private")} />}
        />
      </div>

      {/* 메세지 설정 */}
      <div className="pt-6" />
      <div className="bg-white rounded-xl overflow-hidden">
        <SettingsRow
          icon={<Eye size={20} />}
          label="메세지전체수신"
          right={<IosToggle checked={messagePrivacy === "public"} onChange={() => onMessagePrivacy("public")} />}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsRow
          icon={<Users size={20} />}
          label="친구허용"
          right={<IosToggle checked={messagePrivacy === "friends"} onChange={() => onMessagePrivacy("friends")} />}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsRow
          icon={<Lock size={20} />}
          label="비공개"
          right={<IosToggle checked={messagePrivacy === "private"} onChange={() => onMessagePrivacy("private")} />}
        />
      </div>

      {/* 회원찾기 */}
      <div className="pt-6" />
      <div className="bg-white rounded-xl overflow-hidden">
        <SettingsRow
          icon={<Heart size={20} />}
          label="이근처친구알림"
          right={<IosToggle checked={toggles.friendAlert} onChange={() => onToggle("friendAlert")} />}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsRow
          icon={<MapPin size={20} />}
          label="위치정보동의"
          right={<IosToggle checked={toggles.locationConsent} onChange={() => onToggle("locationConsent")} />}
        />
      </div>
    </div>
  );
}

/* ── 공통 컴포넌트 ── */

function CardTitle({ title }: { title: string }) {
  return (
    <div className="px-4 pt-3 pb-1">
      <p className="text-[13px] font-semibold text-gray-400">{title}</p>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <p className="px-1 pt-6 pb-2 text-[17px] font-bold text-[#333]">
      {title}
    </p>
  );
}

function SettingsRow({
  icon,
  label,
  right,
}: {
  icon?: React.ReactNode;
  label: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center px-4 py-3.5">
      {icon && <span className="text-[#333]">{icon}</span>}
      <span className={`${icon ? "ml-3" : "ml-[32px]"} flex-1 text-[17px] text-[#333]`}>{label}</span>
      {right}
    </div>
  );
}

function PrivacyOption({
  label,
  desc,
  selected,
  onSelect,
}: {
  label: string;
  desc: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-start gap-3 w-full px-3 py-2.5 rounded-lg mb-1 transition-colors ${
        selected ? "bg-gray-900" : "bg-gray-50"
      }`}
    >
      <div
        className={`mt-0.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
          selected ? "border-white" : "border-gray-300"
        }`}
      >
        {selected && <div className="w-[8px] h-[8px] rounded-full bg-white" />}
      </div>
      <div className="text-left">
        <p className={`text-[14px] font-medium ${selected ? "text-white" : "text-[#333]"}`}>{label}</p>
        <p className={`text-[12px] mt-0.5 ${selected ? "text-gray-300" : "text-gray-400"}`}>{desc}</p>
      </div>
    </button>
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
