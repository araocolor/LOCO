-- Class card social actions: likes, comment likes, and friend shares.

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS share_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS class_likes (
  class_id   UUID        NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (class_id, user_id)
);

ALTER TABLE class_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_likes: 본인 좋아요 조회"
  ON class_likes FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "class_likes: 본인만 생성"
  ON class_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "class_likes: 본인만 삭제"
  ON class_likes FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_class_likes_class_id ON class_likes (class_id);
CREATE INDEX IF NOT EXISTS idx_class_likes_user_id ON class_likes (user_id);

CREATE TABLE IF NOT EXISTS class_comment_likes (
  comment_id UUID        NOT NULL REFERENCES class_comments(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id)
);

ALTER TABLE class_comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_comment_likes: 본인 좋아요 조회"
  ON class_comment_likes FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "class_comment_likes: 본인만 생성"
  ON class_comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "class_comment_likes: 본인만 삭제"
  ON class_comment_likes FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_class_comment_likes_comment_id ON class_comment_likes (comment_id);
CREATE INDEX IF NOT EXISTS idx_class_comment_likes_user_id ON class_comment_likes (user_id);

CREATE TABLE IF NOT EXISTS class_shares (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID        NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  sender_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (sender_id != receiver_id)
);

ALTER TABLE class_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_shares: 참여자만 조회"
  ON class_shares FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

CREATE POLICY "class_shares: 본인만 생성"
  ON class_shares FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE INDEX IF NOT EXISTS idx_class_shares_class_id ON class_shares (class_id);
CREATE INDEX IF NOT EXISTS idx_class_shares_sender_id ON class_shares (sender_id);
CREATE INDEX IF NOT EXISTS idx_class_shares_receiver_id ON class_shares (receiver_id);

UPDATE classes c
SET like_count = counts.count
FROM (
  SELECT class_id, COUNT(*)::INTEGER AS count
  FROM class_likes
  GROUP BY class_id
) counts
WHERE c.id = counts.class_id;

UPDATE classes c
SET comment_count = counts.count
FROM (
  SELECT class_id, COUNT(*)::INTEGER AS count
  FROM class_comments
  GROUP BY class_id
) counts
WHERE c.id = counts.class_id;

UPDATE classes c
SET share_count = counts.count
FROM (
  SELECT class_id, COUNT(*)::INTEGER AS count
  FROM class_shares
  GROUP BY class_id
) counts
WHERE c.id = counts.class_id;
