import type { ChatNotice, Message } from "../_types";

export interface ClassShareData {
  type: "class_share";
  message?: string;
  class?: {
    id?: string;
    title?: string;
    image_url?: string | null;
    datetime?: string;
    region?: string;
  };
}

export interface ImageMessageData {
  type: "image";
  thumb: string;
  full: string;
}

export interface VideoMessageData {
  type: "video";
  status?: "uploading" | "processing" | "ready" | "failed";
  video_url?: string;
  thumbnail_url?: string | null;
  error?: string;
}

export interface ParsedMessageContent {
  type?: string;
  message?: string;
  class?: ClassShareData["class"];
  thumb?: string;
  full?: string;
  status?: string;
  video_url?: string;
  thumbnail_url?: string | null;
  error?: string;
}

export type ArchiveItem =
  | { id: string; type: "image"; thumb: string; href: string }
  | { id: string; type: "video"; thumb: string | null; href: string };

export type TimelineItem =
  | { kind: "msg"; at: string; msg: Message }
  | { kind: "notice"; at: string; notice: ChatNotice };

export function parseMessageContent(content: string): ParsedMessageContent | null {
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function getImageMessageData(content: string): ImageMessageData | null {
  const parsed = parseMessageContent(content);
  if (parsed?.type === "image" && typeof parsed.thumb === "string" && typeof parsed.full === "string") {
    return { type: "image", thumb: parsed.thumb, full: parsed.full };
  }
  return null;
}

export function getVideoMessageData(content: string): VideoMessageData | null {
  const parsed = parseMessageContent(content);
  if (parsed?.type !== "video") return null;
  return {
    type: "video",
    status: parsed.status as VideoMessageData["status"],
    video_url: typeof parsed.video_url === "string" ? parsed.video_url : undefined,
    thumbnail_url: typeof parsed.thumbnail_url === "string" ? parsed.thumbnail_url : null,
    error: typeof parsed.error === "string" ? parsed.error : undefined,
  };
}

export function getClassShareData(content: string): ClassShareData | null {
  const parsed = parseMessageContent(content);
  if (parsed?.type !== "class_share") return null;
  return parsed as ClassShareData;
}

export function hasRichMessageContent(content: string) {
  const imageData = getImageMessageData(content);
  const videoData = getVideoMessageData(content);
  const classShareData = getClassShareData(content);
  return Boolean(imageData || videoData || classShareData?.class?.id);
}

export function isProcessingVideoMessage(message: Message) {
  const videoData = getVideoMessageData(message.content);
  return videoData?.status === "processing" || videoData?.status === "uploading";
}

export function isPreviewableTextMessage(
  message: { kind?: "text" | "image" | "file" | "system"; content: string } | null
) {
  if (!message || message.kind === "image" || message.kind === "system") return false;
  const parsed = parseMessageContent(message.content);
  return parsed?.type !== "image" && parsed?.type !== "video";
}

export function getMessagePreviewText(content: string, options?: { isMine?: boolean; truncate?: (content: string) => string }) {
  const parsed = parseMessageContent(content);
  if (parsed?.type === "class_share") return "클래스 공유";
  if (parsed?.type === "image") {
    return options?.isMine ? "사진을 업로드 하였습니다" : "사진이 업로드 되었습니다";
  }
  if (parsed?.type === "video") {
    if (parsed.status === "processing") return "처리중...";
    return options?.isMine ? "영상을 업로드 하였습니다" : "영상이 업로드 되었습니다";
  }
  return options?.truncate ? options.truncate(content) : content;
}

export function getArchiveItems(messages: Message[]): ArchiveItem[] {
  return messages.flatMap<ArchiveItem>((message) => {
    const imageData = getImageMessageData(message.content);
    if (imageData) {
      return [{ id: message.id, type: "image", thumb: imageData.thumb, href: imageData.full }];
    }

    const videoData = getVideoMessageData(message.content);
    if (videoData?.status === "ready" && videoData.video_url) {
      return [{ id: message.id, type: "video", thumb: videoData.thumbnail_url ?? null, href: videoData.video_url }];
    }

    return [];
  });
}

export function buildTimeline(messages: Message[], notices: ChatNotice[], isClassRoom: boolean): TimelineItem[] {
  const items: TimelineItem[] = [
    ...messages.map((msg) => ({ kind: "msg" as const, at: msg.sent_at, msg })),
    ...(isClassRoom ? notices.map((notice) => ({ kind: "notice" as const, at: notice.created_at, notice })) : []),
  ];
  return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export function formatClassShareDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
