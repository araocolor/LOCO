"use client";

import { useState } from "react";
import Image from "next/image";

interface SendMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiver: {
    id: string;
    nickname: string;
    profile_image_url: string | null;
  };
}

export default function SendMessageModal({ isOpen, onClose, receiver }: SendMessageModalProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  async function handleSend() {
    if (!content.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiver_id: receiver.id,
          content,
        }),
      });

      if (!res.ok) {
        alert("메시지 전송 실패");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setContent("");
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (error) {
      alert("오류 발생");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[300px] bg-white rounded-2xl overflow-hidden shadow-xl">
        {/* 받는사람 정보 */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {receiver.profile_image_url ? (
              <Image
                src={receiver.profile_image_url}
                alt={receiver.nickname}
                width={40}
                height={40}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-medium">
                {receiver.nickname[0]}
              </div>
            )}
            <span className="font-semibold text-gray-900 text-sm">{receiver.nickname}</span>
          </div>
        </div>

        {/* 메시지 입력 */}
        <div className="p-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="메시지를 입력하세요"
            className="w-full h-[120px] p-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400"
            disabled={loading || success}
          />
        </div>

        {/* 버튼 영역 */}
        <div className="p-3 border-t border-gray-100 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            disabled={loading || success}
          >
            취소
          </button>
          <button
            onClick={handleSend}
            disabled={!content.trim() || loading || success}
            className="flex-1 py-2 text-sm font-semibold text-gray-900 bg-yellow-400 rounded-lg hover:bg-yellow-500 disabled:opacity-50"
          >
            {loading ? "전송 중..." : success ? "완료!" : "전송"}
          </button>
        </div>
      </div>
    </div>
  );
}
