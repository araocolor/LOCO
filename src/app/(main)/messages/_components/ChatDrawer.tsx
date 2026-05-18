"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import { ArrowLeft, Paperclip, Send } from "lucide-react";
import ChatAttachPanel from "./ChatAttachPanel";
import MessageBubble from "./MessageBubble";
import type { Message, MyProfile, OtherUser } from "../_types";

interface ChatDrawerProps {
  attachOpen: boolean;
  chatLoading: boolean;
  chatMenuOpen: boolean;
  chatOpen: boolean;
  messages: Message[];
  messagesEndRef: RefObject<HTMLDivElement | null>;
  myProfile: MyProfile | null;
  newMessage: string;
  otherUser: OtherUser | null;
  photoInputRef: RefObject<HTMLInputElement | null>;
  selectedUserId: string | null;
  sending: boolean;
  shakingMsgId: string | null;
  uploading: boolean;
  userId: string;
  onCancelLongPress: () => void;
  onClose: () => void;
  onDeleteMessage: (msgId: string) => void;
  onFriendRequest: () => void;
  onPhotoUpload: (file: File) => void;
  onSendMessage: () => void;
  onStartLongPress: (msgId: string, isMine: boolean) => void;
  setAttachOpen: Dispatch<SetStateAction<boolean>>;
  setChatMenuOpen: Dispatch<SetStateAction<boolean>>;
  setNewMessage: Dispatch<SetStateAction<string>>;
  setShakingMsgId: Dispatch<SetStateAction<string | null>>;
  formatTime: (dateStr: string) => string;
}

export default function ChatDrawer({
  attachOpen,
  chatLoading,
  chatMenuOpen,
  chatOpen,
  messages,
  messagesEndRef,
  myProfile,
  newMessage,
  otherUser,
  photoInputRef,
  selectedUserId,
  sending,
  shakingMsgId,
  uploading,
  userId,
  onCancelLongPress,
  onClose,
  onDeleteMessage,
  onFriendRequest,
  onPhotoUpload,
  onSendMessage,
  onStartLongPress,
  setAttachOpen,
  setChatMenuOpen,
  setNewMessage,
  setShakingMsgId,
  formatTime,
}: ChatDrawerProps) {
  return (
    <div
      className={`fixed inset-0 z-[60] bg-white flex flex-col transition-transform duration-300 ease-in-out ${
        chatOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="h-14 shrink-0 relative flex items-center justify-between px-4 border-b border-gray-100">
        <button onClick={onClose} className="p-1 -ml-1 text-gray-600 hover:text-gray-900">
          <ArrowLeft size={20} />
        </button>
        <div className="absolute left-1/2 -translate-x-1/2">
          <span className="font-bold text-gray-900" style={{ fontSize: "18px" }}>{otherUser?.nickname ?? "로딩중..."}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button onClick={() => setChatMenuOpen((v) => !v)} className="p-1 text-gray-600 hover:text-gray-900">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            {chatMenuOpen && (
              <>
                <div className="fixed inset-0 z-[70]" onClick={() => setChatMenuOpen(false)} />
                <div className="absolute right-0 top-full z-[80] bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden" style={{ width: 180 }}>
                  <button
                    className="flex items-center justify-between w-full px-4 py-3 text-gray-700" style={{ fontSize: "16px" }}
                    onClick={onFriendRequest}
                  >
                    <span>친구 신청</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                    </svg>
                  </button>
                  <div className="border-t border-gray-100 mx-3" />
                  <button className="flex items-center justify-between w-full px-4 py-3 text-gray-700" style={{ fontSize: "16px" }}>
                    <span>대화 삭제</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                  <div className="border-t border-gray-100 mx-3" />
                  <button className="flex items-center justify-between w-full px-4 py-3 text-red-500" style={{ fontSize: "16px" }}>
                    <span>차단하기</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                      <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-2deg); }
          75% { transform: rotate(2deg); }
        }
        .msg-shake { animation: shake 0.3s ease-in-out infinite; }
      `}</style>
      <div
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3"
        style={{ backgroundColor: "#B2C7D9" }}
        onClick={() => {
          setAttachOpen(false);
          setShakingMsgId(null);
        }}
      >
        {chatLoading ? (
          <div className="flex items-center justify-center h-full text-gray-600">로딩 중...</div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            대화 시작하기
          </div>
        ) : (
          messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              prevMsg={idx > 0 ? messages[idx - 1] : null}
              userId={userId}
              myProfile={myProfile}
              otherUser={otherUser}
              shakingMsgId={shakingMsgId}
              onStartLongPress={onStartLongPress}
              onCancelLongPress={onCancelLongPress}
              onDeleteMessage={onDeleteMessage}
              formatTime={formatTime}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-100 px-3 pt-3 pb-3 flex gap-2 items-start min-h-[80px]">
        <button className="text-gray-500 flex-shrink-0 mt-2" onClick={() => setAttachOpen((v) => !v)}>
          <Paperclip size={22} strokeWidth={2.5} />
        </button>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && onSendMessage()}
          placeholder="메시지 입력..."
          className="flex-1 px-3 py-2 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-yellow-400"
          style={{ fontSize: "16px", color: "#000000cc" }}
          disabled={sending}
        />
        <button
          onClick={onSendMessage}
          disabled={!newMessage.trim() || sending || !selectedUserId}
          className="w-9 h-9 flex items-center justify-center bg-yellow-400 text-gray-900 rounded-full hover:bg-yellow-500 disabled:opacity-50 mt-1 flex-shrink-0"
        >
          <Send size={16} />
        </button>
      </div>

      <ChatAttachPanel
        attachOpen={attachOpen}
        photoInputRef={photoInputRef}
        uploading={uploading}
        onPhotoUpload={onPhotoUpload}
      />
    </div>
  );
}
