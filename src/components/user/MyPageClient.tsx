"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { UserCircle, X } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { createClient } from "@/lib/supabase/client";
import AvatarCropModal from "./AvatarCropModal";
import { ClassImage } from "@/types/class";

type TabType = "all" | "my" | "bookmark";

interface GridClass {
  id: string;
  images: ClassImage[] | null;
  title: string;
  status?: string;
  created_at?: string;
  isBookmark?: boolean;
}

interface Profile {
  id: string;
  nickname: string;
  profile_image_url: string | null;
}

interface Props {
  profile: Profile;
  myClasses: GridClass[];
}

export default function MyPageClient({ profile, myClasses: initialMyClasses }: Props) {
  const MY_PAGE_CACHE_KEY = "loco_mypage_cache_local_v2";
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.profile_image_url);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [myClasses, setMyClasses] = useState<GridClass[]>(initialMyClasses);
  const [bookmarkClasses, setBookmarkClasses] = useState<GridClass[]>([]);

  useEffect(() => {
    async function fetchClasses() {
      const supabase = createClient();

      // 북마크: localStorage 캐시 우선 [{id, created_at}]
      const rawBm = localStorage.getItem("loco_bookmark_ids_v1");
      const bmEntries: { id: string; created_at: string }[] | null = rawBm ? JSON.parse(rawBm) : null;

      if (bmEntries !== null && Array.isArray(bmEntries) && bmEntries[0]?.created_at) {
        const homeRaw = localStorage.getItem("loco_home_results_local_v1");
        const homeClasses: any[] = homeRaw ? (JSON.parse(homeRaw).data ?? []) : [];
        const homeMap = new Map(homeClasses.map((c) => [c.id, c]));

        const found: GridClass[] = [];
        const missing: { id: string; created_at: string }[] = [];
        bmEntries.forEach(({ id, created_at }) => {
          const c = homeMap.get(id);
          if (c) found.push({ id: c.id, images: c.images, title: c.title, created_at, isBookmark: true });
          else missing.push({ id, created_at });
        });

        if (missing.length > 0) {
          const { data: extra } = await supabase
            .from("classes")
            .select("id, images, title")
            .in("id", missing.map((m) => m.id));
          const extraMapped = (extra ?? []).map((c) => ({
            ...c,
            created_at: missing.find((m) => m.id === c.id)?.created_at,
            isBookmark: true,
          }));
          setBookmarkClasses([...found, ...extraMapped]);
        } else {
          setBookmarkClasses(found);
        }
      } else {
        // 캐시 없으면 전체 DB fetch
        const { data: bm } = await supabase
          .from("class_bookmarks")
          .select("class_id, created_at, classes(id, images, title)")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false });
        const bmClasses = (bm ?? []).map((b: any) => ({
          ...b.classes,
          created_at: b.created_at,
          isBookmark: true,
        }));
        setBookmarkClasses(bmClasses);
        localStorage.setItem("loco_bookmark_ids_v1", JSON.stringify(
          bmClasses.map((c: any) => ({ id: c.id, created_at: c.created_at }))
        ));
      }
    }
    fetchClasses();
  }, [profile.id]);

  async function handleLogout() {
    try {
      // 북마크 캐시 → DB 동기화
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const rawB = localStorage.getItem("loco_bookmark_ids_v1");
        const bookmarks: { id: string; created_at: string }[] = rawB ? JSON.parse(rawB) : [];
        await supabase.from("class_bookmarks").delete().eq("user_id", user.id);
        if (bookmarks.length > 0) {
          await supabase.from("class_bookmarks").insert(
            bookmarks.map((b) => ({ user_id: user.id, class_id: b.id, created_at: b.created_at }))
          );
        }
        localStorage.removeItem("loco_bookmark_ids_v1");
      }
      localStorage.removeItem(MY_PAGE_CACHE_KEY);
      const homeCache = sessionStorage.getItem("loco_home_results_cache_v3:all");
      if (homeCache) localStorage.setItem("loco_home_results_local_v1", homeCache);
    } catch {}
    await logoutAction();
    router.replace("/login");
  }

  function handleAvatarClick() {
    fileInputRef.current?.click();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSelectedImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleCropConfirm(blob: Blob) {
    setSelectedImage(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const ts = Date.now();
      const path = `${profile.id}/${ts}.webp`;

      const { data: list } = await supabase.storage.from("avatars").list(profile.id);
      const oldFiles = (list ?? []).map((f) => `${profile.id}/${f.name}`);

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/webp", upsert: false });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);

      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ profile_image_url: publicUrl })
        .eq("id", profile.id);
      if (dbErr) throw dbErr;

      if (oldFiles.length > 0) {
        await supabase.storage.from("avatars").remove(oldFiles);
      }

      try {
        localStorage.removeItem(MY_PAGE_CACHE_KEY);
      } catch {}

      setAvatarUrl(publicUrl);
      router.refresh();
    } catch (err) {
      console.error("아바타 업로드 실패:", err);
      alert("업로드에 실패했어요. 다시 시도해주세요.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 상단 30% */}
      <div className="h-[30vh] bg-white flex flex-col items-start justify-between px-4 pt-5 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={handleAvatarClick}
            className="flex-shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
          >
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt="프로필"
                width={60}
                height={60}
                className="rounded-full object-cover w-[60px] h-[60px]"
                unoptimized
              />
            ) : (
              <UserCircle size={60} className="text-gray-400" />
            )}
          </button>
          <span className="text-[15px] font-semibold text-[#333333]">
            {profile.nickname}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditOpen(true)}
            className="px-4 py-2 bg-yellow-400 text-gray-900 font-medium rounded-lg hover:bg-yellow-500 transition-colors text-[15px]"
          >
            프로필 편집
          </button>
          <button
            onClick={handleLogout}
            className="text-[15px] text-gray-400 font-medium hover:text-gray-600 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* 하단 클래스 그리드 */}
      <div className="flex-1 bg-white">
        {/* 탭 필터 */}
        <div className="flex gap-2 px-4 py-3">
          {([["all", "전체목록"], ["my", "내클래스"], ["bookmark", "북마크"]] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                activeTab === tab
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 3x3 그리드 */}
        <div className="grid grid-cols-3 gap-[1px] bg-gray-200">
          {(activeTab === "all"
            ? [...myClasses, ...bookmarkClasses].sort((a, b) =>
                new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
              )
            : activeTab === "my"
            ? myClasses
            : bookmarkClasses
          ).map((item) => (
            <div key={item.id + (item.isBookmark ? "-bm" : "")} className="aspect-square bg-gray-100 relative overflow-hidden">
              {item.images?.[0]?.card_url ? (
                <Image
                  src={item.images[0].card_url}
                  alt={item.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <span className="text-gray-300 text-xs">없음</span>
                </div>
              )}
              {item.isBookmark && (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute top-1.5 right-1.5">
                  <polygon points="19 21 12 16 5 21 5 3 19 3" />
                </svg>
              )}
              {!item.isBookmark && item.status === "recruiting" && (
                <div className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-green-500" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 프로필 편집 슬라이드 */}
      <div
        className={`fixed inset-0 z-50 bg-black/30 transition-opacity duration-300 ${
          editOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setEditOpen(false)}
      />
      <div
        className={`fixed top-0 left-0 right-0 z-[60] bg-white h-[40vh] transition-transform duration-300 ease-in-out ${
          editOpen ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="h-full flex flex-col p-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">프로필 편집</h2>
            <button onClick={() => setEditOpen(false)} className="p-1 hover:bg-gray-100 rounded">
              <X size={20} />
            </button>
          </div>

          {/* 1행: 아바타 + 아이디 (가운데 정렬) */}
          <div className="flex flex-col items-center mb-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              onClick={handleAvatarClick}
              className="flex-shrink-0 mb-2 hover:opacity-80 transition-opacity cursor-pointer"
            >
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt="프로필"
                  width={60}
                  height={60}
                  className="rounded-full object-cover w-[60px] h-[60px]"
                  unoptimized
                />
              ) : (
                <UserCircle size={60} className="text-gray-400" />
              )}
              {uploading && (
                <span className="absolute text-[10px] text-white bg-black/60 px-2 py-0.5 rounded mt-1">
                  업로드 중
                </span>
              )}
            </button>
            <span className="text-base font-semibold text-gray-900">{profile.nickname}</span>
          </div>

          {/* 2행: 자기소개 문장 입력창 */}
          <div className="flex-1 mb-4">
            <textarea
              placeholder="자기소개를 입력하세요"
              className="w-full h-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
            />
          </div>

          {/* 3행: 취소, 확인 버튼 */}
          <div className="flex gap-2 justify-end h-fit">
            <button
              onClick={() => setEditOpen(false)}
              className="px-4 py-2 border border-gray-300 text-gray-900 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              취소
            </button>
            <button
              onClick={() => setEditOpen(false)}
              className="px-4 py-2 bg-yellow-400 text-gray-900 font-medium rounded-lg hover:bg-yellow-500 transition-colors text-sm"
            >
              확인
            </button>
          </div>
        </div>
      </div>

      {selectedImage && (
        <AvatarCropModal
          imageSrc={selectedImage}
          onCancel={() => setSelectedImage(null)}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}
