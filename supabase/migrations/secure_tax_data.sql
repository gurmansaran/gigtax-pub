-- Secure Tax Data Migration
-- Encrypts SSN data for User, Spouse, and Dependents using pgcrypto

-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add encrypted_ssn column to profiles (if profiles table exists)
-- Note: This assumes a profiles table exists. If not, you may need to create it first.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    CREATE TABLE profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'encrypted_ssn'
  ) THEN
    ALTER TABLE profiles ADD COLUMN encrypted_ssn BYTEA;
  END IF;
END $$;

-- Create spouses table
CREATE TABLE IF NOT EXISTS spouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  encrypted_ssn BYTEA NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id) -- One spouse per user
);

-- Create dependents table
CREATE TABLE IF NOT EXISTS dependents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  encrypted_ssn BYTEA NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_spouses_user_id ON spouses(user_id);
CREATE INDEX IF NOT EXISTS idx_dependents_user_id ON dependents(user_id);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE spouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile"
      ON profiles FOR SELECT
      USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
      ON profiles FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile"
      ON profiles FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- RLS Policies for spouses
CREATE POLICY IF NOT EXISTS "Users can view own spouse"
  ON spouses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert own spouse"
  ON spouses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update own spouse"
  ON spouses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete own spouse"
  ON spouses FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for dependents
CREATE POLICY IF NOT EXISTS "Users can view own dependents"
  ON dependents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert own dependents"
  ON dependents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update own dependents"
  ON dependents FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete own dependents"
  ON dependents FOR DELETE
  USING (auth.uid() = user_id);

-- Encryption key (hardcoded for now - should be moved to environment variable in production)
-- In production, use a secure key management system
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_settings WHERE name = 'app.encryption_key'
  ) THEN
    -- Set a default encryption key (REPLACE IN PRODUCTION)
    PERFORM set_config('app.encryption_key', 'GIGTAX_SECRET_KEY_2025', false);
  END IF;
END $$;

-- Function to encrypt SSN
CREATE OR REPLACE FUNCTION encrypt_ssn(ssn_input TEXT)
RETURNS BYTEA AS $$
DECLARE
  encryption_key TEXT := 'GIGTAX_SECRET_KEY_2025'; -- Hardcoded for now
BEGIN
  -- Use pgcrypto's encrypt function with AES encryption
  RETURN pgp_sym_encrypt(ssn_input, encryption_key, 'compress-algo=1, cipher-algo=aes256');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrypt SSN (for server-side use only, not exposed to client)
CREATE OR REPLACE FUNCTION decrypt_ssn(encrypted_ssn BYTEA)
RETURNS TEXT AS $$
DECLARE
  encryption_key TEXT := 'GIGTAX_SECRET_KEY_2025'; -- Hardcoded for now
BEGIN
  RETURN pgp_sym_decrypt(encrypted_ssn, encryption_key, 'compress-algo=1, cipher-algo=aes256');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mask SSN (returns last 4 digits only)
CREATE OR REPLACE FUNCTION mask_ssn(encrypted_ssn BYTEA)
RETURNS TEXT AS $$
DECLARE
  decrypted_ssn TEXT;
BEGIN
  decrypted_ssn := decrypt_ssn(encrypted_ssn);
  RETURN '***-**-' || RIGHT(decrypted_ssn, 4);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC Function: Save User SSN
CREATE OR REPLACE FUNCTION save_user_ssn(ssn_input TEXT)
RETURNS VOID AS $$
DECLARE
  current_user_id UUID := auth.uid();
  encrypted_value BYTEA;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  encrypted_value := encrypt_ssn(ssn_input);
  
  -- Insert or update profile
  INSERT INTO profiles (id, encrypted_ssn, updated_at)
  VALUES (current_user_id, encrypted_value, NOW())
  ON CONFLICT (id) 
  DO UPDATE SET 
    encrypted_ssn = encrypted_value,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC Function: Save Spouse
CREATE OR REPLACE FUNCTION save_spouse(name_input TEXT, ssn_input TEXT)
RETURNS UUID AS $$
DECLARE
  current_user_id UUID := auth.uid();
  encrypted_value BYTEA;
  spouse_id UUID;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  encrypted_value := encrypt_ssn(ssn_input);
  
  -- Insert or update spouse
  INSERT INTO spouses (user_id, full_name, encrypted_ssn, updated_at)
  VALUES (current_user_id, name_input, encrypted_value, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    full_name = name_input,
    encrypted_ssn = encrypted_value,
    updated_at = NOW()
  RETURNING id INTO spouse_id;
  
  RETURN spouse_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC Function: Save Dependent
CREATE OR REPLACE FUNCTION save_dependent(name_input TEXT, ssn_input TEXT)
RETURNS UUID AS $$
DECLARE
  current_user_id UUID := auth.uid();
  encrypted_value BYTEA;
  dependent_id UUID;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  encrypted_value := encrypt_ssn(ssn_input);
  
  INSERT INTO dependents (user_id, full_name, encrypted_ssn, updated_at)
  VALUES (current_user_id, name_input, encrypted_value, NOW())
  RETURNING id INTO dependent_id;
  
  RETURN dependent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get masked user SSN
CREATE OR REPLACE FUNCTION get_user_ssn_masked()
RETURNS TEXT AS $$
DECLARE
  current_user_id UUID := auth.uid();
  encrypted_ssn BYTEA;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT encrypted_ssn INTO encrypted_ssn
  FROM profiles
  WHERE id = current_user_id;

  IF encrypted_ssn IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN mask_ssn(encrypted_ssn);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_spouses_updated_at
  BEFORE UPDATE ON spouses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dependents_updated_at
  BEFORE UPDATE ON dependents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
