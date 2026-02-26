-- Add platform column to user_income for structured platform tracking
ALTER TABLE public.user_income
  ADD COLUMN IF NOT EXISTS platform TEXT;

-- Drop existing source constraint and recreate with 'csv' option
ALTER TABLE public.user_income
  DROP CONSTRAINT IF EXISTS user_income_source_check;

ALTER TABLE public.user_income
  ADD CONSTRAINT user_income_source_check
  CHECK (source IN ('plaid', 'screenshot', 'csv'));

-- Create index for platform-based analytics queries
CREATE INDEX IF NOT EXISTS idx_user_income_platform
  ON public.user_income(platform);

-- Create composite index for platform + date analytics
CREATE INDEX IF NOT EXISTS idx_user_income_platform_date
  ON public.user_income(platform, date DESC);
