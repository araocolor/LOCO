"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Award,
  Bell,
  BellRing,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  FileText,
  Heart,
  Lock,
  MapPin,
  MessageCircle,
  ReceiptText,
  ShieldCheck,
  Users,
  UserCircle,
  Volume2,
  X,
} from "lucide-react";
import { RiVerifiedBadgeFill } from "react-icons/ri";
import PurchaseHistoryDrawer from "@/components/user/PurchaseHistoryDrawer";
import type { PurchaseItem, PurchaseTab } from "@/components/user/PurchaseHistoryDrawer";
import LegalDrawer from "@/components/legal/LegalDrawer";
import RefundPolicyContent from "@/components/legal/RefundPolicyContent";
import PrivacyPolicyContent from "@/components/legal/PrivacyPolicyContent";
import TermsOfServiceContent from "@/components/legal/TermsOfServiceContent";
import ProfessionalVerifyDrawer from "./ProfessionalVerifyDrawer";
import { PROFILE_EDIT_OPEN_EVENT } from "@/lib/profile-events";

interface MyPageSettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface SettingsProfile {
  nickname: string;
  email: string | null;
  profile_image_url: string | null;
}

type DetailSettingId =
  | "sound"
  | "push"
  | "chatAllSound"
  | "chatDm"
  | "chatGroup"
  | "chatClass"
  | "newsAllSound"
  | "newsClass"
  | "newsComment"
  | "newsLike"
  | "newsPayment"
  | "classPublic"
  | "classFriends"
  | "classPrivate"
  | "messagePublic"
  | "messageFriends"
  | "messagePrivate"
  | "friendAlert"
  | "locationConsent";

type DetailSectionRow = {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

function useSettingsProfile(): SettingsProfile | null {
  const [profile] = useState<SettingsProfile | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("loco_mypage_cache_local_v3");
      if (raw) {
        const parsed = JSON.parse(raw);
        const p = parsed?.profile;
        if (p?.nickname) {
          return {
            nickname: p.nickname,
            email: p.email ?? null,
            profile_image_url: p.profile_image_url ?? null,
          };
        }
      }
    } catch {}

    return null;
  });

  return profile;
}

export default function MyPageSettingsDrawer({ open, onClose }: MyPageSettingsDrawerProps) {
  const [detailId, setDetailId] = useState<DetailSettingId | null>(null);
  const detailScrollRef = useRef<HTMLDivElement>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseTab, setPurchaseTab] = useState<PurchaseTab>("credit");

  const settingsProfile = useSettingsProfile();

  const purchaseItems: PurchaseItem[] = [
    { id: "p1", name: "크레딧 100개 충전", imageUrl: null, unitPrice: 5000, quantity: 2, totalPrice: 10000, purchasedAt: "2026-06-08T14:30:00", category: "credit" },
    { id: "p2", name: "크레딧 50개 충전", imageUrl: null, unitPrice: 3000, quantity: 1, totalPrice: 3000, purchasedAt: "2026-06-05T10:15:00", category: "credit" },
    { id: "p3", name: "골드 별선물", imageUrl: null, unitPrice: 15000, quantity: 1, totalPrice: 15000, purchasedAt: "2026-06-03T09:00:00", category: "badge" },
    { id: "p4", name: "실버 별선물", imageUrl: null, unitPrice: 8000, quantity: 3, totalPrice: 24000, purchasedAt: "2026-05-28T16:45:00", category: "badge" },
  ];

  function openPurchase(tab: PurchaseTab) {
    setPurchaseTab(tab);
    setPurchaseOpen(true);
  }

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

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (open) setDetailId(null);
  }, [open]);

  useEffect(() => {
    if (!detailId || !detailScrollRef.current) return;
    detailScrollRef.current.scrollTo(0, 0);
  }, [detailId]);

  const chatSubKeys = ["chatDm", "chatGroup", "chatClass"];
  const newsSubKeys = ["newsClass", "newsComment", "newsLike", "newsReply"];

  function handleToggle(key: string) {
    if (key === "newsPayment") return;
    setToggles((prev) => {
      const next = { ...prev, [key]: !prev[key] };

      if (key === "friendAlert" || key === "locationConsent") {
        const val = next[key];
        next.friendAlert = val;
        next.locationConsent = val;
      }

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

  function closeSettings() {
    setDetailId(null);
    onClose();
  }

  function openProfileEdit() {
    closeSettings();
    window.dispatchEvent(new Event(PROFILE_EDIT_OPEN_EVENT));
  }

  return (
    <>
      {open ? (
        <>
          {/* 배경 오버레이 */}
          <div
            className="fixed inset-0 z-[150] bg-black/40 transition-opacity duration-300"
            onClick={closeSettings}
          />

          {/* 슬라이드 시트 */}
          <div
            className="fixed top-0 left-0 h-full w-full bg-[#f2f2f7] z-[200] flex flex-col transition-transform duration-300 ease-in-out translate-x-0"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <div className="relative flex-shrink-0 px-4 pt-3 pb-3">
              <div className="flex justify-end">
                <button type="button" onClick={closeSettings}>
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <p className="pt-1 text-[28px] font-bold text-[#333]">설정</p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <GeneralSettings
                profile={settingsProfile}
                toggles={toggles}
                onToggle={handleToggle}
                onOpenDetail={setDetailId}
                onOpenProfileEdit={openProfileEdit}
                onOpenTerms={() => setTermsOpen(true)}
                onOpenRefund={() => setRefundOpen(true)}
                onOpenPrivacy={() => setPrivacyOpen(true)}
                onOpenVerify={() => setVerifyOpen(true)}
                onOpenPurchase={openPurchase}
              />
            </div>

            <div
              className={`absolute inset-0 z-10 flex flex-col bg-[#f2f2f7] transition-transform duration-300 ease-in-out ${
                detailId ? "translate-x-0" : "translate-x-full pointer-events-none"
              }`}
              style={{ paddingTop: "env(safe-area-inset-top)" }}
            >
              {detailId ? (
                <>
                  <div className="relative flex-shrink-0 px-4 pt-3 pb-2">
                    <button type="button" onClick={() => setDetailId(null)} className="flex h-10 w-10 items-center justify-center text-[#333]">
                      <ChevronLeft size={25} />
                    </button>
                    <p className="pointer-events-none absolute left-1/2 top-[32px] -translate-x-1/2 -translate-y-1/2 text-[21px] font-bold text-[#333]">
                      세부설정
                    </p>
                  </div>

                  <div ref={detailScrollRef} className="min-h-0 flex-1 overflow-y-auto">
                    <DetailSettings
                      detailId={detailId}
                      toggles={toggles}
                      onToggle={handleToggle}
                      classPrivacy={classPrivacy}
                      onClassPrivacy={setClassPrivacy}
                      messagePrivacy={messagePrivacy}
                      onMessagePrivacy={setMessagePrivacy}
                    />
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      <LegalDrawer open={refundOpen} onClose={() => setRefundOpen(false)} title="환불정책">
        <RefundPolicyContent />
      </LegalDrawer>

      <LegalDrawer open={privacyOpen} onClose={() => setPrivacyOpen(false)} title="개인정보처리방침">
        <PrivacyPolicyContent />
      </LegalDrawer>

      <LegalDrawer open={termsOpen} onClose={() => setTermsOpen(false)} title="서비스 이용약관">
        <TermsOfServiceContent />
      </LegalDrawer>

      <ProfessionalVerifyDrawer
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        profileImageUrl={settingsProfile?.profile_image_url ?? null}
      />

      <PurchaseHistoryDrawer
        open={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
        items={purchaseItems}
        initialTab={purchaseTab}
      />
    </>
  );
}

function GeneralSettings({
  profile,
  toggles,
  onToggle,
  onOpenDetail,
  onOpenProfileEdit,
  onOpenTerms,
  onOpenRefund,
  onOpenPrivacy,
  onOpenVerify,
  onOpenPurchase,
}: {
  profile: SettingsProfile | null;
  toggles: Record<string, boolean>;
  onToggle: (key: string) => void;
  onOpenDetail: (id: DetailSettingId) => void;
  onOpenProfileEdit: () => void;
  onOpenTerms: () => void;
  onOpenRefund: () => void;
  onOpenPrivacy: () => void;
  onOpenVerify: () => void;
  onOpenPurchase: (tab: PurchaseTab) => void;
}) {
  return (
    <div className="px-4 pb-10">
      <div className="bg-white rounded-xl overflow-hidden">

        <button type="button" onClick={onOpenProfileEdit} className="flex items-center w-full px-4 py-3 active:bg-gray-50">
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
            <p className="text-[18px] font-bold text-[#333]">{profile?.nickname ?? "사용자"}</p>
            <p className="text-[15px] text-gray-400">{profile?.email ?? ""}</p>
          </div>
          <ChevronRight size={20} strokeWidth={2.8} className="text-gray-500" />
        </button>
        <div className="h-[1px] bg-gray-100 mx-4" />
        <button type="button" onClick={onOpenVerify} className="flex items-center w-full px-4 py-3.5 active:bg-gray-50">
          <span className="ml-[52px] flex items-center gap-1 flex-1 text-[15px] text-[#333]">
            <RiVerifiedBadgeFill size={22} color="#1D9BF0" className="shrink-0" />
            공식프로필 인증신청
          </span>
          <ChevronRight size={20} strokeWidth={2.8} className="text-gray-500" />
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
        <SettingsLinkRow
          icon={<MessageCircle size={20} />}
          label="채팅방 전체알림"
          onClick={() => onOpenDetail("chatAllSound")}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsLinkRow
          icon={<Users size={20} />}
          label="1:1대화"
          onClick={() => onOpenDetail("chatDm")}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsLinkRow
          icon={<Users size={20} />}
          label="그룹"
          onClick={() => onOpenDetail("chatGroup")}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsLinkRow
          icon={<Bookmark size={20} />}
          label="클래스"
          onClick={() => onOpenDetail("chatClass")}
        />
      </div>

      {/* 소식알림 */}
      <div className="pt-6" />
      <div className="bg-white rounded-xl overflow-hidden">
        <SettingsLinkRow
          icon={<Bell size={20} />}
          label="전체소식알림"
          onClick={() => onOpenDetail("newsAllSound")}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsLinkRow
          icon={<FileText size={20} />}
          label="수업신청"
          onClick={() => onOpenDetail("newsClass")}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsLinkRow
          icon={<MessageCircle size={20} />}
          label="댓글알림"
          onClick={() => onOpenDetail("newsComment")}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsLinkRow
          icon={<Heart size={20} />}
          label="좋아요알림"
          onClick={() => onOpenDetail("newsLike")}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsLinkRow
          icon={<CreditCard size={20} />}
          label="결제알림"
          onClick={() => onOpenDetail("newsPayment")}
        />
      </div>

      {/* 클래스 설정 */}
      <div className="pt-6" />
      <div className="bg-white rounded-xl overflow-hidden">
        <SettingsLinkRow
          icon={<Eye size={20} />}
          label="클래스전체공개"
          onClick={() => onOpenDetail("classPublic")}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsLinkRow
          icon={<Users size={20} />}
          label="친구허용"
          onClick={() => onOpenDetail("classFriends")}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsLinkRow
          icon={<Lock size={20} />}
          label="전체비공개"
          onClick={() => onOpenDetail("classPrivate")}
        />
      </div>

      {/* 메세지 설정 */}
      <div className="pt-6" />
      <div className="bg-white rounded-xl overflow-hidden">
        <SettingsLinkRow
          icon={<Eye size={20} />}
          label="메세지전체수신"
          onClick={() => onOpenDetail("messagePublic")}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsLinkRow
          icon={<Users size={20} />}
          label="친구허용"
          onClick={() => onOpenDetail("messageFriends")}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsLinkRow
          icon={<Lock size={20} />}
          label="비공개"
          onClick={() => onOpenDetail("messagePrivate")}
        />
      </div>

      {/* 회원찾기 */}
      <div className="pt-6" />
      <div className="bg-white rounded-xl overflow-hidden">
        <SettingsLinkRow
          icon={<Heart size={20} />}
          label="이근처 친구알림"
          onClick={() => onOpenDetail("friendAlert")}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsLinkRow
          icon={<MapPin size={20} />}
          label="위치정보동의"
          onClick={() => onOpenDetail("locationConsent")}
        />
      </div>

      {/* 구매목록 */}
      <div className="pt-6" />
      <div className="bg-white rounded-xl overflow-hidden">
        <SettingsLinkRow
          icon={<CreditCard size={20} />}
          label="크레딧"
          onClick={() => onOpenPurchase("credit")}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsLinkRow
          icon={<Award size={20} />}
          label="별선물"
          onClick={() => onOpenPurchase("badge")}
        />
      </div>

      {/* 이용약관 */}
      <div className="pt-6" />
      <div className="bg-white rounded-xl overflow-hidden">
        <SettingsLinkRow
          icon={<FileText size={20} />}
          label="서비스 이용약관"
          onClick={onOpenTerms}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsLinkRow
          icon={<ReceiptText size={20} />}
          label="환불정책"
          onClick={onOpenRefund}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsLinkRow
          icon={<ShieldCheck size={20} />}
          label="개인정보처리방침"
          onClick={onOpenPrivacy}
        />
      </div>
    </div>
  );
}

function DetailSettings({
  detailId,
  toggles,
  onToggle,
  classPrivacy,
  onClassPrivacy,
  messagePrivacy,
  onMessagePrivacy,
}: {
  detailId: DetailSettingId;
  toggles: Record<string, boolean>;
  onToggle: (key: string) => void;
  classPrivacy: string;
  onClassPrivacy: (value: string) => void;
  messagePrivacy: string;
  onMessagePrivacy: (value: string) => void;
}) {
  const detail = getDetailSetting({
    detailId,
    toggles,
    onToggle,
    classPrivacy,
    onClassPrivacy,
    messagePrivacy,
    onMessagePrivacy,
  });

  return (
    <div className="px-4 pt-3 pb-10">
      <div className="bg-white rounded-xl p-4">
        <p className="text-[18px] font-bold text-[#333]">{detail.label}</p>
        <p className="pt-2 text-[15px] leading-[1.6] text-gray-500">
          {detail.description}
        </p>
      </div>

      <div className="pt-6" />
      <div className="bg-white rounded-xl overflow-hidden">
        {detail.sectionRows.map((row, index) => (
          <div key={row.label}>
            {index > 0 ? <div className="h-[1px] bg-gray-100 mx-4" /> : null}
            <div className={row.disabled ? "opacity-50" : ""}>
              <SettingsRow
                icon={row.icon}
                label={row.label}
                right={<IosToggle checked={row.checked} onChange={row.onToggle} />}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


function getDetailSetting({
  detailId,
  toggles,
  onToggle,
  classPrivacy,
  onClassPrivacy,
  messagePrivacy,
  onMessagePrivacy,
}: {
  detailId: DetailSettingId;
  toggles: Record<string, boolean>;
  onToggle: (key: string) => void;
  classPrivacy: string;
  onClassPrivacy: (value: string) => void;
  messagePrivacy: string;
  onMessagePrivacy: (value: string) => void;
}) {
  const generalRows: DetailSectionRow[] = [
    { icon: <Volume2 size={20} />, label: "전체소리설정", checked: toggles.sound, onToggle: () => onToggle("sound") },
    { icon: <BellRing size={20} />, label: "알림 푸시", checked: toggles.push, onToggle: () => onToggle("push") },
  ];
  const chatRows: DetailSectionRow[] = [
    { icon: <MessageCircle size={20} />, label: "채팅방 전체알림", checked: toggles.chatAllSound, onToggle: () => onToggle("chatAllSound") },
    { icon: <Users size={20} />, label: "1:1대화", checked: toggles.chatDm, onToggle: () => onToggle("chatDm") },
    { icon: <Users size={20} />, label: "그룹", checked: toggles.chatGroup, onToggle: () => onToggle("chatGroup") },
    { icon: <Bookmark size={20} />, label: "클래스", checked: toggles.chatClass, onToggle: () => onToggle("chatClass") },
  ];
  const newsRows: DetailSectionRow[] = [
    { icon: <Bell size={20} />, label: "전체소식알림", checked: toggles.newsAllSound, onToggle: () => onToggle("newsAllSound") },
    { icon: <FileText size={20} />, label: "수업신청", checked: toggles.newsClass, onToggle: () => onToggle("newsClass") },
    { icon: <MessageCircle size={20} />, label: "댓글알림", checked: toggles.newsComment, onToggle: () => onToggle("newsComment") },
    { icon: <Heart size={20} />, label: "좋아요알림", checked: toggles.newsLike, onToggle: () => onToggle("newsLike") },
    { icon: <CreditCard size={20} />, label: "결제알림", checked: true, onToggle: () => {}, disabled: true },
  ];
  const classRows: DetailSectionRow[] = [
    { icon: <Eye size={20} />, label: "클래스전체공개", checked: classPrivacy === "public", onToggle: () => onClassPrivacy("public") },
    { icon: <Users size={20} />, label: "친구허용", checked: classPrivacy === "friends", onToggle: () => onClassPrivacy("friends") },
    { icon: <Lock size={20} />, label: "전체비공개", checked: classPrivacy === "private", onToggle: () => onClassPrivacy("private") },
  ];
  const messageRows: DetailSectionRow[] = [
    { icon: <Eye size={20} />, label: "메세지전체수신", checked: messagePrivacy === "public", onToggle: () => onMessagePrivacy("public") },
    { icon: <Users size={20} />, label: "친구허용", checked: messagePrivacy === "friends", onToggle: () => onMessagePrivacy("friends") },
    { icon: <Lock size={20} />, label: "비공개", checked: messagePrivacy === "private", onToggle: () => onMessagePrivacy("private") },
  ];
  const friendRows: DetailSectionRow[] = [
    { icon: <Heart size={20} />, label: "이근처 친구알림", checked: toggles.friendAlert, onToggle: () => onToggle("friendAlert") },
    { icon: <MapPin size={20} />, label: "위치정보동의", checked: toggles.locationConsent, onToggle: () => onToggle("locationConsent") },
  ];

  switch (detailId) {
    case "sound":
      return { icon: <Volume2 size={20} />, label: "전체소리설정", description: "앱에서 사용하는 알림 소리를 전체적으로 켜거나 끕니다.", checked: toggles.sound, onToggle: () => onToggle("sound"), sectionRows: generalRows };
    case "push":
      return { icon: <BellRing size={20} />, label: "알림 푸시", description: "기기로 도착하는 푸시 알림을 켜거나 끕니다.", checked: toggles.push, onToggle: () => onToggle("push"), sectionRows: generalRows };
    case "chatAllSound":
      return { icon: <MessageCircle size={20} />, label: "채팅방 전체알림", description: "모든 채팅방의 알림 소리와 푸시 알림을 끕니다. 채팅방별 알림은 별도로 설정할 수 있습니다.", checked: toggles.chatAllSound, onToggle: () => onToggle("chatAllSound"), sectionRows: chatRows };
    case "chatDm":
      return { icon: <Users size={20} />, label: "1:1대화", description: "1:1 대화의 모든 방에 소리와 알림을 끕니다.", checked: toggles.chatDm, onToggle: () => onToggle("chatDm"), sectionRows: chatRows };
    case "chatGroup":
      return { icon: <Users size={20} />, label: "그룹", description: "그룹 채팅의 모든 방에 소리와 알림을 끕니다.", checked: toggles.chatGroup, onToggle: () => onToggle("chatGroup"), sectionRows: chatRows };
    case "chatClass":
      return { icon: <Bookmark size={20} />, label: "클래스", description: "클래스 채팅의 모든 방에 소리와 알림을 끕니다.", checked: toggles.chatClass, onToggle: () => onToggle("chatClass"), sectionRows: chatRows };
    case "newsAllSound":
      return { icon: <Bell size={20} />, label: "전체소식알림", description: "모든 소식 알림의 소리를 끕니다. 소식 알림은 항목별로 따로 설정할 수 있습니다.", checked: toggles.newsAllSound, onToggle: () => onToggle("newsAllSound"), sectionRows: newsRows };
    case "newsClass":
      return { icon: <FileText size={20} />, label: "수업신청", description: "내가 만든 클래스의 신청 알림 소리를 끕니다. 승인이 필요한 경우 표시는 유지됩니다.", checked: toggles.newsClass, onToggle: () => onToggle("newsClass"), sectionRows: newsRows };
    case "newsComment":
      return { icon: <MessageCircle size={20} />, label: "댓글알림", description: "클래스 댓글에 대한 소리와 알림 표시를 끕니다.", checked: toggles.newsComment, onToggle: () => onToggle("newsComment"), sectionRows: newsRows };
    case "newsLike":
      return { icon: <Heart size={20} />, label: "좋아요알림", description: "내가 만든 클래스의 좋아요 알림 표시를 끕니다.", checked: toggles.newsLike, onToggle: () => onToggle("newsLike"), sectionRows: newsRows };
    case "newsPayment":
      return { icon: <CreditCard size={20} />, label: "결제알림", description: "결제는 중요한 알림이라 소리와 알림이 표시됩니다. 소리는 모바일 기기 설정에서 끌 수 있습니다.", checked: true, onToggle: () => {}, disabled: true, sectionRows: newsRows };
    case "classPublic":
      return { icon: <Eye size={20} />, label: "클래스전체공개", description: "내가 만든 클래스를 모든 회원에게 공개합니다. 누구나 신청할 수 있고 댓글도 볼 수 있습니다.", checked: classPrivacy === "public", onToggle: () => onClassPrivacy("public"), sectionRows: classRows };
    case "classFriends":
      return { icon: <Users size={20} />, label: "친구허용", description: "내가 만든 클래스는 친구 관계인 사용자에게만 노출됩니다.", checked: classPrivacy === "friends", onToggle: () => onClassPrivacy("friends"), sectionRows: classRows };
    case "classPrivate":
      return { icon: <Lock size={20} />, label: "전체비공개", description: "내가 만든 클래스를 모두에게 비공개로 전환합니다. 클래스 채팅방 삭제는 별도로 진행해야 합니다.", checked: classPrivacy === "private", onToggle: () => onClassPrivacy("private"), sectionRows: classRows };
    case "messagePublic":
      return { icon: <Eye size={20} />, label: "메세지전체수신", description: "모든 사용자의 메시지를 받을 수 있습니다.", checked: messagePrivacy === "public", onToggle: () => onMessagePrivacy("public"), sectionRows: messageRows };
    case "messageFriends":
      return { icon: <Users size={20} />, label: "친구허용", description: "친구 관계인 사용자만 메시지를 보낼 수 있습니다.", checked: messagePrivacy === "friends", onToggle: () => onMessagePrivacy("friends"), sectionRows: messageRows };
    case "messagePrivate":
      return { icon: <Lock size={20} />, label: "비공개", description: "메시지를 받지 않습니다.", checked: messagePrivacy === "private", onToggle: () => onMessagePrivacy("private"), sectionRows: messageRows };
    case "friendAlert":
      return { icon: <Heart size={20} />, label: "이근처 친구알림", description: "근처 친구가 앱을 사용하면 위치와 시간을 알리는 알림을 받습니다. 내 기기의 위치 설정도 켜져 있어야 합니다.", checked: toggles.friendAlert, onToggle: () => onToggle("friendAlert"), sectionRows: friendRows };
    case "locationConsent":
      return { icon: <MapPin size={20} />, label: "위치정보동의", description: "이 근처 친구 알림을 사용하거나 근처 친구를 검색하려면 위치 정보를 켜야 합니다.", checked: toggles.locationConsent, onToggle: () => onToggle("locationConsent"), sectionRows: friendRows };
  }
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

function SettingsLinkRow({
  icon,
  label,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center px-4 py-3.5 active:bg-gray-50"
    >
      {icon && <span className="text-[#333]">{icon}</span>}
      <span className={`${icon ? "ml-3" : "ml-[32px]"} flex-1 text-left text-[17px] text-[#333]`}>{label}</span>
      <ChevronRight size={20} strokeWidth={2.8} className="text-gray-500" />
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
