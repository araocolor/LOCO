"use client";

import { BarChart3, Megaphone } from "lucide-react";
import type { NoticeKind } from "../../_types";

interface NoticeEditorDrawerProps {
  canWriteClassNotice: boolean;
  editingNoticeId: string | null;
  noticeDraft: string;
  noticeError: string;
  noticeKind: NoticeKind;
  noticeSaving: boolean;
  todayDateStr: string;
  voteClosesAt: string;
  onClose: () => void;
  onSave: () => void;
  setNoticeDraft: (value: string) => void;
  setNoticeKind: (value: NoticeKind) => void;
  setVoteClosesAt: (value: string) => void;
}

export default function NoticeEditorDrawer({
  canWriteClassNotice,
  editingNoticeId,
  noticeDraft,
  noticeError,
  noticeKind,
  noticeSaving,
  todayDateStr,
  voteClosesAt,
  onClose,
  onSave,
  setNoticeDraft,
  setNoticeKind,
  setVoteClosesAt,
}: NoticeEditorDrawerProps) {
  return (
    <div className="absolute inset-0 z-[90]">
      <button
        type="button"
        className="absolute inset-0 bg-black/20"
        aria-label="공지 작성 닫기"
        onClick={onClose}
      />
      <section className="absolute inset-x-0 top-0 h-[70vh] bg-white shadow-xl border-b border-gray-200 animate-[noticeDrawerDown_180ms_ease-out]">
        <div className="flex h-full flex-col">
          <div className="shrink-0 px-4 py-4 border-b border-gray-100">
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
              {noticeKind === "vote" ? <BarChart3 size={20} /> : <Megaphone size={20} />}
              {editingNoticeId
                ? noticeKind === "vote" ? "투표 수정" : "공지 수정"
                : noticeKind === "vote" ? "투표 작성" : "클래스 공지사항"}
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {([
                ["notice", "공지"],
                ["vote", "투표"],
              ] as const).map(([value, label]) => {
                const lockedByEdit = editingNoticeId !== null && noticeKind !== value;
                const lockedByRole = value === "notice" && !canWriteClassNotice;
                const disabled = lockedByEdit || lockedByRole;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setNoticeKind(value)}
                    disabled={disabled}
                    className={`rounded-md py-2 text-sm font-bold ${
                      noticeKind === value ? "bg-yellow-300 text-gray-900" : "bg-gray-100 text-gray-500"
                    } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {noticeKind === "vote" && (
              <>
                <p className="mt-2 font-semibold text-gray-500" style={{ fontSize: 14 }}>투표 선택지는 찬성 / 반대 / 무효로 표시됩니다.</p>
                <div className="mt-3">
                  <label className="block font-bold text-gray-700 mb-1" style={{ fontSize: 14 }}>투표 마감일</label>
                  <input
                    type="date"
                    value={voteClosesAt}
                    min={todayDateStr}
                    onChange={(event) => setVoteClosesAt(event.target.value)}
                    className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                  />
                </div>
              </>
            )}
          </div>
          <div className="flex-1 px-4 py-4 flex flex-col">
            <textarea
              value={noticeDraft}
              onChange={(event) => setNoticeDraft(event.target.value)}
              maxLength={300}
              placeholder="공지 내용을 입력하세요"
              className="flex-1 w-full resize-none rounded-md border border-gray-200 px-3 py-[10px] text-base leading-6 text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-300"
            />
            {noticeError && <p className="mt-2 text-sm text-red-500">{noticeError}</p>}
          </div>
          <div className="shrink-0 flex gap-2 px-4 py-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-gray-200 py-3 text-base font-semibold text-gray-700"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={noticeSaving}
              className="flex-1 rounded-md bg-yellow-300 py-3 text-base font-bold text-gray-900 disabled:opacity-50"
            >
              확인
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
