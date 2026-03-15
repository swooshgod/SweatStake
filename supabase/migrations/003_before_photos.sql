ALTER TABLE competitions ADD COLUMN IF NOT EXISTS allow_before_photo boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS before_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid REFERENCES competitions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  uploaded_at timestamptz DEFAULT now(),
  UNIQUE(competition_id, user_id)
);

ALTER TABLE before_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view before photos in their competitions"
  ON before_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM participants p
      WHERE p.competition_id = before_photos.competition_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own before photo"
  ON before_photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);
