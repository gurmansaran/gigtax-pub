-- Create tax_returns table for wizard state persistence
-- Stores complete TaxReturnState as JSONB for schema flexibility

CREATE TABLE IF NOT EXISTS tax_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tax_year INTEGER NOT NULL DEFAULT 2025,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'filed')),
  current_section INTEGER NOT NULL DEFAULT 0,
  current_sub_step INTEGER NOT NULL DEFAULT 0,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tax_year)
);

ALTER TABLE tax_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tax returns"
  ON tax_returns FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX idx_tax_returns_user_year ON tax_returns(user_id, tax_year);
