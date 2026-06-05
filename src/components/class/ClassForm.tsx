"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { GENRES, CATEGORIES, LEVELS, REGIONS, REGIONS_WITH_ALL } from "@/lib/constants";
import type { ClassImage, DanceClass } from "@/types/class";

declare global {
  interface Window {
    daum?: {
      Postcode: new (opts: {
        oncomplete: (d: { roadAddress: string; address: string }) => void;
      }) => { open: () => void };
    };
    kakao?: {
      maps: {
        services: {
          Geocoder: new () => {
            addressSearch: (
              addr: string,
              cb: (r: { x: string; y: string }[], s: string) => void
            ) => void;
          };
        };
        LatLng: new (lat: number, lng: number) => unknown;
        Map: new (el: HTMLElement | null, opts: object) => unknown;
        Marker: new (opts: object) => unknown;
        load: (cb: () => void) => void;
      };
    };
  }
}

interface FormState {
  genres: string[];
  category: string;
  title: string;
  level: string;
  class_type: string;
  status: string;
  type: string;
  deadline: string;
  location_address: string;
  location_lat: number | null;
  location_lng: number | null;
  contact: string;
  description: string;
  region: string;
  is_public: boolean;
  require_approval: boolean;
}

const EMPTY: FormState = {
  genres: [],
  category: "",
  title: "",
  level: "",
  class_type: "group",
  status: "recruiting",
  type: "class",
  deadline: "",
  location_address: "",
  location_lat: null,
  location_lng: null,
  contact: "",
  description: "",
  region: "",
  is_public: true,
  require_approval: true,
};

function toFormState(d: Partial<DanceClass>): FormState {
  return {
    genres: d.genres ?? [],
    category: d.category ?? "",
    title: d.title ?? "",
    level: d.level ?? "",
    class_type: d.class_type ?? "group",
    status: d.status ?? "recruiting",
    type: d.type ?? "class",
    deadline: d.deadline ? d.deadline.slice(0, 10) : "",
    location_address: d.location_address ?? "",
    location_lat: d.location_lat ?? null,
    location_lng: d.location_lng ?? null,
    contact: d.contact ?? "",
    description: d.description ?? "",
    region: d.region ?? "",
    is_public: (d as Record<string, unknown>).is_public !== false,
    require_approval: (d as Record<string, unknown>).require_approval !== false,
  };
}

interface AiPosterPrefill {
  imageUrl: string;
  title: string;
  rawContent: string;
}

interface ClassFormProps {
  initialData?: Partial<DanceClass>;
  classId?: string;
  userRole: "member" | "pro" | "admin";
  aiPosterData?: AiPosterPrefill;
}

interface MentionCandidate {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  region: string | null;
}

interface MentionRange {
  start: number;
  end: number;
}

interface MentionMenuPosition {
  left: number;
  top: number;
}

type SubmitModalState =
  | null
  | { kind: "success"; newClassId: string }
  | { kind: "failure"; message: string };

type CreateStep = 1 | 2;

const CREATE_DRAFT_KEY = "loco:create-class:draft";
const CREATE_SECONDARY_BUTTON_CLASS =
  "flex-1 rounded-full border border-gray-300 bg-white py-3 text-center text-[15px] font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";
const CREATE_PRIMARY_BUTTON_CLASS =
  "flex-1 rounded-full bg-[#facc15] py-3 text-center text-[15px] font-bold text-black transition-colors hover:bg-[#eab308] disabled:cursor-not-allowed disabled:opacity-50";
const STATUS_OPTIONS = [
  { value: "recruiting", label: "모집중" },
  { value: "closed", label: "모집종료" },
] as const;

function toCreateFailureMessage(message: string) {
  if (message.includes("classes_genre_check")) return "장르를 선택해주세요.";
  if (message.includes("violates check constraint")) return "입력한 항목을 다시 확인해주세요.";
  return message;
}

function getMentionRange(
  value: string,
  cursor: number
): { query: string; range: MentionRange } | null {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/(^|[\s([{])@([\p{L}\p{N}_-]{0,30})$/u);
  if (!match) return null;

  const query = match[2];
  const start = cursor - query.length - 1;
  return { query, range: { start, end: cursor } };
}

function getTextareaCursorPosition(
  textarea: HTMLTextAreaElement,
  cursor: number
): MentionMenuPosition {
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  const span = document.createElement("span");

  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.style.overflow = "hidden";
  mirror.style.boxSizing = style.boxSizing;
  mirror.style.width = `${textarea.clientWidth}px`;
  mirror.style.font = style.font;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.padding = style.padding;
  mirror.style.border = style.border;

  mirror.textContent = textarea.value.slice(0, cursor);
  span.textContent = textarea.value.slice(cursor, cursor + 1) || ".";
  mirror.appendChild(span);
  document.body.appendChild(mirror);

  const position = {
    left: span.offsetLeft - textarea.scrollLeft,
    top: span.offsetTop - textarea.scrollTop + span.offsetHeight,
  };

  document.body.removeChild(mirror);
  return position;
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 불러올 수 없습니다."));
    };
    img.src = url;
  });
}

async function canvasToWebpFile(
  canvas: HTMLCanvasElement,
  fileName: string,
  quality: number
): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error("이미지 변환에 실패했습니다."));
          return;
        }
        resolve(result);
      },
      "image/webp",
      quality
    );
  });

  return new File([blob], fileName, { type: "image/webp" });
}

const AI_POSTER_FILENAME = "ai-poster.webp";
const AI_POSTER_FULL_WIDTH = 1004;
const AI_POSTER_QUALITY = 0.75;
const DEFAULT_QUALITY = 0.9;

async function resizeImageToWidth(file: File, width: number): Promise<File> {
  const image = await loadImage(file);
  const isAiPoster = file.name === AI_POSTER_FILENAME;
  const quality = isAiPoster ? AI_POSTER_QUALITY : DEFAULT_QUALITY;
  const maxWidth = isAiPoster && width >= 1024 ? AI_POSTER_FULL_WIDTH : width;
  const targetWidth = Math.min(maxWidth, image.width);
  const targetHeight = Math.round((image.height * targetWidth) / image.width);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지 처리에 실패했습니다.");

  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  return canvasToWebpFile(canvas, `${file.name.replace(/\.[^.]+$/, "") || "image"}.webp`, quality);
}

export default function ClassForm({ initialData, classId, userRole: _userRole, aiPosterData }: ClassFormProps) {
  const router = useRouter();
  const isCreateMode = !classId;
  const isEditMode = !!classId;
  const [form, setForm] = useState<FormState>(initialData ? toFormState(initialData) : EMPTY);
  const [existingImages, setExistingImages] = useState<ClassImage[]>(initialData?.images ?? []);
  const [deletedImages, setDeletedImages] = useState<ClassImage[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const submitGuardRef = useRef(false);
  const [error, setError] = useState("");
  const [submitModal, setSubmitModal] = useState<SubmitModalState>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const preResizeRef = useRef<Map<File, Promise<{ icon: File; card: File; full: File }>>>(
    new Map()
  );
  const draftHydratedRef = useRef(false);
  const genreSelectedRef = useRef(false);
  const [showDetail, setShowDetail] = useState(!!initialData);
  const [createStep, setCreateStep] = useState<CreateStep>(1);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionRange, setMentionRange] = useState<MentionRange | null>(null);
  const [mentionMenuPosition, setMentionMenuPosition] = useState<MentionMenuPosition | null>(null);
  const [mentionCandidates, setMentionCandidates] = useState<MentionCandidate[]>([]);
  const totalImages = existingImages.length + newFiles.length;

  function scheduleResize(files: File[]) {
    for (const file of files) {
      if (!preResizeRef.current.has(file)) {
        preResizeRef.current.set(
          file,
          Promise.all([
            resizeImageToWidth(file, 200),
            resizeImageToWidth(file, 600),
            resizeImageToWidth(file, 1024),
          ]).then(([icon, card, full]) => ({ icon, card, full }))
        );
      }
    }
  }

  useEffect(() => {
    if (!isCreateMode) return;

    if (aiPosterData) {
      window.sessionStorage.removeItem(CREATE_DRAFT_KEY);
      queueMicrotask(() => {
        setForm((prev) => ({
          ...prev,
          title: aiPosterData.title || prev.title,
          description: aiPosterData.rawContent || prev.description,
        }));
      });
      fetch(aiPosterData.imageUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], "ai-poster.webp", { type: "image/webp" });
          setNewFiles((prev) => [...prev, file]);
          setPreviews((prev) => [...prev, URL.createObjectURL(file)]);
          if (genreSelectedRef.current) scheduleResize([file]);
        })
        .catch(() => {});
      draftHydratedRef.current = true;
      return;
    }

    let queuedRestore = false;
    try {
      const raw = window.sessionStorage.getItem(CREATE_DRAFT_KEY);
      if (!raw) return;

      const draft = JSON.parse(raw) as { form?: Partial<FormState> };
      if (draft.form) {
        queuedRestore = true;
        queueMicrotask(() => {
          setForm((prev) => ({
            ...prev,
            ...draft.form,
            genres: Array.isArray(draft.form?.genres) ? draft.form.genres : prev.genres,
          }));
          draftHydratedRef.current = true;
        });
        return;
      }
    } catch {
      window.sessionStorage.removeItem(CREATE_DRAFT_KEY);
    } finally {
      if (!queuedRestore) draftHydratedRef.current = true;
    }
  }, [aiPosterData, isCreateMode]);

  useEffect(() => {
    if (!isCreateMode || !draftHydratedRef.current) return;

    try {
      window.sessionStorage.setItem(
        CREATE_DRAFT_KEY,
        JSON.stringify({
          form,
        })
      );
    } catch {
      // 저장 공간 부족 등은 입력 흐름을 막지 않는다.
    }
  }, [form, isCreateMode]);

  useEffect(() => {
    if (mentionQuery.length === 0) {
      queueMicrotask(() => setMentionCandidates([]));
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      const run = async () => {
        try {
          const params = new URLSearchParams({ q: mentionQuery, limit: "5" });
          const res = await fetch(`/api/users/search?${params.toString()}`, { method: "GET" });
          if (cancelled) return;
          if (!res.ok) {
            setMentionCandidates([]);
            return;
          }

          const json = (await res.json()) as { data?: MentionCandidate[] };
          if (cancelled) return;
          setMentionCandidates(json.data ?? []);
        } catch {
          if (!cancelled) setMentionCandidates([]);
        }
      };

      void run();
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mentionQuery]);

  // daum postcode 스크립트 로드
  useEffect(() => {
    if (document.getElementById("daum-postcode")) return;
    const s = document.createElement("script");
    s.id = "daum-postcode";
    s.src = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    document.head.appendChild(s);
  }, []);
  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "genres" && !genreSelectedRef.current) {
      genreSelectedRef.current = true;
      scheduleResize(newFiles);
    }
  }

  function updateMentionSearch(value: string, cursor: number | null) {
    if (!isEditMode || cursor === null) {
      setMentionQuery("");
      setMentionRange(null);
      setMentionMenuPosition(null);
      setMentionCandidates([]);
      return;
    }

    const mention = getMentionRange(value, cursor);
    if (!mention || mention.query.length === 0) {
      setMentionQuery("");
      setMentionRange(null);
      setMentionMenuPosition(null);
      setMentionCandidates([]);
      return;
    }

    setMentionQuery(mention.query);
    setMentionRange(mention.range);
    const textarea = descriptionRef.current;
    setMentionMenuPosition(textarea ? getTextareaCursorPosition(textarea, cursor) : null);
  }

  function handleDescriptionChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    set("description", next);
    updateMentionSearch(next, e.target.selectionStart);
  }


  function handleDescriptionCursor() {
    const textarea = descriptionRef.current;
    if (!textarea) return;
    updateMentionSearch(textarea.value, textarea.selectionStart);
  }

  function selectMention(candidate: MentionCandidate) {
    if (!mentionRange) return;

    const before = form.description.slice(0, mentionRange.start);
    const after = form.description.slice(mentionRange.end);
    const inserted = `@${candidate.nickname} `;
    const next = `${before}${inserted}${after}`;
    const nextCursor = before.length + inserted.length;

    set("description", next);
    setMentionQuery("");
    setMentionRange(null);
    setMentionMenuPosition(null);
    setMentionCandidates([]);

    window.requestAnimationFrame(() => {
      descriptionRef.current?.focus();
      descriptionRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function openAddressSearch() {
    if (!window.daum?.Postcode) {
      alert("주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도하세요.");
      return;
    }
    new window.daum.Postcode({
      oncomplete: (data) => {
        const addr = data.roadAddress || data.address;
        set("location_address", addr);
        set("location_lat", null);
        set("location_lng", null);
        // 카카오맵 API 키가 있으면 좌표 변환
        const key = process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY;
        if (key && window.kakao?.maps?.services) {
          const gc = new window.kakao.maps.services.Geocoder();
          gc.addressSearch(addr, (result, status) => {
            if (status === "OK" && result[0]) {
              set("location_lat", parseFloat(result[0].y));
              set("location_lng", parseFloat(result[0].x));
            }
          });
        }
      },
    }).open();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const remaining = 5 - existingImages.length - newFiles.length;
    const picked = files.slice(0, remaining);
    setNewFiles((p) => [...p, ...picked]);
    setPreviews((p) => [...p, ...picked.map((f) => URL.createObjectURL(f))]);
    if (genreSelectedRef.current) scheduleResize(picked);
    e.target.value = "";
  }

  function removeExisting(i: number) {
    setDeletedImages((p) => [...p, existingImages[i]]);
    setExistingImages((p) => p.filter((_, idx) => idx !== i));
  }

  function selectRepresentativeImage(index: number) {
    if (!isEditMode || index === 0) return;
    setExistingImages((prev) => {
      const next = [...prev];
      const [picked] = next.splice(index, 1);
      if (!picked) return prev;
      return [picked, ...next];
    });
  }

  function removeNew(i: number) {
    preResizeRef.current.delete(newFiles[i]);
    URL.revokeObjectURL(previews[i]);
    setNewFiles((p) => p.filter((_, idx) => idx !== i));
    setPreviews((p) => p.filter((_, idx) => idx !== i));
  }

  async function uploadImages(files: File[], userId: string): Promise<ClassImage[]> {
    const result: ClassImage[] = [];
    const failed: string[] = [];
    const uploadViaApi = async (file: File, path: string) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("path", path);
      const res = await fetch("/api/storage/class-images", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "이미지 업로드 중 오류가 발생했습니다.");
      }
      return data.publicUrl as string;
    };

    for (const file of files) {
      const base = `${userId}/${window.crypto.randomUUID()}`;
      try {
        const pending = preResizeRef.current.get(file);
        const { icon, card, full } = pending
          ? await pending
          : {
              icon: await resizeImageToWidth(file, 200),
              card: await resizeImageToWidth(file, 600),
              full: await resizeImageToWidth(file, 1024),
            };
        const [iconUrl, cardUrl, fullUrl] = await Promise.all([
          uploadViaApi(icon, `${base}-icon.webp`),
          uploadViaApi(card, `${base}-card.webp`),
          uploadViaApi(full, `${base}-full.webp`),
        ]);
        result.push({
          icon_url: iconUrl,
          card_url: cardUrl,
          full_url: fullUrl,
        });
      } catch (error) {
        failed.push(
          error instanceof Error ? error.message : "이미지 업로드 중 오류가 발생했습니다."
        );
      }
    }

    if (failed.length > 0) {
      throw new Error(`이미지 업로드 실패: ${failed[0]}`);
    }

    return result;
  }

  function handleNextStep() {
    submitGuardRef.current = true;
    setCreateStep(2);
    requestAnimationFrame(() => {
      submitGuardRef.current = false;
    });
  }

  function handleBackToFirstStep() {
    setCreateStep(1);
  }

  function resetCreateDraft() {
    previews.forEach((url) => URL.revokeObjectURL(url));
    preResizeRef.current.clear();
    window.sessionStorage.removeItem(CREATE_DRAFT_KEY);
    setForm(EMPTY);
    setExistingImages([]);
    setDeletedImages([]);
    setNewFiles([]);
    setPreviews([]);
    setError("");
    setCreateStep(1);
    router.push("/");
    router.refresh();
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();

    if (isCreateMode && createStep !== 2) return;
    if (submitGuardRef.current) return;

    setSubmitting(true);
    setError("");

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다.");

      const deletedImagePaths =
        deletedImages.length > 0
          ? deletedImages.flatMap((img) => {
              const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
              return [img.icon_url, img.card_url, img.full_url].map((url) =>
                url.replace(`${supabaseUrl}/storage/v1/object/public/class-images/`, "")
              );
            })
          : [];

      const uploaded = newFiles.length > 0 ? await uploadImages(newFiles, user.id) : [];
      const images = isCreateMode ? uploaded : [...existingImages, ...uploaded];
      const deadlineDateTime = form.deadline ? `${form.deadline}T23:59:00` : "";
      const classType = form.category === "training" ? "private" : "group";
      const contentType =
        form.category === "event" || form.category === "festival" ? "event" : "class";

      const payload: Record<string, unknown> = {
        genres: form.genres,
        title: form.title,
        level: form.level,
        class_type: classType,
        status: form.status,
        type: contentType,
        deadline: isCreateMode ? deadlineDateTime : form.deadline,
        location_address: isCreateMode ? "" : form.location_address,
        location_lat: form.location_lat,
        location_lng: form.location_lng,
        contact: isCreateMode ? "" : form.contact,
        description: form.description,
        region: form.region,
        category: form.category || null,
        is_public: form.is_public,
        require_approval: form.require_approval,
        images,
      };
      const url = classId ? `/api/classes/${classId}` : "/api/classes";
      const res = await fetch(url, {
        method: classId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "오류가 발생했습니다.");

      if (deletedImagePaths.length > 0) {
        await fetch("/api/storage/class-images", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paths: deletedImagePaths }),
        });
      }

      if (isCreateMode) {
        window.sessionStorage.removeItem(CREATE_DRAFT_KEY);
        setSubmitModal({ kind: "success", newClassId: data.id as string });
        return;
      }

      router.push(`/classes/${classId}`);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "오류가 발생했습니다.";
      if (isCreateMode) {
        setSubmitModal({ kind: "failure", message: toCreateFailureMessage(message) });
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="max-w-xl mx-auto bg-[#f4f4f4] min-h-screen flex flex-col">
        <div className="flex-1 overflow-y-auto">
        {isCreateMode ? (
          createStep === 1 ? (
            <>
              <div className="mx-4 mt-[18px] bg-white rounded-2xl px-4 py-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  이미지 <span className="text-red-500">*</span>
                </p>
                {totalImages > 0 && (
                  <div className="flex gap-3 mb-4 flex-wrap">
                    {previews.map((url, i) => (
                      <div key={`n-${i}`} className="relative">
                        <img src={url} alt="" className="h-20 w-20 rounded-[10px] object-cover" />
                        <button
                          type="button"
                          onClick={() => removeNew(i)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-700 text-white rounded-full text-xs leading-none disabled:opacity-50"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {totalImages < 5 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-outline text-sm py-2 px-6 w-auto"
                  >
                    + 이미지 추가&nbsp;&nbsp;{totalImages}/5
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <div className="mx-4 mt-[18px] bg-white rounded-2xl px-4 py-5 space-y-4">
                <div>
                  <label className="field-label">
                    제목 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="클래스 제목을 입력하세요"
                    value={form.title}
                    onChange={(e) => set("title", e.target.value)}
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className="field-label">
                    본문 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className="input-field resize-none"
                    placeholder="클래스 상세 내용을 입력하세요"
                    value={form.description}
                    onChange={handleDescriptionChange}
                    rows={15}
                  />
                </div>
              </div>

            </>
          ) : (
            <>
              <div className="mx-4 mt-[18px] bg-white rounded-2xl px-4 py-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  장르 (최대 2개) <span className="text-red-500">*</span>
                </p>
                <div className="flex gap-2 flex-wrap">
                  {GENRES.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      className={`chip ${form.genres.includes(g.value) ? "active" : ""}`}
                      onClick={() => {
                        const exists = form.genres.includes(g.value);
                        const next = exists
                          ? form.genres.filter((v) => v !== g.value)
                          : form.genres.length >= 2
                            ? [...form.genres.slice(1), g.value]
                            : [...form.genres, g.value];
                        set("genres", next);
                      }}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mx-4 mt-[18px] bg-white rounded-2xl px-4 py-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  카테고리 <span className="text-red-500">*</span>
                </p>
                <div className="flex gap-2 flex-wrap">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      className={`chip ${form.category === c.value ? "active" : ""}`}
                      onClick={() => set("category", c.value)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mx-4 mt-[18px] bg-white rounded-2xl px-4 py-5 space-y-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">일정</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="field-label">
                      레벨 <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="input-field"
                      value={form.level}
                      onChange={(e) => set("level", e.target.value)}
                    >
                      <option value="">선택</option>
                      {LEVELS.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">
                      지역 <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="input-field"
                      value={form.region}
                      onChange={(e) => set("region", e.target.value)}
                    >
                      <option value="">선택</option>
                      {REGIONS_WITH_ALL.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="field-label">
                    신청 마감일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={form.deadline}
                    onChange={(e) => set("deadline", e.target.value)}
                  />
                </div>
              </div>

              <div className="mx-4 mt-[18px] bg-white rounded-2xl px-4 py-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    승인 여부
                  </p>
                  <button
                    type="button"
                    onClick={() => set("require_approval", !form.require_approval)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.require_approval ? "bg-[#facc15]" : "bg-gray-300"}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${form.require_approval ? "translate-x-6" : "translate-x-1"}`}
                    />
                  </button>
                </div>
                <p className="text-[14px] text-gray-400 mt-2">
                  승인여부를 끄면 클래스대화방에 바로 들어올 수 있습니다.
                </p>
              </div>

            </>
          )
        ) : (
          <>
            {/* 섹션 1 — 이미지 */}
            <div className="mx-4 mt-[18px] bg-white rounded-2xl px-4 py-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                이미지
              </p>
              {totalImages > 0 && (
                <div className="flex gap-3 mb-3 flex-wrap justify-center">
                  {existingImages.map((img, i) => (
                    <div key={`e-${i}`} className="relative">
                      <Image
                        src={img.card_url}
                        alt=""
                        width={100}
                        height={0}
                        style={{ width: 100, height: "auto" }}
                        className="rounded-[10px]"
                      />
                      {isEditMode && (
                        <button
                          type="button"
                          onClick={() => selectRepresentativeImage(i)}
                          className={`absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold shadow-sm ${
                            i === 0
                              ? "border-[#facc15] bg-[#facc15] text-black"
                              : "border-[#facc15] bg-white text-[#ca8a04]"
                          }`}
                          aria-label={i === 0 ? "대표 이미지" : "대표 이미지로 선택"}
                        >
                          ✓
                        </button>
                      )}
                      {isEditMode && i === 0 && (
                        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
                          대표
                        </span>
                      )}
                      {(isCreateMode || isEditMode) && (
                        <button
                          type="button"
                          onClick={() => removeExisting(i)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-700 text-white rounded-full text-xs leading-none"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  {previews.map((url, i) => (
                    <div key={`n-${i}`} className="relative">
                      <img
                        src={url}
                        alt=""
                        style={{ width: 100, height: "auto" }}
                        className="rounded-[10px]"
                      />
                      {(isCreateMode || isEditMode) && (
                        <button
                          type="button"
                          onClick={() => removeNew(i)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-700 text-white rounded-full text-xs leading-none"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-center">
                {totalImages < 5 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-outline text-sm py-2 px-6 w-auto"
                  >
                    + 이미지 추가&nbsp;&nbsp;{totalImages}/5
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* 섹션 2 — 장르 */}
            <div className="mx-4 mt-[18px] bg-white rounded-2xl px-4 py-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                장르 (최대 2개)
              </p>
              <div className="flex gap-2 flex-wrap">
                {GENRES.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    className={`chip ${form.genres.includes(g.value) ? "active" : ""}`}
                    onClick={() => {
                      const exists = form.genres.includes(g.value);
                      const next = exists
                        ? form.genres.filter((v) => v !== g.value)
                        : form.genres.length >= 2
                          ? [...form.genres.slice(1), g.value]
                          : [...form.genres, g.value];
                      set("genres", next);
                    }}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 섹션 2-2 — 분류 */}
            <div className="mx-4 mt-[18px] bg-white rounded-2xl px-4 py-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                분류 (1개 선택)
              </p>
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`chip ${form.category === c.value ? "active" : ""}`}
                    onClick={() => set("category", form.category === c.value ? "" : c.value)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 섹션 3 — 제목 + 본문 */}
            <div className="mx-4 mt-[18px] bg-white rounded-2xl px-4 py-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  제목 / 본문
                </p>
                <div className="flex gap-1">
                  {(["오픈", "비공개"] as const).map((v) => {
                    const active = v === "오픈" ? form.is_public : !form.is_public;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => set("is_public", v === "오픈")}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors ${active ? "bg-black text-white" : "text-gray-400"}`}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              </div>
              <input
                type="text"
                className="input-field disabled:bg-gray-100 disabled:text-gray-500"
                placeholder="클래스 제목을 입력하세요"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                maxLength={100}
              />
              <div className="relative">
                <textarea
                  ref={descriptionRef}
                  className="input-field resize-none"
                  placeholder="클래스 상세 내용을 입력하세요"
                  value={form.description}
                  onChange={handleDescriptionChange}
                  onClick={handleDescriptionCursor}
                  onKeyUp={handleDescriptionCursor}
                  rows={15}
                />
                {isEditMode && mentionCandidates.length > 0 && (
                  <div
                    className="absolute z-40 mt-1 w-[220px] overflow-hidden rounded-xl bg-white shadow-lg"
                    style={{
                      left: mentionMenuPosition?.left ?? 0,
                      top: mentionMenuPosition?.top ?? 0,
                    }}
                  >
                    {mentionCandidates.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectMention(candidate)}
                      >
                        {candidate.profile_image_url ? (
                          <Image
                            src={candidate.profile_image_url}
                            alt={candidate.nickname}
                            width={32}
                            height={32}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                            {candidate.nickname[0]}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-gray-900">
                            @{candidate.nickname}
                          </span>
                          {candidate.region && (
                            <span className="block truncate text-xs text-gray-400">
                              {candidate.region}
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 섹션 4 — 지역 / 레벨 */}
            <div className="mx-4 mt-[18px] bg-white rounded-2xl px-4 py-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                지역 / 레벨
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="field-label">지역 *</label>
                  <select
                    className="input-field disabled:bg-gray-100 disabled:text-gray-500"
                    value={form.region}
                    onChange={(e) => set("region", e.target.value)}
                  >
                    <option value="">선택</option>
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">레벨 *</label>
                  <select
                    className="input-field disabled:bg-gray-100 disabled:text-gray-500"
                    value={form.level}
                    onChange={(e) => set("level", e.target.value)}
                  >
                    <option value="">선택</option>
                    {LEVELS.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 섹션 5+6 — 장소 상세 */}
            <div className="mx-4 mt-[18px] bg-white rounded-2xl px-4 py-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  상세 정보
                </p>
                <button
                  type="button"
                  onClick={() => setShowDetail((v) => !v)}
                  className={`text-xs text-gray-400 underline ${isEditMode ? "hidden" : ""}`}
                >
                  {showDetail ? "상세접기" : "상세 정보 입력"}
                </button>
              </div>
              {(showDetail || isEditMode) && (
                <>
                  {/* 신청 마감일 */}
                  <div>
                    <label className="field-label">신청 마감일 *</label>
                    <input
                      type="date"
                      className="input-field disabled:bg-gray-100 disabled:text-gray-500"
                      value={form.deadline}
                      onChange={(e) => set("deadline", e.target.value)}
                    />
                  </div>

                  {/* 모집 상태 */}
                  <div>
                    <label className="field-label">모집 상태</label>
                    <div className="flex gap-2 flex-wrap">
                      {STATUS_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`chip ${form.status === option.value ? "active" : ""}`}
                          onClick={() => set("status", option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 장소 */}
                  <div>
                    <label className="field-label">장소</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="input-field cursor-pointer disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                        placeholder="주소 검색"
                        value={form.location_address}
                        readOnly
                        onClick={openAddressSearch}
                      />
                      <button
                        type="button"
                        onClick={openAddressSearch}
                        className="flex-shrink-0 px-4 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-[12px] whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        검색
                      </button>
                    </div>
                  </div>

                  {/* 승인 여부 */}
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="field-label">승인 여부</label>
                      <button
                        type="button"
                        onClick={() => set("require_approval", !form.require_approval)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.require_approval ? "bg-[#facc15]" : "bg-gray-300"}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${form.require_approval ? "translate-x-6" : "translate-x-1"}`}
                        />
                      </button>
                    </div>
                    <p className="text-[14px] text-gray-400 mt-1">
                      승인여부를 끄면 클래스대화방에 바로 들어올 수 있습니다.
                    </p>
                  </div>

                  {/* 연락처 */}
                  <div>
                    <label className="field-label">연락처 *</label>
                    <input
                      type="tel"
                      className="input-field disabled:bg-gray-100 disabled:text-gray-500"
                      placeholder="카카오톡 ID 또는 전화번호"
                      value={form.contact}
                      onChange={(e) => set("contact", e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

          </>
        )}
        </div>

        {/* 고정 푸터 */}
        <div className="sticky bottom-0 border-t border-gray-200 bg-white px-4 py-3 flex gap-2">
          {isCreateMode ? (
            createStep === 1 ? (
              <>
                <button
                  type="button"
                  className={CREATE_SECONDARY_BUTTON_CLASS}
                  onClick={resetCreateDraft}
                >
                  취소
                </button>
                <button
                  type="button"
                  className={CREATE_PRIMARY_BUTTON_CLASS}
                  disabled={totalImages === 0 || !form.title.trim() || !form.description.trim()}
                  onClick={() => void handleNextStep()}
                >
                  다음
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={CREATE_SECONDARY_BUTTON_CLASS}
                  onClick={handleBackToFirstStep}
                  disabled={submitting}
                >
                  돌아가기
                </button>
                <button
                  type="submit"
                  className={CREATE_PRIMARY_BUTTON_CLASS}
                  disabled={submitting || form.genres.length === 0 || !form.category || !form.level || !form.region || !form.deadline}
                >
                  {submitting ? "저장 중..." : "클래스개설"}
                </button>
              </>
            )
          ) : (
            <>
              {error && <p className="error-text mb-3 w-full">{error}</p>}
              <button type="submit" className="btn-primary w-full" disabled={submitting}>
                {submitting ? "저장 중..." : classId ? "수정 완료" : "클래스 개설"}
              </button>
            </>
          )}
        </div>
      </form>

      {submitModal?.kind === "success" && (
        <div className="fixed inset-0 z-[120] bg-black/35 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="px-6 pt-6 pb-5 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path className="modal-check-path" d="m5 12 5 5 9-10" />
                </svg>
              </div>
              <p className="text-base font-semibold text-gray-900">클래스 등록이 완료되었습니다.</p>
            </div>
            <div className="grid grid-cols-2 border-t border-gray-200">
              <button
                type="button"
                className="h-12 text-sm font-semibold text-gray-700 border-r border-gray-200"
                onClick={() => {
                  setSubmitModal(null);
                  router.push("/");
                  router.refresh();
                }}
              >
                전체목록
              </button>
              <button
                type="button"
                className="h-12 text-sm font-semibold text-[#111111]"
                onClick={() => {
                  if (submitModal?.kind !== "success") return;
                  const id = submitModal.newClassId;
                  setSubmitModal(null);
                  router.push(`/classes/${id}`);
                  router.refresh();
                }}
              >
                상세확인
              </button>
            </div>
          </div>
        </div>
      )}

      {submitModal?.kind === "failure" && (
        <div className="fixed inset-0 z-[120] bg-black/35 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="px-6 pt-6 pb-5 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-3">
                <span className="text-red-500 text-2xl font-bold leading-none">!</span>
              </div>
              <p className="text-base font-semibold text-gray-900 mb-1">등록에 실패했습니다.</p>
              <p className="text-sm text-gray-500">{submitModal.message}</p>
            </div>
            <div className="border-t border-gray-200">
              <button
                type="button"
                className="w-full h-12 text-sm font-semibold text-[#111111]"
                onClick={() => {
                  setSubmitModal(null);
                  router.push("/classes/new");
                  router.refresh();
                }}
              >
                만들기 페이지로 이동
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
