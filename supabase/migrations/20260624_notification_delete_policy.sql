DROP POLICY IF EXISTS "notifications: 본인만 삭제" ON notifications;

CREATE POLICY "notifications: 본인만 삭제"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);
