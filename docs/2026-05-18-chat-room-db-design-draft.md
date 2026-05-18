# 채팅방 DB 설계 초안

이 문서는 현재 1:1 메시지 구조를 `1:1`, `그룹`, `클래스` 채팅방으로 확장하기 위한 초안입니다.
아직 실제 `supabase/schema.sql` 또는 운영 DB에 적용하지 않았습니다.
검토용 마이그레이션 SQL은 `supabase/migrations/20260518_chat_rooms.sql`에 작성했습니다.

## 현재 구조 판단

현재 `messages`는 `sender_id`, `receiver_id`를 직접 들고 있어 1:1 대화에는 단순합니다.
하지만 그룹 대화는 수신자가 여러 명이므로 `receiver_id` 하나로는 멤버, 읽음 상태, 나가기, 강퇴를 표현하기 어렵습니다.

`conversations`도 `user_id`, `other_user_id` 중심이라 그룹방 목록을 담기에는 부족합니다.
앞으로는 대화방을 먼저 만들고, 대화방에 멤버와 메시지를 연결하는 구조가 필요합니다.

## 추천 개념

- 1:1 대화도 `chat_rooms`의 한 종류로 저장합니다.
- 1:1 방에 사람을 추가하면 `type`을 `group`으로 바꾸고 멤버를 추가합니다.
- 그룹방에 2명만 남아도 데이터는 `group`으로 유지하고, 화면에서만 1:1처럼 표시합니다.
- 마지막 active 멤버가 나가면 방을 `archived` 처리합니다. 기록 삭제가 확정 정책이면 삭제도 가능하지만, 운영 안정성은 보관 쪽이 낫습니다.
- 클래스 채팅방은 클래스 생성 시 자동 생성하고, 클래스 개설자가 `owner` 역할을 가집니다.
- 클래스 신청이 승인되면 자동 참여, 사용자가 나가면 `left`, 방장이 내보내면 `kicked`로 기록합니다.

## 테이블 초안

```sql
CREATE TABLE chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'direct'
    CHECK (type IN ('direct', 'group', 'class')),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT,
  notice TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  last_message_id UUID,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'left', 'kicked')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  last_read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, user_id)
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'text'
    CHECK (kind IN ('text', 'image', 'file', 'system')),
  content TEXT NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## 추천 인덱스

```sql
CREATE INDEX idx_chat_rooms_type ON chat_rooms(type);
CREATE INDEX idx_chat_rooms_class_id ON chat_rooms(class_id);
CREATE INDEX idx_chat_rooms_last_message_at ON chat_rooms(last_message_at DESC);

CREATE INDEX idx_chat_room_members_user_id ON chat_room_members(user_id);
CREATE INDEX idx_chat_room_members_room_id_status ON chat_room_members(room_id, status);

CREATE INDEX idx_chat_messages_room_id_created_at ON chat_messages(room_id, created_at);
CREATE INDEX idx_chat_messages_sender_id ON chat_messages(sender_id);
```

## 1차 전환 순서

1. 새 테이블을 추가하고 기존 `messages`는 유지합니다.
2. 새 API를 `/api/chat/rooms`, `/api/chat/rooms/[id]/messages`, `/api/chat/rooms/[id]/members` 형태로 만듭니다.
3. 기존 1:1 메시지는 새 구조와 병행 조회하거나, 마이그레이션 스크립트로 `direct` 방을 생성합니다.
4. 메시지 화면은 `room_id` 기반으로 바꿉니다.
5. 안정화 후 기존 `messages`, `conversations` 의존도를 제거합니다.

## 클래스 채팅 자동화

- 클래스 생성 시 `chat_rooms(type='class', class_id=classes.id, owner_id=host_id)`를 생성합니다.
- 생성자는 `chat_room_members.role='owner'`로 자동 추가합니다.
- 신청 승인 시 신청자를 `active` 멤버로 추가합니다.
- 신청 취소나 직접 나가기는 `left`로 변경합니다.
- 강퇴는 `kicked`로 변경하고, 이후 같은 클래스 재신청 정책과 연결해 재입장 가능 여부를 정합니다.

## 추가멤버 슬라이드

- 초기 목록은 `search_prefetch_cache`의 `following` 중 `status === "friend"`인 맞팔 목록을 우선 표시합니다.
- 검색은 전체 회원 ID 검색 API를 별도로 붙입니다.
- 이미 방에 있는 멤버는 체크된 상태로 표시합니다.
- 클릭 시 추가/삭제 토글을 하되, 클래스방에서는 방장만 삭제 또는 강퇴할 수 있게 제한합니다.
