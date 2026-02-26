-- Add language_preference column to profiles table
-- Stores user's preferred language ('en' or 'es')
-- Defaults to 'en' (English)

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS language_preference TEXT NOT NULL DEFAULT 'en';

-- Add a check constraint to ensure only valid values
ALTER TABLE profiles
ADD CONSTRAINT chk_language_preference CHECK (language_preference IN ('en', 'es'));

-- Comment for documentation
COMMENT ON COLUMN profiles.language_preference IS 'User preferred language: en (English) or es (Spanish)';
