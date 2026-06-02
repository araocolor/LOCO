CREATE TABLE IF NOT EXISTS ai_poster_requests (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title                    TEXT        NOT NULL DEFAULT '',
  raw_content              TEXT        NOT NULL DEFAULT '',
  prompt_text              TEXT        NOT NULL DEFAULT '',
  source_image_count       INTEGER     NOT NULL DEFAULT 0 CHECK (source_image_count BETWEEN 0 AND 5),
  source_images            JSONB       NOT NULL DEFAULT '[]',
  options                  JSONB       NOT NULL DEFAULT '{}',
  extracted_fields         JSONB       NOT NULL DEFAULT '{}',
  status                   TEXT        NOT NULL DEFAULT 'reviewed'
                                       CHECK (status IN ('reviewed', 'submitted', 'generated', 'failed')),
  generated_image_url      TEXT,
  generated_storage_bucket TEXT,
  generated_storage_path   TEXT,
  generated_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_poster_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_poster_requests: 본인만 조회"
  ON ai_poster_requests FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "ai_poster_requests: 본인만 생성"
  ON ai_poster_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_poster_requests: 본인만 수정"
  ON ai_poster_requests FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "ai_poster_requests: 본인만 삭제"
  ON ai_poster_requests FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_ai_poster_requests_user_created
  ON ai_poster_requests (user_id, created_at DESC);

CREATE TRIGGER ai_poster_requests_updated_at
  BEFORE UPDATE ON ai_poster_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
