-- Create mileage_entries table for Supabase sync
CREATE TABLE IF NOT EXISTS mileage_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  miles NUMERIC(10, 2) NOT NULL DEFAULT 0,
  start_latitude NUMERIC(12, 8),
  start_longitude NUMERIC(12, 8),
  end_latitude NUMERIC(12, 8),
  end_longitude NUMERIC(12, 8),
  business_purpose TEXT,
  duration TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE mileage_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own mileage entries"
  ON mileage_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mileage entries"
  ON mileage_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mileage entries"
  ON mileage_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own mileage entries"
  ON mileage_entries FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_mileage_entries_user_id ON mileage_entries(user_id);
CREATE INDEX idx_mileage_entries_date ON mileage_entries(user_id, date);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_mileage_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_mileage_entries_updated_at
  BEFORE UPDATE ON mileage_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_mileage_entries_updated_at();
