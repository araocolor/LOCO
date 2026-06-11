export interface Conversation {
  id: string;
  type?: "direct" | "group" | "class" | "self";
  class_id?: string | null;
  class_image_url?: string | null;
  title?: string | null;
  notice?: string | null;
  member_count?: number;
  members?: Array<{
    user_id: string;
    role: "owner" | "admin" | "member";
    created_at?: string | null;
    profile: OtherUser | null;
  }>;
  other_user: {
    id: string;
    nickname: string;
    profile_image_url: string | null;
  } | null;
  last_message: {
    id?: string;
    kind?: "text" | "image" | "file" | "system" | "emoji";
    content: string;
    sent_at: string;
    is_mine: boolean;
    sender_id?: string;
    read_at?: string | null;
  } | null;
  last_text_message: {
    content: string;
    is_mine: boolean;
  } | null;
  recent_messages?: Message[];
  unread_count: number;
  updated_at: string;
  created_at?: string;
}

export type NoticeKind = "notice" | "vote";
export type NoticeReactionType = "heart" | "like" | "dislike";
export type NoticeVoteType = "agree" | "disagree" | "abstain";
export type MessageReactionType = "heart" | "like" | "laugh" | "wow" | "sad";

export interface ChatNotice {
  id: string;
  room_id: string;
  author_id: string;
  kind: NoticeKind;
  content: string;
  closes_at: string | null;
  created_at: string;
  updated_at: string;
  read_count: number;
  read_by_me: boolean;
  my_reaction: NoticeReactionType | null;
  reaction_counts: Record<NoticeReactionType, number>;
  my_vote: NoticeVoteType | null;
  vote_counts: Record<NoticeVoteType, number>;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id?: string;
  room_id?: string;
  kind?: "text" | "image" | "file" | "system" | "emoji";
  content: string;
  sent_at: string;
  read_at?: string | null;
  sender?: OtherUser | null;
  my_reaction?: MessageReactionType | null;
  reaction_counts?: Record<MessageReactionType, number>;
  send_status?: "sending" | "failed";
}

export interface OtherUser {
  id: string;
  nickname: string;
  profile_image_url: string | null;
}

export interface MyProfile {
  nickname: string;
  profile_image_url: string | null;
}

export interface SessionClassItem {
  id: string;
  title: string;
  images: { card_url?: string }[] | null;
  status?: string;
  created_at?: string;
}

export type MessageMenuTab = "friends" | "direct" | "groups" | "class";
