ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS ai_poster_request_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'classes_ai_poster_request_id_fkey'
  ) THEN
    ALTER TABLE classes
      ADD CONSTRAINT classes_ai_poster_request_id_fkey
      FOREIGN KEY (ai_poster_request_id)
      REFERENCES ai_poster_requests(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_classes_ai_poster_request_id
  ON classes (ai_poster_request_id);
