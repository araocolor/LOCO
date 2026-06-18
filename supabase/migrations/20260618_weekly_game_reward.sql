-- 주간 게임 보상: 매주 금요일 18시(KST) 각 채팅방 1등에게 보유 별 +1 + 알림
-- 1등 기준은 화면 표시와 동일하게 "가장 빨리 깬 사람"(play_duration 최소).
-- 한 사용자가 여러 방 1등이어도 별은 1개만 지급한다(사용자 단위 중복 제거).

-- 1) 알림 타입에 게임 보상 추가
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN (
  'friend_class_created',
  'star_gift_received',
  'class_application',
  'class_comment',
  'class_like',
  'comment_reply',
  'pre_charge_issued',
  'game_weekly_reward'
));

-- 2) 주간 정산 함수
-- 직전 한 주(지난 금요일 18시 ~ 이번 금요일 18시, KST) 기록을 대상으로 한다.
CREATE OR REPLACE FUNCTION grant_weekly_game_rewards()
RETURNS INTEGER AS $$
DECLARE
  v_admin_id UUID;
  v_since TIMESTAMPTZ;
  v_until TIMESTAMPTZ;
  v_rewarded INTEGER := 0;
BEGIN
  -- 알림 보낸 주체로 쓸 관리자 계정
  SELECT id INTO v_admin_id
  FROM profiles
  WHERE nickname = 'blackdog'
    AND role = 'admin'
  LIMIT 1;

  -- 이번 정산 구간: 직전 금요일 18시(KST) ~ 지금. KST = UTC+9 이므로 금요일 18시 KST = 금요일 09시 UTC.
  -- date_trunc로 이번 주 시작을 구한 뒤 금요일 09시(UTC)를 맞춘다.
  v_until := date_trunc('week', NOW()) + interval '4 days 9 hours'; -- 월요일 기준 +4일 = 금요일 09:00 UTC
  IF v_until > NOW() THEN
    v_until := v_until - interval '7 days';
  END IF;
  v_since := v_until - interval '7 days';

  -- 방별 1등(가장 빨리 깬 사람)을 뽑고, 사용자 단위로 중복 제거한 뒤 별 +1 + 알림.
  WITH room_winners AS (
    SELECT DISTINCT ON (room_id)
      room_id,
      user_id,
      play_duration
    FROM game_records
    WHERE game_type = 'breakout'
      AND played_at >= v_since
      AND played_at < v_until
    ORDER BY room_id, play_duration ASC, played_at ASC
  ),
  unique_winners AS (
    SELECT DISTINCT user_id FROM room_winners
  ),
  bumped AS (
    UPDATE star_wallets w
    SET balance = balance + 1,
        updated_at = NOW()
    FROM unique_winners u
    WHERE w.user_id = u.user_id
    RETURNING w.user_id
  )
  INSERT INTO notifications (user_id, actor_id, type, ref_id, meta)
  SELECT
    b.user_id,
    COALESCE(v_admin_id, b.user_id),
    'game_weekly_reward',
    NULL,
    jsonb_build_object('star_count', 1)
  FROM bumped b;

  GET DIAGNOSTICS v_rewarded = ROW_COUNT;
  RETURN v_rewarded;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3) pg_cron 으로 매주 금요일 18시(KST) = 09:00 UTC 자동 실행
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('weekly_game_reward')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly_game_reward');

SELECT cron.schedule(
  'weekly_game_reward',
  '0 9 * * 5',
  $$SELECT public.grant_weekly_game_rewards();$$
);
