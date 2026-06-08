ALTER TABLE poster_payments
ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'kakao_pay'
CHECK (payment_type IN ('kakao_pay', 'pre_charge'));

COMMENT ON COLUMN poster_payments.payment_type IS '결제 구분: kakao_pay 또는 pre_charge(외상)';

CREATE UNIQUE INDEX IF NOT EXISTS idx_poster_payments_pre_charge_once
  ON poster_payments (user_id)
  WHERE payment_type = 'pre_charge';

CREATE OR REPLACE FUNCTION claim_poster_credit_pre_charge(
  p_user_id UUID,
  p_amount INTEGER DEFAULT 11000,
  p_credit_amount INTEGER DEFAULT 10
)
RETURNS TABLE (charged INTEGER, balance INTEGER) AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_required';
  END IF;

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

  RETURN QUERY SELECT p_credit_amount, v_balance;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'pre_charge_already_used';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
