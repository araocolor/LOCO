export type BoardCategory = "notice" | "support" | "free";

export interface BoardImage {
  thumbnail: string;
  full: string;
}

export type BoardBlock =
  | { type: "text"; value: string }
  | { type: "image"; thumbnail: string; full: string };

export interface BoardPostAuthor {
  id: string;
  nickname: string;
  profile_image_url: string | null;
}

export interface BoardPost {
  id: string;
  author_id: string;
  category: BoardCategory;
  title: string;
  content: string;
  images: BoardImage[];
  blocks: BoardBlock[];
  comment_enabled: boolean;
  is_pinned: boolean;
  view_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
  author: BoardPostAuthor | null;
  my_liked?: boolean;
}

export interface BoardComment {
  id: string;
  post_id: string;
  profile_id: string;
  parent_id: string | null;
  content: string;
  like_count: number;
  my_liked?: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  profile: { id: string; nickname: string; profile_image_url: string | null } | null;
}
