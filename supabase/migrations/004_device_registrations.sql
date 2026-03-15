-- Device registration for anti-cheat verification
CREATE TABLE IF NOT EXISTS device_registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  source_bundle_id TEXT NOT NULL,
  registered_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(competition_id, user_id)
);

-- RLS
ALTER TABLE device_registrations ENABLE ROW LEVEL SECURITY;

-- Users can read their own registrations
CREATE POLICY "Users can view own device registrations"
  ON device_registrations FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert/update their own registrations
CREATE POLICY "Users can register own devices"
  ON device_registrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own device registrations"
  ON device_registrations FOR UPDATE
  USING (auth.uid() = user_id);

-- Index for fast lookups during sync verification
CREATE INDEX idx_device_reg_comp_user
  ON device_registrations(competition_id, user_id);
