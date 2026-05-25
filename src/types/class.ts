export type ClassStatus = "recruiting" | "closed" | "cancelled";
export type ClassType = "group" | "private";
export type ContentType = "class" | "event";
export type DanceGenre = "salsa" | "bachata" | "chacha" | "kizomba" | "zouk" | "other";
export type ClassCategory =
  | "event"
  | "festival"
  | "regular"
  | "practice"
  | "training"
  | "choreography"
  | "other";
export type ClassLevel = "beginner" | "elementary" | "intermediate" | "advanced" | "all";

export const DANCE_GENRE_LABELS: Record<DanceGenre, string> = {
  salsa: "살사",
  bachata: "바차타",
  chacha: "차차",
  kizomba: "키좀바",
  zouk: "쥬크",
  other: "기타",
};

export const CLASS_CATEGORY_LABELS: Record<ClassCategory, string> = {
  event: "행사/이벤트",
  festival: "페스티발",
  regular: "레벨강습",
  practice: "연습모임",
  training: "1:1강습",
  choreography: "안무반",
  other: "기타",
};

export const CLASS_LEVEL_LABELS: Record<ClassLevel, string> = {
  beginner: "입문",
  elementary: "초급",
  intermediate: "중급",
  advanced: "고급",
  all: "올레벨",
};

export interface ClassImage {
  icon_url: string; // 너비 200px
  card_url: string; // 너비 600px
  full_url: string; // 너비 1024px
}

export interface DanceClass {
  id: string;
  host_id: string;
  title: string;
  genres: DanceGenre[];
  level: ClassLevel;
  class_type: ClassType;
  type: ContentType;
  status: ClassStatus;
  description: string;
  datetime: string;
  deadline: string;
  location_address: string;
  location_lat: number | null;
  location_lng: number | null;
  capacity: number;
  contact: string;
  price: number;
  images: ClassImage[];
  region: string;
  category: ClassCategory | null;
  is_modified: boolean;
  view_count: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  created_at: string;
  updated_at: string;
}
