-- Star system: wallet balance, gift history, and signup grant.

CREATE TABLE IF NOT EXISTS star_wallets (
  user_id    UUID        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  balance    INTEGER     NOT NULL DEFAULT 10 CHECK (balance >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE star_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "star_wallets: 본인만 조회"
  ON star_wallets FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "star_wallets: 본인만 수정"
  ON star_wallets FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE TABLE IF NOT EXISTS star_gifts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  giver_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  count       INTEGER     NOT NULL CHECK (count BETWEEN 1 AND 3),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (giver_id <> receiver_id),
  UNIQUE (giver_id, receiver_id)
);

ALTER TABLE star_gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "star_gifts: 참여자만 조회"
  ON star_gifts FOR SELECT USING (
    auth.uid() = giver_id
    OR auth.uid() = receiver_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "star_gifts: 본인만 생성"
  ON star_gifts FOR INSERT WITH CHECK (auth.uid() = giver_id);

CREATE INDEX IF NOT EXISTS idx_star_gifts_giver_id ON star_gifts (giver_id);
CREATE INDEX IF NOT EXISTS idx_star_gifts_receiver_id ON star_gifts (receiver_id);
CREATE INDEX IF NOT EXISTS idx_star_gifts_created_at ON star_gifts (created_at DESC);

CREATE TRIGGER star_wallets_updated_at
  BEFORE UPDATE ON star_wallets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO public.star_wallets (user_id, balance)
SELECT id, 10
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  nickname_candidate TEXT;
BEGIN
  nickname_candidate := COALESCE(trim(NEW.raw_user_meta_data->>'nickname'), '');

  IF nickname_candidate != '' AND EXISTS (
    SELECT 1 FROM public.profiles WHERE nickname = nickname_candidate
  ) THEN
    nickname_candidate := '';
  END IF;

  BEGIN
    INSERT INTO public.profiles (id, email, nickname)
    VALUES (NEW.id, NEW.email, nickname_candidate)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION
    WHEN unique_violation THEN
      INSERT INTO public.profiles (id, email, nickname)
      VALUES (NEW.id, NEW.email, '')
      ON CONFLICT (id) DO NOTHING;
  END;

  INSERT INTO public.star_wallets (user_id, balance)
  VALUES (NEW.id, 10)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.friendships (user_id, friend_id, status, created_at, updated_at)
  SELECT p.id, NEW.id, 'approved', COALESCE(NEW.created_at, NOW()), COALESCE(NEW.created_at, NOW())
  FROM public.profiles p
  WHERE p.nickname = 'blackdog'
    AND p.id != NEW.id
  ON CONFLICT (user_id, friend_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION grant_star_gift(p_receiver_id UUID, p_count INTEGER)
RETURNS TABLE (gift_id UUID, remaining_balance INTEGER) AS $$
DECLARE
  v_giver_id UUID := auth.uid();
BEGIN
  IF v_giver_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_receiver_id IS NULL THEN
    RAISE EXCEPTION 'receiver_required';
  END IF;

  IF p_receiver_id = v_giver_id THEN
    RAISE EXCEPTION 'cannot_gift_self';
  END IF;

  IF p_count IS NULL OR p_count < 1 OR p_count > 3 THEN
    RAISE EXCEPTION 'invalid_count';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.star_gifts
    WHERE giver_id = v_giver_id
      AND receiver_id = p_receiver_id
  ) THEN
    RAISE EXCEPTION 'gift_already_exists';
  END IF;

  UPDATE public.star_wallets
  SET balance = balance - p_count,
      updated_at = NOW()
  WHERE user_id = v_giver_id
    AND balance >= p_count
  RETURNING balance INTO remaining_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  INSERT INTO public.star_gifts (giver_id, receiver_id, count)
  VALUES (v_giver_id, p_receiver_id, p_count)
  RETURNING id INTO gift_id;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
