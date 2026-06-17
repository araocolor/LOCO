"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { BoardPost, BoardCategory } from "@/types/board";
import { ensureBoardPostsCache } from "@/lib/board-session-cache";
import BoardPostList from "@/components/board/BoardPostList";
import BoardPostDetail from "@/components/board/BoardPostDetail";
import BoardCommentsPanel from "@/components/board/BoardCommentsPanel";
import BoardPostEditor from "@/components/board/BoardPostEditor";

export type CustomerServiceTab = "notice" | "support" | "free";

interface Props {
  /** 화면이 보이는 상태일 때 true. 진입 시 첫 탭/목록으로 초기화. */
  active: boolean;
  /** 초기 탭 */
  initialTab?: CustomerServiceTab;
  /** 닫기 버튼 동작. 없으면 닫기 버튼을 숨김(탭 내장 모드) */
  onClose?: () => void;
}

type ViewState =
  | { screen: "list" }
  | { screen: "detail"; postId: string }
  | { screen: "comments"; postId: string }
  | { screen: "write" }
  | { screen: "edit"; post: BoardPost };

export default function CustomerServiceContent({ active, initialTab = "notice", onClose }: Props) {
  const [activeTab, setActiveTab] = useState<CustomerServiceTab>(initialTab);
  const [view, setView] = useState<ViewState>({ screen: "list" });
  const [listKey, setListKey] = useState(0);

  useEffect(() => {
    if (active) {
      queueMicrotask(() => {
        setActiveTab(initialTab);
        setView({ screen: "list" });
      });
    }
  }, [active, initialTab]);

  useEffect(() => {
    if (!active || view.screen !== "list" || activeTab === "free") return;
    void ensureBoardPostsCache("free");
  }, [activeTab, active, view.screen]);

  function handleSelectPost(post: BoardPost) {
    setView({ screen: "detail", postId: post.id });
  }

  function handleOpenComments(postId: string) {
    setView({ screen: "comments", postId });
  }

  function handleCloseComments() {
    if (view.screen === "comments") {
      setView({ screen: "detail", postId: view.postId });
    }
  }

  function handleBackToList() {
    setView({ screen: "list" });
  }

  function handleTabChange(tab: CustomerServiceTab) {
    setActiveTab(tab);
    setView({ screen: "list" });
  }

  function handleWrite() {
    setView({ screen: "write" });
  }

  function handleEdit(post: BoardPost) {
    setView({ screen: "edit", post });
  }

  function handleSaved() {
    setListKey((k) => k + 1);
    setView({ screen: "list" });
  }

  return (
    <div className="relative w-full max-w-[500px] bg-white flex flex-col flex-1 min-h-0">
      {/* 목록 화면 */}
      {view.screen === "list" && (
        <>
          <header className="sticky top-0 z-10 bg-white border-b border-[#e5e7eb]">
            <div className="relative h-14 px-4 flex items-center">
              <div className="font-black text-[22px] text-[#4d4d4d] leading-none">
                커뮤니티
              </div>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="ml-auto flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100"
                  aria-label="닫기"
                >
                  <X size={20} />
                </button>
              )}
            </div>
            <div className="flex pl-4 pr-4 gap-2 pb-2">
              <button
                type="button"
                onClick={() => handleTabChange("notice")}
                className={`px-3.5 py-1.5 rounded-full text-[15px] font-semibold transition-colors ${
                  activeTab === "notice" ? "bg-black text-white" : "bg-gray-100 text-gray-400"
                }`}
              >
                공지사항
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("support")}
                className={`px-3.5 py-1.5 rounded-full text-[15px] font-semibold transition-colors ${
                  activeTab === "support" ? "bg-black text-white" : "bg-gray-100 text-gray-400"
                }`}
              >
                고객문의
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("free")}
                className={`px-3.5 py-1.5 rounded-full text-[15px] font-semibold transition-colors ${
                  activeTab === "free" ? "bg-black text-white" : "bg-gray-100 text-gray-400"
                }`}
              >
                자유게시판
              </button>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto scrollbar-hide overscroll-contain">
            <BoardPostList
              key={`${activeTab}-${listKey}`}
              category={activeTab as BoardCategory}
              onSelectPost={handleSelectPost}
              onWrite={handleWrite}
            />
          </main>
        </>
      )}

      {/* 본문 화면 */}
      {(view.screen === "detail" || view.screen === "comments") && (
        <BoardPostDetail
          postId={view.postId}
          onBack={handleBackToList}
          onOpenComments={() => handleOpenComments(view.postId)}
          onEdit={handleEdit}
        />
      )}

      {/* 댓글 패널 */}
      {view.screen === "comments" && (
        <BoardCommentsPanel
          postId={view.postId}
          open={true}
          onClose={handleCloseComments}
        />
      )}

      {/* 글쓰기 */}
      {view.screen === "write" && (
        <BoardPostEditor
          category={activeTab as BoardCategory}
          onBack={handleBackToList}
          onSaved={handleSaved}
        />
      )}

      {/* 글수정 */}
      {view.screen === "edit" && (
        <BoardPostEditor
          category={view.post.category}
          editPost={view.post}
          onBack={() => setView({ screen: "detail", postId: view.post.id })}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
