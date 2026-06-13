"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, X, ImagePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { BoardCategory, BoardPost, BoardBlock, BoardImage } from "@/types/board";
import { createClient } from "@/lib/supabase/client";

interface Props {
  category: BoardCategory;
  editPost?: BoardPost | null;
  onBack: () => void;
  onSaved: () => void;
}

function postToBlocks(post: BoardPost): BoardBlock[] {
  if (post.blocks && post.blocks.length > 0) {
    return post.blocks.filter(
      (b) => b.type === "text" || (b.type === "image" && b.thumbnail && b.full),
    );
  }
  const blocks: BoardBlock[] = [];
  if (post.content) blocks.push({ type: "text", value: post.content });
  for (const img of post.images ?? []) {
    const t = typeof img === "string" ? img : img.thumbnail;
    const f = typeof img === "string" ? img : img.full;
    if (t && f) blocks.push({ type: "image", thumbnail: t, full: f });
  }
  if (blocks.length === 0) blocks.push({ type: "text", value: "" });
  return blocks;
}

function blocksToLegacy(blocks: BoardBlock[]) {
  const texts: string[] = [];
  const images: BoardImage[] = [];
  for (const b of blocks) {
    if (b.type === "text" && b.value.trim()) texts.push(b.value.trim());
    if (b.type === "image") images.push({ thumbnail: b.thumbnail, full: b.full });
  }
  return { content: texts.join("\n\n"), images };
}

export default function BoardPostEditor({ category, editPost, onBack, onSaved }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(editPost?.title ?? "");
  const [blocks, setBlocks] = useState<BoardBlock[]>(
    editPost ? postToBlocks(editPost) : [{ type: "text", value: "" }],
  );
  const [commentEnabled, setCommentEnabled] = useState(editPost?.comment_enabled ?? true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());
  const focusTargetRef = useRef<number | null>(null);

  useEffect(() => {
    if (editPost) {
      setTitle(editPost.title);
      setBlocks(postToBlocks(editPost));
      setCommentEnabled(editPost.comment_enabled);
    }
  }, [editPost]);

  useEffect(() => {
    if (focusTargetRef.current !== null) {
      const el = textareaRefs.current.get(focusTargetRef.current);
      if (el) {
        el.focus();
        el.setSelectionRange(0, 0);
      }
      focusTargetRef.current = null;
    }
  });

  const setTextareaRef = useCallback((index: number, el: HTMLTextAreaElement | null) => {
    if (el) textareaRefs.current.set(index, el);
    else textareaRefs.current.delete(index);
  }, []);

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function updateTextBlock(index: number, value: string) {
    setBlocks((prev) => prev.map((b, i) => (i === index ? { type: "text", value } : b)));
  }

  function removeImageBlock(index: number) {
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      const prev1 = next[index - 1];
      const cur = next[index];
      if (index > 0 && index < next.length && prev1?.type === "text" && cur?.type === "text") {
        const merged: BoardBlock = { type: "text", value: prev1.value + "\n" + cur.value };
        next.splice(index - 1, 2, merged);
      }
      if (next.length === 0) next.push({ type: "text", value: "" });
      return next;
    });
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const ALLOWED_EXT = ["jpg", "jpeg", "png", "gif", "webp"];

    setUploading(true);
    try {
      const uploaded: { thumbnail: string; full: string }[] = [];

      for (const file of Array.from(files)) {
        const ext = (file.name.split(".").pop() ?? "").toLowerCase();
        if (!ALLOWED_EXT.includes(ext)) {
          alert("jpg, png, gif, webp 형식만 업로드할 수 있습니다.");
          continue;
        }
        const path = `${user.id}/board/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const formData = new FormData();
        formData.append("file", file);
        formData.append("path", path);

        const res = await fetch("/api/storage/class-images", { method: "POST", body: formData });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.thumbnail && data.full) {
          uploaded.push({ thumbnail: data.thumbnail, full: data.full });
        }
      }

      if (uploaded.length > 0) {
        setBlocks((prev) => {
          const next = [...prev];
          const lastIndex = next.length - 1;
          const lastBlock = next[lastIndex];

          const newBlocks: BoardBlock[] = [];
          for (const img of uploaded) {
            newBlocks.push({ type: "image", thumbnail: img.thumbnail, full: img.full });
          }
          newBlocks.push({ type: "text", value: "" });

          if (lastBlock.type === "text") {
            const beforeText = lastBlock.value;
            if (beforeText.trim()) {
              next.splice(lastIndex, 1, { type: "text", value: beforeText }, ...newBlocks);
            } else {
              next.splice(lastIndex, 1, ...newBlocks);
            }
          } else {
            next.push(...newBlocks);
          }

          focusTargetRef.current = next.length - 1;
          return next;
        });
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit() {
    if (!title.trim()) { alert("제목을 입력해주세요."); return; }
    if (submitting) return;

    const { content, images } = blocksToLegacy(blocks);

    setSubmitting(true);
    try {
      if (editPost) {
        const res = await fetch(`/api/board/posts/${editPost.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), content, images, blocks, comment_enabled: commentEnabled }),
        });
        if (res.status === 401) { router.push("/login"); return; }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { alert(data.error ?? "수정에 실패했습니다."); return; }
      } else {
        const res = await fetch("/api/board/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category, title: title.trim(), content, images, blocks, comment_enabled: commentEnabled }),
        });
        if (res.status === 401) { router.push("/login"); return; }
        if (res.status === 403) { alert("작성 권한이 없습니다."); return; }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { alert(data.error ?? "등록에 실패했습니다."); return; }
      }
      onSaved();
    } finally {
      setSubmitting(false);
    }
  }

  const isEdit = !!editPost;
  let textBlockCounter = 0;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="h-12 px-2 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100"
            aria-label="뒤로"
          >
            <ChevronLeft size={22} />
          </button>
          <span className="text-[16px] font-bold text-gray-800">
            {isEdit ? "글 수정" : "글쓰기"}
          </span>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || !title.trim()}
            className="text-[15px] font-bold text-blue-500 disabled:text-gray-300 px-2"
          >
            {isEdit ? "수정" : "등록"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide overscroll-contain">
        <div className="px-4 pt-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            className="w-full text-[18px] font-bold text-gray-900 outline-none placeholder:text-gray-300 pb-3 border-b border-gray-100"
          />
        </div>

        <div className="px-4 pt-3 pb-4">
          {blocks.map((block, i) => {
            if (block.type === "text") {
              const currentIndex = textBlockCounter;
              textBlockCounter++;
              return (
                <textarea
                  key={`text-${i}`}
                  ref={(el) => setTextareaRef(i, el)}
                  value={block.value}
                  onChange={(e) => {
                    updateTextBlock(i, e.target.value);
                    autoResize(e.target);
                  }}
                  onFocus={(e) => autoResize(e.target)}
                  placeholder={currentIndex === 0 ? "내용을 입력하세요" : ""}
                  className="w-full text-[16px] text-gray-800 outline-none placeholder:text-gray-300 resize-none leading-relaxed overflow-hidden"
                  style={{ minHeight: currentIndex === 0 ? "120px" : "40px" }}
                  rows={1}
                />
              );
            }

            return (
              <div key={`img-${i}`} className="relative my-2">
                <div className="relative w-full">
                  <img
                    src={block.thumbnail}
                    alt=""
                    className="w-full rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => removeImageBlock(i)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center"
                  >
                    <X size={14} color="white" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-gray-100 bg-white px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 text-gray-500"
          >
            <ImagePlus size={22} />
            {uploading && <span className="text-[12px] text-gray-400">업로드중...</span>}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            onChange={(e) => void handleImageUpload(e)}
            className="hidden"
          />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={commentEnabled}
            onChange={(e) => setCommentEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 accent-gray-900"
          />
          댓글 허용
        </label>
      </div>
    </div>
  );
}
