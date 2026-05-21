"use client";

import type { RefObject } from "react";
import { CalendarDays, FileText, Image as ImageIcon, MapPin, Video } from "lucide-react";

interface ChatAttachPanelProps {
  attachOpen: boolean;
  photoInputRef: RefObject<HTMLInputElement | null>;
  videoInputRef: RefObject<HTMLInputElement | null>;
  uploading: boolean;
  onPhotoUpload: (file: File) => void;
  onVideoUpload: (file: File) => void;
}

export default function ChatAttachPanel({
  attachOpen,
  photoInputRef,
  videoInputRef,
  uploading,
  onPhotoUpload,
  onVideoUpload,
}: ChatAttachPanelProps) {
  function handleSelectPhoto() {
    photoInputRef.current?.click();
  }

  function handleSelectVideo() {
    videoInputRef.current?.click();
  }

  return (
    <div
      className="overflow-hidden transition-all duration-300 ease-in-out bg-white"
      style={{ height: attachOpen ? "140px" : "0px" }}
    >
      <input
        ref={photoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPhotoUpload(file);
          e.target.value = "";
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onVideoUpload(file);
          e.target.value = "";
        }}
      />
      <div className="grid grid-cols-5 gap-3 px-4 pt-6 pb-6">
        <button onClick={handleSelectPhoto} disabled={uploading} className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-600">
            <ImageIcon size={28} strokeWidth={2} />
          </div>
          <span className="text-xs text-gray-500">사진</span>
        </button>
        <button onClick={handleSelectVideo} disabled={uploading} className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-600">
            <Video size={28} strokeWidth={2} />
          </div>
          <span className="text-xs text-gray-500">영상</span>
        </button>
        <button disabled={uploading} className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-600">
            <FileText size={28} strokeWidth={2} />
          </div>
          <span className="text-xs text-gray-500">파일</span>
        </button>
        <button disabled={uploading} className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-600">
            <MapPin size={28} strokeWidth={2} />
          </div>
          <span className="text-xs text-gray-500">지도</span>
        </button>
        <button disabled={uploading} className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-600">
            <CalendarDays size={28} strokeWidth={2} />
          </div>
          <span className="text-xs text-gray-500">클래스</span>
        </button>
      </div>
    </div>
  );
}
