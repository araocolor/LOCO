export interface Conversation {
  id: string;
  type?: "direct" | "group" | "class";
  title?: string | null;
  member_count?: number;
  members?: Array<{
    user_id: string;
    role: "owner" | "admin" | "member";
    profile: OtherUser | null;
  }>;
  other_user: {
    id: string;
    nickname: string;
    profile_image_url: string | null;
  } | null;
  last_message: {
    id?: string;
    kind?: "text" | "image" | "file" | "system";
    content: string;
    sent_at: string;
    is_mine: boolean;
    read_at?: string | null;
  } | null;
  last_text_message: {
    content: string;
    is_mine: boolean;
  } | null;
  recent_messages?: Message[];
  unread_count: number;
  updated_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id?: string;
  room_id?: string;
  kind?: "text" | "image" | "file" | "system";
  content: string;
  sent_at: string;
  read_at?: string | null;
  sender?: OtherUser | null;
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

export type MessageMenuTab = "messages" | "my-chat" | "nearby";
