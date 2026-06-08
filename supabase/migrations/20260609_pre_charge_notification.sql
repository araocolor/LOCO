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
  'pre_charge_issued'
));

CREATE OR REPLACE FUNCTION claim_poster_credit_pre_charge(
  p_user_id UUID,
  p_amount INTEGER DEFAULT 11000,
  p_credit_amount INTEGER DEFAULT 10
)
RETURNS TABLE (charged INTEGER, balance INTEGER) AS $$
DECLARE
  v_balance INTEGER;
  v_admin_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_required';
  END IF;

  SELECT id INTO v_admin_id
  FROM profiles
  WHERE nickname = 'blackdog'
    AND role = 'admin'
  LIMIT 1;

  INSERT INTO poster_payments (
    user_id,
    tid,
    partner_order_id,
    amount,
    credit_amount,
    status,
    payment_type,
    approved_at
  )
  VALUES (
    p_user_id,
    'pre_charge_' || p_user_id::TEXT || '_' || floor(extract(epoch from clock_timestamp()))::TEXT,
    'pre_charge_' || p_user_id::TEXT || '_' || floor(extract(epoch from clock_timestamp()))::TEXT,
    p_amount,
    p_credit_amount,
    'approved',
    'pre_charge',
    NOW()
  );

  INSERT INTO poster_credits (user_id, balance)
  VALUES (p_user_id, p_credit_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = poster_credits.balance + EXCLUDED.balance,
        updated_at = NOW()
  RETURNING poster_credits.balance INTO v_balance;

  IF v_admin_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, actor_id, type, ref_id, meta)
    VALUES (
      p_user_id,
      v_admin_id,
      'pre_charge_issued',
      NULL,
      jsonb_build_object('credit_amount', p_credit_amount, 'amount', p_amount)
    );
  END IF;

  RETURN QUERY SELECT p_credit_amount, v_balance;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'pre_charge_already_used';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
