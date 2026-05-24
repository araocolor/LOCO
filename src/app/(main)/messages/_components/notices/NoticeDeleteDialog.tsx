"use client";

interface NoticeDeleteDialogProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export default function NoticeDeleteDialog({ onCancel, onConfirm }: NoticeDeleteDialogProps) {
  return (
    <div className="absolute inset-0 z-[95] flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="삭제 취소"
        onClick={onCancel}
      />
      <div className="relative w-[80%] max-w-[320px] rounded-xl bg-white p-5 shadow-xl">
        <p className="text-base font-bold text-gray-900">정말 삭제하시겠습니까?</p>
        <p className="mt-2 text-sm text-gray-600">삭제된 공지는 복구할 수 없습니다.</p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-md border border-gray-200 py-2.5 text-sm font-bold text-gray-700"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-md bg-red-500 py-2.5 text-sm font-bold text-white"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
