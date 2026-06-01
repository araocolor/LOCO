export type UserRole = "member" | "pro" | "admin";

export interface SearchOptions {
  region?: string;
  period?: string;
  class_type?: string;
  genre?: string;
}

export type ProRequestStatus = "pending" | "approved" | "rejected";

export interface ProRequest {
  id: string;
  user_id: string;
  status: ProRequestStatus;
  message: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  nickname: string;
  role: UserRole;
  profile_image_url: string | null;
  phone: string | null;
  kakao_id: string | null;
  bio: string | null;
  country: string | null;
  region: string | null;
  favorite_genre: string[];
  default_search_options: SearchOptions | null;
  kakao_notification_enabled: boolean;
  created_at: string;
}

export interface StarGiver {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  count: number;
}
