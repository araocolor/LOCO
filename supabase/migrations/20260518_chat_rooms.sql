-- ============================================================
-- Chat rooms migration draft
-- 1:1, group, class chat expansion
-- ============================================================
-- 적용 전 확인 필요:
-- - 기존 messages 데이터를 chat_rooms/chat_messages로 옮기는 별도 이관 SQL은 포함하지 않음
-- - 기존 /api/conversations, messages 테이블 의존 코드는 유지됨
-- - 역할 변경/강퇴/공지 변경은 서버 API에서 추가 권한 검사를 한 번 더 하는 것을 권장


-- ============================================================
-- 1. chat_rooms
-- ============================================================
CREATE TABLE chat_rooms (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type                TEXT        NOT NULL DEFAULT 'direct'
                                      CHECK (type IN ('direct', 'group', 'class')),
  status              TEXT        NOT NULL DEFAULT 'active'
                                      CHECK (status IN ('active', 'archived')),
  class_id            UUID        REFERENCES classes(id) ON DELETE CASCADE,
  owner_id            UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  title               TEXT,
  notice              TEXT,
  direct_user_low_id  UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  direct_user_high_id UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_id     UUID,
  last_message_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (
      type = 'direct'
      AND direct_user_low_id IS NOT NULL
      AND direct_user_high_id IS NOT NULL
      AND direct_user_low_id <> direct_user_high_id
    )
    OR
    (
      type <> 'direct'
      AND direct_user_low_id IS NULL
      AND direct_user_high_id IS NULL
    )
  ),
  CHECK (
    (type = 'class' AND class_id IS NOT NULL)
    OR (type <> 'class')
  )
);


-- ============================================================
-- 2. chat_room_members
-- ============================================================
CREATE TABLE chat_room_members (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       UUID        NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role          TEXT        NOT NULL DEFAULT 'member'
                              CHECK (role IN ('owner', 'admin', 'member')),
  status        TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'left', 'kicked')),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at       TIMESTAMPTZ,
  last_read_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, user_id)
);


-- ============================================================
-- 3. chat_messages
-- ============================================================
CREATE TABLE chat_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID        NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind        TEXT        NOT NULL DEFAULT 'text'
                            CHECK (kind IN ('text', 'image', 'file', 'system')),
  content     TEXT        NOT NULL,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE chat_rooms
  ADD CONSTRAINT chat_rooms_last_message_id_fkey
  FOREIGN KEY (last_message_id) REFERENCES chat_messages(id) ON DELETE SET NULL;


-- ============================================================
-- 4. indexes
-- ============================================================
CREATE UNIQUE INDEX idx_chat_rooms_direct_unique
  ON chat_rooms (direct_user_low_id, direct_user_high_id)
  WHERE type = 'direct' AND status = 'active';

CREATE UNIQUE INDEX idx_chat_rooms_class_unique
  ON chat_rooms (class_id)
  WHERE type = 'class' AND status = 'active' AND class_id IS NOT NULL;

CREATE INDEX idx_chat_rooms_type ON chat_rooms (type);
CREATE INDEX idx_chat_rooms_status ON chat_rooms (status);
CREATE INDEX idx_chat_rooms_class_id ON chat_rooms (class_id);
CREATE INDEX idx_chat_rooms_owner_id ON chat_rooms (owner_id);
CREATE INDEX idx_chat_rooms_last_message_at ON chat_rooms (last_message_at DESC);

CREATE INDEX idx_chat_room_members_user_id ON chat_room_members (user_id);
CREATE INDEX idx_chat_room_members_room_id ON chat_room_members (room_id);
CREATE INDEX idx_chat_room_members_room_id_status ON chat_room_members (room_id, status);
CREATE INDEX idx_chat_room_members_user_id_status ON chat_room_members (user_id, status);

CREATE INDEX idx_chat_messages_room_id_created_at ON chat_messages (room_id, created_at);
CREATE INDEX idx_chat_messages_sender_id ON chat_messages (sender_id);


-- ============================================================
-- 5. helper functions for RLS
-- ============================================================
CREATE OR REPLACE FUNCTION is_chat_room_active_member(target_room_id UUID, target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM chat_room_members crm
    JOIN chat_rooms cr ON cr.id = crm.room_id
    WHERE crm.room_id = target_room_id
      AND crm.user_id = target_user_id
      AND crm.status = 'active'
      AND cr.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_chat_room_owner_or_admin(target_room_id UUID, target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM chat_room_members
    WHERE room_id = target_room_id
      AND user_id = target_user_id
      AND status = 'active'
      AND role IN ('owner', 'admin')
  )
  OR EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = target_user_id
      AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ============================================================
-- 6. RLS
-- ============================================================
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_rooms: 참여중인 방만 조회"
  ON chat_rooms FOR SELECT USING (
    is_chat_room_active_member(id, auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "chat_rooms: 방장 또는 관리자만 생성"
  ON chat_rooms FOR INSERT WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "chat_rooms: 방장 또는 관리자만 수정"
  ON chat_rooms FOR UPDATE USING (
    is_chat_room_owner_or_admin(id, auth.uid())
  ) WITH CHECK (
    is_chat_room_owner_or_admin(id, auth.uid())
  );

CREATE POLICY "chat_room_members: 같은 방 참여자만 조회"
  ON chat_room_members FOR SELECT USING (
    user_id = auth.uid()
    OR is_chat_room_active_member(room_id, auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "chat_room_members: 방장 또는 관리자만 추가"
  ON chat_room_members FOR INSERT WITH CHECK (
    is_chat_room_owner_or_admin(room_id, auth.uid())
  );

CREATE POLICY "chat_room_members: 방장 또는 관리자만 수정"
  ON chat_room_members FOR UPDATE USING (
    is_chat_room_owner_or_admin(room_id, auth.uid())
  ) WITH CHECK (
    is_chat_room_owner_or_admin(room_id, auth.uid())
  );

CREATE POLICY "chat_messages: 방 참여자만 조회"
  ON chat_messages FOR SELECT USING (
    is_chat_room_active_member(room_id, auth.uid())
  );

CREATE POLICY "chat_messages: 방 참여자만 발송"
  ON chat_messages FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND is_chat_room_active_member(room_id, auth.uid())
  );

CREATE POLICY "chat_messages: 본인 메시지만 수정"
  ON chat_messages FOR UPDATE USING (
    sender_id = auth.uid()
    AND is_chat_room_active_member(room_id, auth.uid())
  ) WITH CHECK (
    sender_id = auth.uid()
    AND is_chat_room_active_member(room_id, auth.uid())
  );


-- ============================================================
-- 7. triggers
-- ============================================================
CREATE TRIGGER chat_rooms_updated_at
  BEFORE UPDATE ON chat_rooms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER chat_room_members_updated_at
  BEFORE UPDATE ON chat_room_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION set_chat_room_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_rooms
  SET last_message_id = NEW.id,
      last_message_at = NEW.created_at,
      updated_at = NOW()
  WHERE id = NEW.room_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER chat_messages_after_insert
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION set_chat_room_last_message();

CREATE OR REPLACE FUNCTION archive_chat_room_when_empty()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM chat_room_members
    WHERE room_id = NEW.room_id
      AND status = 'active'
  ) THEN
    UPDATE chat_rooms
    SET status = 'archived',
        updated_at = NOW()
    WHERE id = NEW.room_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER chat_room_members_archive_empty_room
  AFTER UPDATE OF status ON chat_room_members
  FOR EACH ROW EXECUTE FUNCTION archive_chat_room_when_empty();


-- ============================================================
-- 8. class chat automation
-- ============================================================
CREATE OR REPLACE FUNCTION ensure_class_chat_room()
RETURNS TRIGGER AS $$
DECLARE
  class_room_id UUID;
BEGIN
  INSERT INTO chat_rooms (type, class_id, owner_id, title)
  VALUES ('class', NEW.id, NEW.host_id, NEW.title)
  ON CONFLICT DO NOTHING;

  SELECT id INTO class_room_id
  FROM chat_rooms
  WHERE type = 'class'
    AND class_id = NEW.id
    AND status = 'active'
  LIMIT 1;

  IF class_room_id IS NOT NULL THEN
    INSERT INTO chat_room_members (room_id, user_id, role, status)
    VALUES (class_room_id, NEW.host_id, 'owner', 'active')
    ON CONFLICT (room_id, user_id) DO UPDATE
      SET role = 'owner',
          status = 'active',
          left_at = NULL,
          updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER classes_create_chat_room
  AFTER INSERT ON classes
  FOR EACH ROW EXECUTE FUNCTION ensure_class_chat_room();

CREATE OR REPLACE FUNCTION sync_class_chat_room()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_rooms
  SET title = NEW.title,
      owner_id = NEW.host_id,
      updated_at = NOW()
  WHERE type = 'class'
    AND class_id = NEW.id
    AND status = 'active';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER classes_sync_chat_room
  AFTER UPDATE OF title, host_id ON classes
  FOR EACH ROW EXECUTE FUNCTION sync_class_chat_room();

CREATE OR REPLACE FUNCTION sync_class_chat_member_from_application()
RETURNS TRIGGER AS $$
DECLARE
  class_room_id UUID;
BEGIN
  SELECT id INTO class_room_id
  FROM chat_rooms
  WHERE type = 'class'
    AND class_id = NEW.class_id
    AND status = 'active'
  LIMIT 1;

  IF class_room_id IS NULL THEN
    INSERT INTO chat_rooms (type, class_id, owner_id, title)
    SELECT 'class', c.id, c.host_id, c.title
    FROM classes c
    WHERE c.id = NEW.class_id
    ON CONFLICT DO NOTHING;

    SELECT id INTO class_room_id
    FROM chat_rooms
    WHERE type = 'class'
      AND class_id = NEW.class_id
      AND status = 'active'
    LIMIT 1;
  END IF;

  IF class_room_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' THEN
    INSERT INTO chat_room_members (room_id, user_id, role, status)
    VALUES (class_room_id, NEW.applicant_id, 'member', 'active')
    ON CONFLICT (room_id, user_id) DO UPDATE
      SET status = 'active',
          left_at = NULL,
          updated_at = NOW();
  ELSIF NEW.status = 'cancelled' THEN
    UPDATE chat_room_members
    SET status = 'left',
        left_at = NOW(),
        updated_at = NOW()
    WHERE room_id = class_room_id
      AND user_id = NEW.applicant_id
      AND role <> 'owner';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER applications_sync_class_chat_member
  AFTER INSERT OR UPDATE OF status ON applications
  FOR EACH ROW EXECUTE FUNCTION sync_class_chat_member_from_application();
