-- ============================================================
-- dancerfind DB 스키마
-- Supabase SQL Editor에 전체 복사 후 실행
-- ============================================================


-- ============================================================
-- 1. profiles (회원)
-- auth.users와 1:1 연결 — Supabase Auth가 기본 인증 담당
-- ============================================================
CREATE TABLE profiles (
  id                UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             TEXT,
  name              TEXT,
  nickname          TEXT        NOT NULL DEFAULT '',
  default_search_options JSONB DEFAULT NULL,
  preferred_genres  JSONB       NOT NULL DEFAULT '[]',
  kakao_notification_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  role              TEXT        NOT NULL DEFAULT 'member'
                                CHECK (role IN ('member', 'pro', 'admin')),
  profile_image_url TEXT,
  phone             TEXT,
  kakao_id          TEXT        UNIQUE,
  bio               TEXT,
  region            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 본인 프로필만 수정 가능, 전체 조회는 허용
CREATE POLICY "profiles: 전체 조회 허용"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "profiles: 본인만 수정"
  ON profiles FOR UPDATE USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "profiles: 본인만 삽입"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);


-- ============================================================
-- 2. classes (댄스 클래스)
-- ============================================================
CREATE TABLE classes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id          UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL,
  genre            TEXT        NOT NULL,
  level            TEXT        NOT NULL CHECK (level IN ('beginner', 'elementary', 'intermediate', 'advanced', 'all')),
  class_type       TEXT        NOT NULL DEFAULT 'group'
                               CHECK (class_type IN ('group', 'private')),
  status           TEXT        NOT NULL DEFAULT 'recruiting'
                               CHECK (status IN ('recruiting', 'closed', 'cancelled')),
  description      TEXT        NOT NULL DEFAULT '',
  datetime         TIMESTAMPTZ NOT NULL,
  deadline         TIMESTAMPTZ NOT NULL,
  location_address TEXT        NOT NULL DEFAULT '',
  location_lat     FLOAT8,
  location_lng     FLOAT8,
  capacity         INTEGER     NOT NULL CHECK (capacity > 0),
  contact          TEXT        NOT NULL DEFAULT '',
  price            INTEGER     NOT NULL DEFAULT 0 CHECK (price >= 0),
  images           JSONB       NOT NULL DEFAULT '[]',
  type             TEXT        NOT NULL DEFAULT 'class'
                               CHECK (type IN ('class', 'event')),
  is_modified      BOOLEAN     NOT NULL DEFAULT FALSE,
  view_count       INTEGER     NOT NULL DEFAULT 0,
  region           TEXT        NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "classes: 전체 조회 허용"
  ON classes FOR SELECT USING (true);

CREATE POLICY "classes: 로그인 사용자만 개설"
  ON classes FOR INSERT WITH CHECK (auth.uid() = host_id);

CREATE POLICY "classes: 개설자 또는 관리자만 수정"
  ON classes FOR UPDATE USING (
    auth.uid() = host_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "classes: 개설자 또는 관리자만 삭제"
  ON classes FOR DELETE USING (
    auth.uid() = host_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );


-- ============================================================
-- 3. applications (참여 신청)
-- ============================================================
CREATE TABLE applications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id     UUID        NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  applicant_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'approved', 'cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, applicant_id)
);

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- 신청자 본인 + 해당 클래스 개설자만 조회
CREATE POLICY "applications: 본인 신청 조회"
  ON applications FOR SELECT USING (
    auth.uid() = applicant_id
    OR EXISTS (
      SELECT 1 FROM classes WHERE id = class_id AND host_id = auth.uid()
    )
  );

CREATE POLICY "applications: 로그인 사용자만 신청"
  ON applications FOR INSERT WITH CHECK (auth.uid() = applicant_id);

-- 신청자(취소) 또는 개설자(승인/거절) 만 상태 변경
CREATE POLICY "applications: 신청자 또는 개설자만 수정"
  ON applications FOR UPDATE USING (
    auth.uid() = applicant_id
    OR EXISTS (
      SELECT 1 FROM classes WHERE id = class_id AND host_id = auth.uid()
    )
  );


-- ============================================================
-- 4. notifications (알림)
-- ============================================================
CREATE TABLE notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message    TEXT        NOT NULL,
  is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
  type       TEXT        NOT NULL
             CHECK (type IN ('application', 'approved', 'cancelled', 'notice', 'modified')),
  link_url   TEXT,
  related_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications: 본인 알림만 조회"
  ON notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications: 본인 알림만 수정 (읽음 처리)"
  ON notifications FOR UPDATE USING (auth.uid() = user_id);


-- ============================================================
-- updated_at 자동 갱신 트리거
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER classes_updated_at
  BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- 신규 회원 생성 시 profiles 자동 생성 트리거
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  nickname_candidate TEXT;
BEGIN
  nickname_candidate := COALESCE(trim(NEW.raw_user_meta_data->>'nickname'), '');

  IF nickname_candidate != '' AND EXISTS (
    SELECT 1 FROM public.profiles WHERE nickname = nickname_candidate
  ) THEN
    nickname_candidate := '';
  END IF;

  BEGIN
    INSERT INTO public.profiles (id, email, nickname)
    VALUES (NEW.id, NEW.email, nickname_candidate)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION
    WHEN unique_violation THEN
      INSERT INTO public.profiles (id, email, nickname)
      VALUES (NEW.id, NEW.email, '')
      ON CONFLICT (id) DO NOTHING;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================
-- 인덱스
-- ============================================================
CREATE INDEX idx_classes_host_id   ON classes (host_id);
CREATE INDEX idx_classes_status    ON classes (status);
CREATE INDEX idx_classes_region    ON classes (region);
CREATE INDEX idx_classes_datetime  ON classes (datetime);
CREATE INDEX idx_applications_class_id     ON applications (class_id);
CREATE INDEX idx_applications_applicant_id ON applications (applicant_id);
CREATE INDEX idx_notifications_user_id     ON notifications (user_id);
CREATE INDEX idx_notifications_is_read     ON notifications (user_id, is_read);
CREATE INDEX idx_classes_type              ON classes (type);
CREATE INDEX idx_classes_view_count        ON classes (view_count DESC);

-- 닉네임 중복 방지 (빈 문자열 제외)
CREATE UNIQUE INDEX profiles_nickname_unique ON profiles (nickname) WHERE nickname != '';


-- ============================================================
-- 5. pro_requests (프로 등급 신청)
-- ============================================================
CREATE TABLE pro_requests (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status     TEXT        NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'approved', 'rejected')),
  message    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 동시에 여러 pending 요청 방지
CREATE UNIQUE INDEX pro_requests_unique_pending ON pro_requests (user_id) WHERE status = 'pending';

ALTER TABLE pro_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pro_requests: 본인 및 관리자만 조회"
  ON pro_requests FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "pro_requests: 본인만 신청"
  ON pro_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pro_requests: 관리자만 상태 변경"
  ON pro_requests FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER pro_requests_updated_at
  BEFORE UPDATE ON pro_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_pro_requests_user_id ON pro_requests (user_id);
CREATE INDEX idx_pro_requests_status  ON pro_requests (status);


-- ============================================================
-- 6. friendships (친구 관계)
-- ============================================================
CREATE TABLE friendships (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status     TEXT        NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'approved', 'friend')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, friend_id),
  CHECK (user_id != friend_id)
);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friendships: 본인 친구 관계만 조회"
  ON friendships FOR SELECT USING (
    auth.uid() = user_id OR auth.uid() = friend_id
  );

CREATE POLICY "friendships: 본인만 요청"
  ON friendships FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "friendships: 본인만 수정"
  ON friendships FOR UPDATE USING (
    auth.uid() = user_id OR auth.uid() = friend_id
  );

CREATE TRIGGER friendships_updated_at
  BEFORE UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_friendships_user_id ON friendships (user_id);
CREATE INDEX idx_friendships_friend_id ON friendships (friend_id);
CREATE INDEX idx_friendships_status ON friendships (status);


-- ============================================================
-- 7. friend_request_cooldowns (신청취소 재신청 제한)
-- ============================================================
CREATE TABLE friend_request_cooldowns (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cancelled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (requester_id, target_id),
  CHECK (requester_id != target_id)
);

ALTER TABLE friend_request_cooldowns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friend_request_cooldowns: 본인만 조회"
  ON friend_request_cooldowns FOR SELECT USING (auth.uid() = requester_id);

CREATE POLICY "friend_request_cooldowns: 본인만 생성"
  ON friend_request_cooldowns FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "friend_request_cooldowns: 본인만 수정"
  ON friend_request_cooldowns FOR UPDATE USING (auth.uid() = requester_id);

CREATE POLICY "friend_request_cooldowns: 본인만 삭제"
  ON friend_request_cooldowns FOR DELETE USING (auth.uid() = requester_id);

CREATE TRIGGER friend_request_cooldowns_updated_at
  BEFORE UPDATE ON friend_request_cooldowns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_friend_request_cooldowns_requester_id ON friend_request_cooldowns (requester_id);
CREATE INDEX idx_friend_request_cooldowns_target_id ON friend_request_cooldowns (target_id);


-- ============================================================
-- 8. friend_member_states (숨김/차단/블랙 단일 상태)
-- ============================================================
CREATE TABLE friend_member_states (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  state           TEXT        NOT NULL CHECK (state IN ('hidden', 'blocked', 'black')),
  previous_status TEXT        NOT NULL CHECK (previous_status IN ('none', 'pending', 'approved', 'friend')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, target_id),
  CHECK (owner_id != target_id)
);

ALTER TABLE friend_member_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friend_member_states: 본인 관련만 조회"
  ON friend_member_states FOR SELECT USING (
    auth.uid() = owner_id OR auth.uid() = target_id
  );

CREATE POLICY "friend_member_states: 본인만 생성"
  ON friend_member_states FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "friend_member_states: 본인만 수정"
  ON friend_member_states FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "friend_member_states: 본인만 삭제"
  ON friend_member_states FOR DELETE USING (auth.uid() = owner_id);

CREATE TRIGGER friend_member_states_updated_at
  BEFORE UPDATE ON friend_member_states
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_friend_member_states_owner_id ON friend_member_states (owner_id);
CREATE INDEX idx_friend_member_states_target_id ON friend_member_states (target_id);
CREATE INDEX idx_friend_member_states_state ON friend_member_states (state);


-- ============================================================
-- 9. black_reports (사용자 신고 누적)
-- ============================================================
CREATE TABLE black_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reporter_id, target_id),
  CHECK (reporter_id != target_id)
);

ALTER TABLE black_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "black_reports: 본인 신고만 조회"
  ON black_reports FOR SELECT USING (
    auth.uid() = reporter_id OR auth.uid() = target_id
  );

CREATE POLICY "black_reports: 본인만 신고"
  ON black_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "black_reports: 본인 신고만 수정"
  ON black_reports FOR UPDATE USING (auth.uid() = reporter_id);

CREATE POLICY "black_reports: 본인 신고만 삭제"
  ON black_reports FOR DELETE USING (auth.uid() = reporter_id);

CREATE TRIGGER black_reports_updated_at
  BEFORE UPDATE ON black_reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_black_reports_reporter_id ON black_reports (reporter_id);
CREATE INDEX idx_black_reports_target_id ON black_reports (target_id);
CREATE INDEX idx_black_reports_created_at ON black_reports (created_at);


-- ============================================================
-- 10. messages (1:1 메시지)
-- ============================================================
CREATE TABLE messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at     TIMESTAMPTZ,
  deleted_by  JSONB       NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (sender_id != receiver_id)
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages: 발신자와 수신자만 조회"
  ON messages FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

CREATE POLICY "messages: 로그인 사용자만 발송"
  ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "messages: 발신자와 수신자만 삭제"
  ON messages FOR UPDATE USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

CREATE INDEX idx_messages_sender_id ON messages (sender_id);
CREATE INDEX idx_messages_receiver_id ON messages (receiver_id);
CREATE INDEX idx_messages_sent_at ON messages (sent_at DESC);
CREATE INDEX idx_messages_conversation ON messages (
  LEAST(sender_id, receiver_id),
  GREATEST(sender_id, receiver_id),
  sent_at DESC
);


-- ============================================================
-- 8. conversations (메시지 목록 최적화)
-- ============================================================
CREATE TABLE conversations (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  other_user_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_id UUID       REFERENCES messages(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ,
  unread_count   INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, other_user_id),
  CHECK (user_id != other_user_id)
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations: 본인 대화만 조회"
  ON conversations FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "conversations: 본인만 수정"
  ON conversations FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_conversations_user_id ON conversations (user_id);
CREATE INDEX idx_conversations_updated_at ON conversations (user_id, updated_at DESC);


-- ============================================================
-- 9. user_settings (사용자 설정)
-- ============================================================
CREATE TABLE user_settings (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  message_from TEXT       NOT NULL DEFAULT 'anyone'
             CHECK (message_from IN ('anyone', 'friends_only')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_settings: 본인만 조회"
  ON user_settings FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_settings: 본인만 수정"
  ON user_settings FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_user_settings_user_id ON user_settings (user_id);


-- ============================================================
-- 신규 회원 생성 시 user_settings 자동 생성
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id, message_from)
  VALUES (NEW.id, 'anyone')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created_settings
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_settings();
