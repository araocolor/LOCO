-- friend_member_states.state 에 grey 상태를 정식 추가하고
-- 기존 hidden 데이터를 grey로 전환합니다.

ALTER TABLE friend_member_states
  DROP CONSTRAINT IF EXISTS friend_member_states_state_check;

DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'friend_member_states'
      AND c.contype = 'c'
      AND c.conname <> 'friend_member_states_state_check'
      AND pg_get_constraintdef(c.oid) ILIKE '%state%'
      AND pg_get_constraintdef(c.oid) ILIKE '%IN%'
  LOOP
    EXECUTE format('ALTER TABLE friend_member_states DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE friend_member_states
  ADD CONSTRAINT friend_member_states_state_check
  CHECK (state IN ('hidden', 'blocked', 'black', 'grey'));

UPDATE friend_member_states
SET state = 'grey'
WHERE state = 'hidden';
