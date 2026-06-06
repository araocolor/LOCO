"use client";

import { useState } from "react";
import { Bell, BellOff, Image, Lock, UserPlus, LogOut, X } from "lucide-react";

interface ChatMenuSheetProps {
  open: boolean;
  isOwner: boolean;
  roomCreatedAt: string | null;
  onClose: () => void;
  onInvite: () => void;
  onLeave: () => void;
}

export default function ChatMenuSheet({
  open,
  isOwner,
  roomCreatedAt,
  onClose,
  onInvite,
  onLeave,
}: ChatMenuSheetProps) {
  const [confirmLeave, setConfirmLeave] = useState(false);

  function formatCreatedAt(dateStr: string | null) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  }

  function handleLeaveClick() {
    setConfirmLeave(true);
  }

  function handleConfirmLeave() {
    setConfirmLeave(false);
    onLeave();
  }

  function handleClose() {
    setConfirmLeave(false);
    onClose();
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/40" onClick={handleClose} />
      <div className="fixed inset-x-0 bottom-0 z-[81] animate-[slideUp_200ms_ease-out] rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]">
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        `}</style>

        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <span className="text-base font-bold text-gray-800">채팅방 메뉴</span>
          <button onClick={handleClose} className="p-1 text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="px-3 pb-2">
          <MenuItem
            icon={<Bell size={20} />}
            label="알림 끄기"
            onClick={() => {}}
            disabled
          />
          <MenuItem
            icon={<Image size={20} />}
            label="배경화면"
            onClick={() => {}}
            disabled
          />
          {isOwner && (
            <MenuItem
              icon={<Lock size={20} />}
              label="채팅 잠금"
              onClick={() => {}}
              disabled
            />
          )}
          <MenuItem
            icon={<UserPlus size={20} />}
            label="사용자 초대"
            onClick={() => {
              handleClose();
              onInvite();
            }}
          />

          <div className="my-2 border-t border-gray-100" />

          <MenuItem
            icon={<LogOut size={20} />}
            label="나가기"
            danger
            onClick={handleLeaveClick}
          />
        </div>

        {roomCreatedAt && (
          <div className="border-t border-gray-100 px-5 py-3 text-center text-xs text-gray-400">
            채팅방 생일 {formatCreatedAt(roomCreatedAt)}
          </div>
        )}
      </div>

      {confirmLeave && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50">
          <div className="mx-6 w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-xl">
            <p className="text-base font-bold text-gray-800">채팅방 나가기</p>
            <p className="mt-2 text-sm text-gray-500">
              나가면 대화 내용이 보이지 않습니다.<br />
              정말 나가시겠습니까?
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirmLeave(false)}
                className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-700"
              >
                취소
              </button>
              <button
                onClick={handleConfirmLeave}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white"
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MenuItem({
  icon,
  label,
  danger,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
        disabled
          ? "text-gray-300 cursor-default"
          : danger
            ? "text-red-500 hover:bg-red-50"
            : "text-gray-700 hover:bg-gray-50"
      }`}
    >
      {icon}
      <span className="text-[15px] font-medium">{label}</span>
      {disabled && (
        <span className="ml-auto text-[11px] text-gray-300">준비중</span>
      )}
    </button>
  );
}
