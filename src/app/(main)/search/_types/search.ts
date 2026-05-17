export type Tab = "friends" | "members" | "followings" | "pending";
export type MenuRelation = "mutual" | "following" | "follower" | "none";
export type SocialListMode = "followers" | "mySubscribers" | "subscriptions" | "management" | "following";

export interface Follower {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  bio?: string | null;
  country: string | null;
  region: string | null;
  gender?: "로" | "라" | null;
  member_type?: string[];
  role?: "member" | "pro" | "admin";
  status?: "pending" | "approved" | "friend";
  is_greyed?: boolean;
  is_hidden?: boolean;
  is_blocked?: boolean;
  is_subscribed?: boolean;
  friend_accepted_at?: string | null;
  joined_at?: string | null;
  relation_updated_at?: string | null;
  favorite_genre?: string[];
  created_at?: string | null;
}

export interface DancerMember extends Follower {
  favorite_genre: string[];
  created_at: string | null;
}

export interface MenuTarget {
  id: string;
  nickname: string;
  status?: "pending" | "approved" | "friend";
  relation: MenuRelation;
  x: number;
  y: number;
  placement: "top" | "bottom";
  member: Follower;
  isHidden?: boolean;
  source?: "social" | "members";
}

export interface Suggestion {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  country: string | null;
  region: string | null;
}

export interface PendingMember {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  country: string | null;
  region: string | null;
  state: "hidden" | "blocked" | "black";
  updated_at: string;
}
