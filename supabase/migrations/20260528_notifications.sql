-- Notification system: 알림 테이블 + 6종 이벤트 트리거

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN (
    'friend_class_created',
    'star_gift_received',
    'class_application',
    'class_comment',
    'class_like',
    'comment_reply'
  )),
  ref_id      UUID,
  meta        JSONB       NOT NULL DEFAULT '{}',
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications: 본인만 조회"
  ON notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications: 본인만 수정"
  ON notifications FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_notifications_user_unread ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_user_created ON notifications (user_id, created_at DESC);

-- 1. 친구가 클래스 개설 시 알림
CREATE OR REPLACE FUNCTION notify_friend_class_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, actor_id, type, ref_id, meta)
  SELECT
    f.user_id,
    NEW.host_id,
    'friend_class_created',
    NEW.id,
    jsonb_build_object(
      'class_title', NEW.title,
      'region', COALESCE(NEW.region, ''),
      'category', COALESCE(NEW.category, '')
    )
  FROM friendships f
  WHERE f.friend_id = NEW.host_id
    AND f.status = 'approved'
    AND f.user_id != NEW.host_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_notify_friend_class_created
  AFTER INSERT ON classes
  FOR EACH ROW
  WHEN (NEW.status = 'recruiting')
  EXECUTE FUNCTION notify_friend_class_created();

-- 2. 스타 선물 받았을 때 알림
CREATE OR REPLACE FUNCTION notify_star_gift()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, actor_id, type, ref_id, meta)
  VALUES (
    NEW.receiver_id,
    NEW.giver_id,
    'star_gift_received',
    NEW.id,
    jsonb_build_object('count', NEW.count)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_notify_star_gift
  AFTER INSERT ON star_gifts
  FOR EACH ROW EXECUTE FUNCTION notify_star_gift();

-- 3. 내 클래스에 신청이 왔을 때 알림
CREATE OR REPLACE FUNCTION notify_class_application()
RETURNS TRIGGER AS $$
DECLARE
  v_host_id UUID;
  v_class_title TEXT;
BEGIN
  SELECT host_id, title INTO v_host_id, v_class_title
  FROM classes WHERE id = NEW.class_id;

  IF v_host_id IS NOT NULL AND v_host_id != NEW.applicant_id THEN
    INSERT INTO notifications (user_id, actor_id, type, ref_id, meta)
    VALUES (
      v_host_id,
      NEW.applicant_id,
      'class_application',
      NEW.class_id,
      jsonb_build_object('class_title', v_class_title)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_notify_class_application
  AFTER INSERT ON applications
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION notify_class_application();

-- 4. 내 클래스에 댓글이 달렸을 때 알림
CREATE OR REPLACE FUNCTION notify_class_comment()
RETURNS TRIGGER AS $$
DECLARE
  v_host_id UUID;
  v_class_title TEXT;
BEGIN
  SELECT host_id, title INTO v_host_id, v_class_title
  FROM classes WHERE id = NEW.class_id;

  IF v_host_id IS NOT NULL AND v_host_id != NEW.profile_id AND NEW.parent_id IS NULL THEN
    INSERT INTO notifications (user_id, actor_id, type, ref_id, meta)
    VALUES (
      v_host_id,
      NEW.profile_id,
      'class_comment',
      NEW.class_id,
      jsonb_build_object('class_title', v_class_title)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_notify_class_comment
  AFTER INSERT ON class_comments
  FOR EACH ROW EXECUTE FUNCTION notify_class_comment();

-- 5. 내 클래스에 하트를 남겼을 때 알림
CREATE OR REPLACE FUNCTION notify_class_like()
RETURNS TRIGGER AS $$
DECLARE
  v_host_id UUID;
  v_class_title TEXT;
BEGIN
  SELECT host_id, title INTO v_host_id, v_class_title
  FROM classes WHERE id = NEW.class_id;

  IF v_host_id IS NOT NULL AND v_host_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, actor_id, type, ref_id, meta)
    VALUES (
      v_host_id,
      NEW.user_id,
      'class_like',
      NEW.class_id,
      jsonb_build_object('class_title', v_class_title)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_notify_class_like
  AFTER INSERT ON class_likes
  FOR EACH ROW EXECUTE FUNCTION notify_class_like();

-- 6. 내 댓글에 대댓글이 달렸을 때 알림
CREATE OR REPLACE FUNCTION notify_comment_reply()
RETURNS TRIGGER AS $$
DECLARE
  v_parent_profile_id UUID;
  v_class_title TEXT;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT profile_id INTO v_parent_profile_id
  FROM class_comments WHERE id = NEW.parent_id;

  IF v_parent_profile_id IS NOT NULL AND v_parent_profile_id != NEW.profile_id THEN
    SELECT title INTO v_class_title
    FROM classes WHERE id = NEW.class_id;

    INSERT INTO notifications (user_id, actor_id, type, ref_id, meta)
    VALUES (
      v_parent_profile_id,
      NEW.profile_id,
      'comment_reply',
      NEW.class_id,
      jsonb_build_object('class_title', COALESCE(v_class_title, ''))
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_notify_comment_reply
  AFTER INSERT ON class_comments
  FOR EACH ROW
  WHEN (NEW.parent_id IS NOT NULL)
  EXECUTE FUNCTION notify_comment_reply();
