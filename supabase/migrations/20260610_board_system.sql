-- ============================================================
-- 커뮤니티 게시판 시스템: board_posts, board_comments, board_post_likes, board_comment_likes
-- 카테고리: notice(공지사항), support(고객센터), free(자유게시판)
-- ============================================================

-- 1. board_posts (게시글)
CREATE TABLE board_posts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category         TEXT        NOT NULL CHECK (category IN ('notice', 'support', 'free')),
  title            TEXT        NOT NULL,
  content          TEXT        NOT NULL DEFAULT '',
  images           JSONB       NOT NULL DEFAULT '[]',
  comment_enabled  BOOLEAN     NOT NULL DEFAULT TRUE,
  is_pinned        BOOLEAN     NOT NULL DEFAULT FALSE,
  view_count       INTEGER     NOT NULL DEFAULT 0,
  like_count       INTEGER     NOT NULL DEFAULT 0,
  comment_count    INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE board_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "board_posts: 전체 조회 허용"
  ON board_posts FOR SELECT USING (true);

CREATE POLICY "board_posts: 회원 작성 (공지사항은 관리자만)"
  ON board_posts FOR INSERT WITH CHECK (
    (category IN ('free', 'support') AND auth.uid() IS NOT NULL)
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "board_posts: 본인 또는 관리자만 수정"
  ON board_posts FOR UPDATE USING (
    auth.uid() = author_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "board_posts: 본인 또는 관리자만 삭제"
  ON board_posts FOR DELETE USING (
    auth.uid() = author_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX idx_board_posts_category ON board_posts (category, created_at DESC);
CREATE INDEX idx_board_posts_author ON board_posts (author_id);
CREATE INDEX idx_board_posts_pinned ON board_posts (is_pinned DESC, created_at DESC);

CREATE TRIGGER board_posts_updated_at
  BEFORE UPDATE ON board_posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 2. board_comments (댓글)
CREATE TABLE board_comments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID        NOT NULL REFERENCES board_posts(id) ON DELETE CASCADE,
  profile_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id   UUID        REFERENCES board_comments(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL,
  like_count  INTEGER     NOT NULL DEFAULT 0,
  is_deleted  BOOLEAN     NOT NULL DEFAULT FALSE,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE board_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "board_comments: 전체 조회 허용"
  ON board_comments FOR SELECT USING (true);

CREATE POLICY "board_comments: 로그인 사용자만 작성"
  ON board_comments FOR INSERT WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "board_comments: 본인 또는 관리자만 수정"
  ON board_comments FOR UPDATE USING (
    auth.uid() = profile_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "board_comments: 본인 또는 관리자만 삭제"
  ON board_comments FOR DELETE USING (
    auth.uid() = profile_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX idx_board_comments_post ON board_comments (post_id, created_at);
CREATE INDEX idx_board_comments_profile ON board_comments (profile_id);
CREATE INDEX idx_board_comments_parent ON board_comments (parent_id);


-- 3. board_post_likes (게시글 좋아요)
CREATE TABLE board_post_likes (
  post_id    UUID        NOT NULL REFERENCES board_posts(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE board_post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "board_post_likes: 전체 조회 허용"
  ON board_post_likes FOR SELECT USING (true);

CREATE POLICY "board_post_likes: 본인만 생성"
  ON board_post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "board_post_likes: 본인만 삭제"
  ON board_post_likes FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_board_post_likes_user ON board_post_likes (user_id);


-- 4. board_comment_likes (댓글 좋아요)
CREATE TABLE board_comment_likes (
  comment_id UUID        NOT NULL REFERENCES board_comments(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id)
);

ALTER TABLE board_comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "board_comment_likes: 전체 조회 허용"
  ON board_comment_likes FOR SELECT USING (true);

CREATE POLICY "board_comment_likes: 본인만 생성"
  ON board_comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "board_comment_likes: 본인만 삭제"
  ON board_comment_likes FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_board_comment_likes_user ON board_comment_likes (user_id);
