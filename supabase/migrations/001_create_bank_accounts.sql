-- Create bank_accounts table for storing Plaid access tokens
-- This table securely stores the connection between users and their linked bank accounts

CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  item_id TEXT NOT NULL,
  institution_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one bank account per user (can be modified if multi-account support is needed)
  UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON bank_accounts(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own bank accounts
CREATE POLICY "Users can view own bank accounts"
  ON bank_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own bank accounts
CREATE POLICY "Users can insert own bank accounts"
  ON bank_accounts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own bank accounts
CREATE POLICY "Users can update own bank accounts"
  ON bank_accounts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own bank accounts
CREATE POLICY "Users can delete own bank accounts"
  ON bank_accounts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Optional: Add comment for documentation
COMMENT ON TABLE bank_accounts IS 'Stores Plaid access tokens and bank account information for users';
COMMENT ON COLUMN bank_accounts.access_token IS 'Plaid access token - consider encrypting in production';
COMMENT ON COLUMN bank_accounts.item_id IS 'Plaid item ID for the linked account';
