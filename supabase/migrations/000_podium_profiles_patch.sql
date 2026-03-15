-- Podium profile columns patch
-- Run this INSTEAD of 001_initial.sql if profiles table already exists (e.g. SkinBase project)
-- Adds Podium-specific columns to existing profiles table

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wallet_address text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_winnings numeric DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS competitions_entered int DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS competitions_won int DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_connect_account_id text;

-- Create competitions table
CREATE TABLE IF NOT EXISTS competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  type text,
  scoring_template jsonb DEFAULT '{"categories": []}'::jsonb,
  scoring_mode text DEFAULT 'relative_improvement',
  is_private boolean DEFAULT false,
  requires_watch boolean DEFAULT false,
  allow_before_photo boolean DEFAULT false,
  start_date date,
  end_date date,
  max_participants int DEFAULT 50,
  entry_fee_cents int DEFAULT 0,
  payment_type text DEFAULT 'stripe' CHECK (payment_type IN ('stripe', 'usdc')),
  prize_pool_cents int DEFAULT 0,
  service_fee_pct numeric DEFAULT 10,
  is_public boolean DEFAULT true,
  invite_code text UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  status text DEFAULT 'open' CHECK (status IN ('open', 'active', 'completed', 'cancelled')),
  winner_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Public competitions viewable by everyone"
  ON competitions FOR SELECT USING (is_public = true OR creator_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Authenticated users can create competitions"
  ON competitions FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY IF NOT EXISTS "Creators can update their competitions"
  ON competitions FOR UPDATE USING (auth.uid() = creator_id);

CREATE INDEX IF NOT EXISTS idx_competitions_status ON competitions(status);
CREATE INDEX IF NOT EXISTS idx_competitions_invite_code ON competitions(invite_code);
CREATE INDEX IF NOT EXISTS idx_competitions_creator ON competitions(creator_id);

-- Participants
CREATE TABLE IF NOT EXISTS participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid REFERENCES competitions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  payment_intent_id text,
  paid boolean DEFAULT false,
  total_points int DEFAULT 0,
  current_streak int DEFAULT 0,
  best_streak int DEFAULT 0,
  rank int,
  UNIQUE(competition_id, user_id)
);

ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Participants viewable by everyone"
  ON participants FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Authenticated users can join"
  ON participants FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update own participation"
  ON participants FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_participants_competition ON participants(competition_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON participants(user_id);

-- Daily logs
CREATE TABLE IF NOT EXISTS daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid REFERENCES participants(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  steps int DEFAULT 0,
  active_calories int DEFAULT 0,
  workout_minutes int DEFAULT 0,
  workout_count int DEFAULT 0,
  data_sources text[],
  anomaly_flags jsonb DEFAULT '[]'::jsonb,
  points_earned int DEFAULT 0,
  auto_synced boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(participant_id, log_date)
);

ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Logs viewable by everyone"
  ON daily_logs FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Users can insert own logs"
  ON daily_logs FOR INSERT WITH CHECK (
    auth.uid() = (SELECT user_id FROM participants WHERE id = participant_id)
  );

CREATE POLICY IF NOT EXISTS "Users can update own logs"
  ON daily_logs FOR UPDATE USING (
    auth.uid() = (SELECT user_id FROM participants WHERE id = participant_id)
  );

-- Before photos
CREATE TABLE IF NOT EXISTS before_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid REFERENCES competitions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  uploaded_at timestamptz DEFAULT now(),
  UNIQUE(competition_id, user_id)
);

ALTER TABLE before_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Members can view before photos"
  ON before_photos FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM participants p
      WHERE p.competition_id = before_photos.competition_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Users can insert own before photo"
  ON before_photos FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Device registrations (anti-cheat)
CREATE TABLE IF NOT EXISTS device_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid REFERENCES competitions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  device_name text,
  device_bundle_id text,
  registered_at timestamptz DEFAULT now(),
  UNIQUE(competition_id, user_id)
);

ALTER TABLE device_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view own device registrations"
  ON device_registrations FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can register own device"
  ON device_registrations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Anomaly flags
CREATE TABLE IF NOT EXISTS anomaly_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid REFERENCES competitions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  date date,
  metric text,
  value numeric,
  reason text,
  severity text CHECK (severity IN ('warn', 'disqualify')),
  reviewed boolean DEFAULT false,
  flagged_at timestamptz DEFAULT now()
);

ALTER TABLE anomaly_flags ENABLE ROW LEVEL SECURITY;

-- Auto-update prize pool when participant pays
CREATE OR REPLACE FUNCTION update_prize_pool()
RETURNS trigger AS $$
BEGIN
  IF new.paid = true THEN
    UPDATE competitions
    SET prize_pool_cents = (
      SELECT COUNT(*) * entry_fee_cents
      FROM participants
      WHERE competition_id = new.competition_id AND paid = true
    )
    WHERE id = new.competition_id;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_participant_paid
  AFTER INSERT OR UPDATE OF paid ON participants
  FOR EACH ROW EXECUTE FUNCTION update_prize_pool();

-- Auto-recalculate rankings when points change
CREATE OR REPLACE FUNCTION recalculate_rankings(comp_id uuid)
RETURNS void AS $$
BEGIN
  WITH ranked AS (
    SELECT id, row_number() OVER (ORDER BY total_points DESC, best_streak DESC) AS new_rank
    FROM participants
    WHERE competition_id = comp_id
  )
  UPDATE participants p
  SET rank = r.new_rank
  FROM ranked r
  WHERE p.id = r.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_participant_points()
RETURNS trigger AS $$
BEGIN
  UPDATE participants
  SET total_points = (
    SELECT COALESCE(SUM(points_earned), 0)
    FROM daily_logs
    WHERE participant_id = new.participant_id
  )
  WHERE id = new.participant_id;

  PERFORM recalculate_rankings(
    (SELECT competition_id FROM participants WHERE id = new.participant_id)
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_daily_log_upsert
  AFTER INSERT OR UPDATE ON daily_logs
  FOR EACH ROW EXECUTE FUNCTION update_participant_points();
