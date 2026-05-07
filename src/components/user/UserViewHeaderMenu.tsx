"use client";

import { useState } from "react";
import SendMessageModal from "@/components/modal/SendMessageModal";

interface Props {
  userId: string;
  nickname: string;
  profile_image_url: string | null;
}

export default function UserViewHeaderMenu({ userId, nickname, profile_image_url }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [messageModalOpen, setMessageModalOpen] = useState(false);

  return (
    <>
      <div className="relative w-10 flex items-center justify-end">
        <button onClick={() => setMenuOpen((v) => !v)} className="p-1 text-gray-600 hover:text-gray-900">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-[70]" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full z-[80] bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden" style={{ width: 180 }}>
              <button
                onClick={() => { setMenuOpen(false); setMessageModalOpen(true); }}
                className="flex items-center justify-between w-full px-4 py-3 text-sm text-gray-700"
              >
                <span>메시지전송</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
      <SendMessageModal
        isOpen={messageModalOpen}
        onClose={() => setMessageModalOpen(false)}
        receiver={{ id: userId, nickname, profile_image_url }}
      />
    </>
  );
}
