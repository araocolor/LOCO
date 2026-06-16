CREATE TABLE notification_settings (
  user_id       UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  chat_all      BOOLEAN NOT NULL DEFAULT TRUE,
  chat_dm       BOOLEAN NOT NULL DEFAULT TRUE,
  chat_group    BOOLEAN NOT NULL DEFAULT TRUE,
  chat_class    BOOLEAN NOT NULL DEFAULT TRUE,
  news_all      BOOLEAN NOT NULL DEFAULT TRUE,
  news_class    BOOLEAN NOT NULL DEFAULT TRUE,
  news_comment  BOOLEAN NOT NULL DEFAULT TRUE,
  class_visibility   TEXT NOT NULL DEFAULT 'public'
    CHECK (class_visibility IN ('public', 'friends', 'private')),
  message_visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (message_visibility IN ('public', 'friends', 'private')),
  friend_alert      BOOLEAN NOT NULL DEFAULT TRUE,
  location_consent  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_settings: 본인만 조회"
  ON notification_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notification_settings: 본인만 수정"
  ON notification_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "notification_settings: 본인만 생성"
  ON notification_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);
