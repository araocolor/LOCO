"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  KeyRound,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  ReceiptText,
  ShieldCheck,
  Star,
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
import { PROFESSIONAL_VERIFY_OPEN_EVENT } from "@/lib/profile-events";
import ProfileEditDrawer from "@/components/user/ProfileEditDrawer";

interface MyPageSettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface SettingsProfile {
  id: string;
  nickname: string;
  nickname_changed_at: string | null;
  email: string | null;
  role: "member" | "pro" | "admin";
  profile_image_url: string | null;
  bio: string | null;
  country: string | null;
  region: string | null;
  favorite_genre: string[];
  member_type: string[];
  org_name: string | null;
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
  | "locationConsent"
  | "loginInfo"
  | "accountDelete";

type DetailSectionRow = {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

function useSettingsProfile(open: boolean, refreshKey?: number): SettingsProfile | null {
  const [profile, setProfile] = useState<SettingsProfile | null>(null);

  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem("loco_mypage_cache_local_v3");
      if (raw) {
        const parsed = JSON.parse(raw);
        const p = parsed?.profile;
        if (p?.nickname) {
          setProfile({
            id: p.id ?? "",
            nickname: p.nickname,
            nickname_changed_at: p.nickname_changed_at ?? null,
            email: p.email ?? null,
            role: p.role ?? "member",
            profile_image_url: p.profile_image_url ?? null,
            bio: p.bio ?? null,
            country: p.country ?? null,
            region: p.region ?? null,
            favorite_genre: p.favorite_genre ?? [],
            member_type: p.member_type ?? [],
            org_name: p.org_name ?? null,
          });
        }
      }
    } catch {};
  }, [open, refreshKey]);

  return profile;
}

function getNicknameChangeRemainingDays(nicknameChangedAt: string | null) {
  if (!nicknameChangedAt) return 0;
  const changedTime = new Date(nicknameChangedAt).getTime();
  if (Number.isNaN(changedTime)) return 0;
  const nextAvailableTime = changedTime + 30 * 24 * 60 * 60 * 1000;
  const remainingMs = nextAvailableTime - Date.now();
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
}

export default function MyPageSettingsDrawer({ open, onClose }: MyPageSettingsDrawerProps) {
  const [visible, setVisible] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [detailId, setDetailId] = useState<DetailSettingId | null>(null);
  const detailScrollRef = useRef<HTMLDivElement>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseTab, setPurchaseTab] = useState<PurchaseTab>("credit");
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);

  const settingsProfile = useSettingsProfile(open, profileRefreshKey);

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

  useEffect(() => {
    function onOpenVerify() {
      setVerifyOpen(true);
    }
    window.addEventListener(PROFESSIONAL_VERIFY_OPEN_EVENT, onOpenVerify);
    return () => window.removeEventListener(PROFESSIONAL_VERIFY_OPEN_EVENT, onOpenVerify);
  }, []);

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

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimateIn(true));
      });
    } else {
      setAnimateIn(false);
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const router = useRouter();

  function closeSettings() {
    setDetailId(null);
    onClose();
    router.refresh();
  }

  function openProfileEdit() {
    setProfileEditOpen(true);
  }

  return (
    <>
      {visible ? (
        <>
          {/* 배경 오버레이 */}
          <div
            className={`fixed inset-0 z-[150] bg-black/40 transition-opacity duration-300 ${animateIn ? "opacity-100" : "opacity-0"}`}
            onClick={closeSettings}
          />

          {/* 슬라이드 시트 */}
          <div
            className={`fixed top-0 left-0 h-full w-full bg-[#f2f2f7] z-[200] flex flex-col transition-transform duration-300 ease-in-out ${animateIn ? "translate-x-0" : "translate-x-full"}`}
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
                      profile={settingsProfile}
                      onClose={closeSettings}
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

      {settingsProfile && (
        <ProfileEditDrawer
          open={profileEditOpen}
          onClose={() => { setProfileEditOpen(false); setProfileRefreshKey((k) => k + 1); }}
          profile={settingsProfile}
          mode={settingsProfile.role === "pro" ? "professional" : "normal"}
        />
      )}
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
  const isProfessional = profile?.role === "pro";

  return (
    <div className="px-4 pb-10">
      <div className="bg-white rounded-xl overflow-hidden">

        <button type="button" onClick={onOpenProfileEdit} className="flex items-center w-full px-4 py-3 active:bg-gray-50">
          <div className={`w-[60px] h-[60px] rounded-full overflow-hidden flex-shrink-0 bg-gray-100${profile?.role === "pro" ? " border border-white outline outline-2 outline-[#1D9BF0]" : ""}`}>
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
        <button
          type="button"
          onClick={isProfessional ? undefined : onOpenVerify}
          className={`flex items-center w-full px-4 py-3.5 ${isProfessional ? "cursor-default" : "active:bg-gray-50"}`}
        >
          <span className="ml-[52px] flex items-center gap-1 flex-1 text-[15px] text-[#333]">
            <RiVerifiedBadgeFill size={22} color="#1D9BF0" className="shrink-0" />
            {isProfessional ? "공식프로필 인증완료" : "공식프로필 인증신청"}
          </span>
          {!isProfessional && <ChevronRight size={20} strokeWidth={2.8} className="text-gray-500" />}
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

      {/* 로그인 정보 */}
      <div className="pt-6" />
      <div className="bg-white rounded-xl overflow-hidden">
        <SettingsLinkRow
          icon={<KeyRound size={20} />}
          label="아이디 수정"
          onClick={() => onOpenDetail("loginInfo")}
        />
        <div className="h-[1px] bg-gray-100 mx-4" />
        <SettingsLinkRow
          icon={<LogOut size={20} />}
          label="로그아웃"
          onClick={() => { window.location.href = "/logout"; }}
          showChevron={false}
        />
      </div>

      {/* 회원탈퇴 */}
      <div className="pt-6" />
      <div className="bg-white rounded-xl overflow-hidden">
        <SettingsLinkRow
          icon={<UserCircle size={20} />}
          label="회원탈퇴"
          onClick={() => onOpenDetail("accountDelete")}
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
  profile,
  onClose,
}: {
  detailId: DetailSettingId;
  toggles: Record<string, boolean>;
  onToggle: (key: string) => void;
  classPrivacy: string;
  onClassPrivacy: (value: string) => void;
  messagePrivacy: string;
  onMessagePrivacy: (value: string) => void;
  profile: SettingsProfile | null;
  onClose: () => void;
}) {
  if (detailId === "loginInfo") {
    return (
      <LoginInfoDetail
        nickname={profile?.nickname ?? null}
        email={profile?.email ?? null}
        nicknameChangedAt={profile?.nickname_changed_at ?? null}
        onClose={onClose}
      />
    );
  }

  if (detailId === "accountDelete") {
    return <AccountDeleteDetail />;
  }

  const detail = getDetailSetting({
    detailId,
    toggles,
    onToggle,
    classPrivacy,
    onClassPrivacy,
    messagePrivacy,
    onMessagePrivacy,
  });

  if (!detail) return null;

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
  showChevron = true,
}: {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  showChevron?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center px-4 py-3.5 active:bg-gray-50"
    >
      {icon && <span className="text-[#333]">{icon}</span>}
      <span className={`${icon ? "ml-3" : "ml-[32px]"} flex-1 text-left text-[17px] text-[#333]`}>{label}</span>
      {showChevron && <ChevronRight size={20} strokeWidth={2.8} className="text-gray-500" />}
    </button>
  );
}

function AccountDeleteDetail() {
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [eligibility, setEligibility] = useState<{
    nickname: string;
    starBalance: number;
    classRoomCount: number;
    canDelete: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/delete-eligibility")
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) {
          setEligibility(json);
          setErrorMsg(json.error ?? "");
        }
      })
      .catch(() => {
        if (!cancelled) setErrorMsg("회원탈퇴 정보를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDeleteAccount() {
    if (!eligibility?.canDelete || deleting) return;
    const confirmed = confirm("회원탈퇴를 진행할까요? 탈퇴 후에는 계정 복구가 어렵습니다.");
    if (!confirmed) return;

    setDeleting(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error ?? "회원탈퇴 처리에 실패했습니다.");
        return;
      }
      setSuccessOpen(true);
      setTimeout(() => {
        window.location.href = "/logout";
      }, 2000);
    } catch {
      setErrorMsg("회원탈퇴 처리 중 네트워크 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  }

  const nickname = eligibility?.nickname ?? "회원";
  const starBalance = eligibility?.starBalance ?? 0;
  const classRoomCount = eligibility?.classRoomCount ?? 0;
  const canDelete = eligibility?.canDelete === true;

  return (
    <>
      <div className="px-4 pt-3 pb-10">
        <div className="bg-white rounded-xl p-4">
          <p className="text-[18px] font-bold text-[#333]">회원탈퇴</p>
          <div className="pt-3 space-y-3 text-[15px] leading-[1.6] text-gray-500">
            <p>회원탈퇴를 진행하면 계정 로그인 정보, 프로필 정보, 설정 정보가 삭제됩니다.</p>
            <p>작성한 클래스, 댓글, 신청 내역, 결제 및 크레딧 이용 기록 등 서비스 이용 과정에서 생성된 정보도 삭제되거나 더 이상 계정과 연결되지 않을 수 있습니다.</p>
            <p>단, 결제 기록, 환불 및 분쟁 처리 기록, 부정 이용 방지 및 법령상 보관이 필요한 정보는 관련 법령에 따라 일정 기간 보관될 수 있습니다.</p>
            <p>개인정보처리방침에 따라 회원가입 및 로그인 정보는 탈퇴 후 최대 30일, 결제 관련 기록은 5년, 소비자 불만 또는 분쟁 처리 기록은 3년, 접속 로그는 3개월 동안 보관될 수 있습니다.</p>
            <p>탈퇴 후에는 계정 복구가 어려우며, 보유 크레딧과 일부 이용 기록은 복구되지 않습니다.</p>
          </div>
        </div>

        <div className="pt-6" />
        <div className="bg-white rounded-xl p-5 text-center">
          {loading ? (
            <p className="text-[15px] text-gray-400">확인 중...</p>
          ) : starBalance > 0 ? (
            <>
              <div className="flex justify-center">
                <Image src="/app_img/grey/tino_smile_grey.png" alt="" width={60} height={60} className="h-[60px] w-[60px] object-contain" />
              </div>
              <p className="pt-4 text-[16px] leading-[1.6] text-[#333]">
                <span className="font-bold">{nickname}</span>님 현재{" "}
                <span className="inline-flex items-center gap-1 align-[-2px]">
                  <Star size={16} className="fill-yellow-400 text-yellow-400" />
                  <span>{starBalance}개</span>
                </span>
                가 남아 있습니다. !
                <br />
                누군가에게 선물 하신후에 탈퇴처리 가능하십니다.
              </p>
            </>
          ) : classRoomCount > 0 ? (
            <>
              <div className="flex justify-center">
                <Image src="/app_img/grey/no result_grey.png" alt="" width={60} height={60} className="h-[60px] w-[60px] object-contain" />
              </div>
              <p className="pt-4 text-[16px] leading-[1.6] text-[#333]">
                <span className="font-bold">{nickname}</span>님 현재 가입된 클래스가 있습니다.
                <br />
                관련 클래스대화방을 퇴장 하신후 처리 가능하십니다.
              </p>
            </>
          ) : (
            <p className="text-[16px] leading-[1.6] text-[#333]">
              <span className="font-bold">{nickname}</span>님 회원탈퇴를 진행할 수 있습니다.
            </p>
          )}

          {errorMsg && <p className="pt-3 text-[13px] text-red-500">{errorMsg}</p>}

          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={!canDelete || deleting}
            className="mt-5 w-full rounded-full bg-[#FACC15] py-4 text-[16px] font-bold text-[#333] disabled:opacity-40"
          >
            {deleting ? "처리 중..." : "회원탈퇴하기"}
          </button>
        </div>
      </div>

      {successOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40">
          <div className="mx-8 w-full max-w-sm rounded-2xl bg-white p-6 text-center">
            <p className="text-[17px] font-bold text-[#333]">정상적으로 탈퇴 처리 되었습니다</p>
          </div>
        </div>
      )}
    </>
  );
}

function LoginInfoDetail({
  nickname,
  nicknameChangedAt,
  onClose,
}: {
  nickname: string | null;
  email: string | null;
  nicknameChangedAt: string | null;
  onClose: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [newNickname, setNewNickname] = useState(nickname ?? "");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const remainingDays = getNicknameChangeRemainingDays(nicknameChangedAt);

  async function handleChangeNickname() {
    const trimmed = newNickname.trim();
    if (!trimmed || trimmed === nickname) {
      setErrorMsg(trimmed === nickname ? "현재 아이디와 동일합니다." : "아이디를 입력해주세요.");
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/users/nickname", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message ?? "변경에 실패했습니다.");
        return;
      }
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setModalOpen(false);
        onClose();
        window.location.href = "/logout";
      }, 1000);
    } catch {
      setErrorMsg("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="px-4 pt-3 pb-10">
        <div className="bg-white rounded-xl p-4">
          <p className="text-[18px] font-bold text-[#333]">로그인 정보</p>
          <p className="pt-2 text-[15px] leading-[1.6] text-gray-500">
            로그인은 이메일 방식으로 인증을 합니다.{"\n"}
            아이디는 1개월에 한번만 수정할 수 있습니다.
          </p>
        </div>

        <div className="pt-6" />
        <div className="bg-white rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => {
              if (remainingDays > 0) return;
              setNewNickname(nickname ?? "");
              setErrorMsg(null);
              setModalOpen(true);
            }}
            disabled={remainingDays > 0}
            className="flex w-full items-center px-4 py-3.5 active:bg-gray-50 disabled:opacity-40"
          >
            <span className="text-[#333]"><Pencil size={20} /></span>
            <span className="ml-3 flex-1 text-left text-[17px] text-[#333]">아이디 수정</span>
            <span className="text-[15px] text-gray-400 mr-2">{nickname ?? ""}</span>
            <ChevronRight size={20} strokeWidth={2.8} className="text-gray-500" />
          </button>
        </div>
        <p className="px-4 pt-3 text-[15px] leading-[1.6] text-[#333]">
          {remainingDays > 0 ? `${remainingDays}일 이후 수정 가능합니다.` : "현재, 아이디 변경이 가능합니다."}
        </p>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !showSuccess && setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl w-[85%] max-w-[340px] p-6">
            {showSuccess ? (
              <div className="flex flex-col items-center py-6">
                <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="mt-4 text-[16px] font-semibold text-[#333]">변경 완료</p>
              </div>
            ) : (
              <>
                <p className="text-[18px] font-bold text-[#333] text-center">아이디 수정</p>
                <p className="pt-2 text-[14px] text-gray-400 text-center">새로운 아이디를 입력해주세요</p>
                <input
                  type="text"
                  value={newNickname}
                  onChange={(e) => { setNewNickname(e.target.value); setErrorMsg(null); }}
                  placeholder="아이디"
                  className="mt-4 w-full rounded-lg border border-gray-200 px-4 py-3 text-[16px] text-[#333] outline-none focus:border-gray-400"
                />
                {errorMsg && (
                  <p className="mt-2 text-[13px] text-red-500">{errorMsg}</p>
                )}
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="flex-1 rounded-lg bg-gray-100 py-3 text-[16px] font-semibold text-gray-500"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleChangeNickname}
                    disabled={saving}
                    className="flex-1 rounded-lg bg-black py-3 text-[16px] font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? "변경 중..." : "변경"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
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
