"use client";

interface Props {
  imageUrl: string;
  requestId: string;
  title: string;
  rawContent: string;
}

export default function AiPosterResultActions({ requestId }: Props) {
  function handleConfirm() {
    window.location.href = `/classes/new?ai_poster=${requestId}`;
  }

  function handleRemake() {
    window.location.href = `/classes/new/ai-poster/review/${requestId}?remake=1`;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e5e7eb] bg-white px-4 py-3">
      <div className="mx-auto flex w-full max-w-[520px] gap-3">
        <button type="button" onClick={handleRemake} className="btn-outline flex-1 text-center">
          다시만들기
        </button>
        <button type="button" onClick={handleConfirm} className="btn-primary flex-1 text-center">
          확인
        </button>
      </div>
    </div>
  );
}
