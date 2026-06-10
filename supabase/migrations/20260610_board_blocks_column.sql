-- board_posts에 blocks 컬럼 추가 (텍스트/이미지 블록 순서 보존)
ALTER TABLE board_posts
  ADD COLUMN blocks JSONB NOT NULL DEFAULT '[]';
