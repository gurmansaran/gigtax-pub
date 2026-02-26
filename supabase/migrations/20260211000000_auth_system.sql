-- ============================================================================
-- GigTax Auth System Migration
-- Complete profiles table with auto-creation trigger and RLS policies
-- Created: 2026-02-11
-- ============================================================================

-- Drop existing profiles table if exists (clean slate)
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ============================================================================
-- PROFILES TABLE
-- Stores user profile data, synced with auth.users
-- ============================================================================
CREATE TABLE public.profiles (
  -- Primary key (matches auth.users.id)
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Basic info
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,

  -- Address
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  home_lat DOUBLE PRECISION,
  home_lng DOUBLE PRECISION,

  -- Tax info
  date_of_birth DATE,
  ssn TEXT, -- Encrypted/hashed in app before storing
  filing_status TEXT CHECK (filing_status IN ('single', 'married_joint', 'married_separate', 'head_household')),

  -- Gig worker specific
  gig_apps TEXT[] DEFAULT '{}', -- Array of selected platforms

  -- Onboarding state
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_step INTEGER DEFAULT 1 CHECK (onboarding_step >= 1 AND onboarding_step <= 5),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- Users can only access their own profile
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: Users can insert their own profile (for edge cases)
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy: Users can delete their own profile
CREATE POLICY "Users can delete own profile"
  ON public.profiles
  FOR DELETE
  USING (auth.uid() = id);

-- ============================================================================
-- AUTO-CREATE PROFILE TRIGGER
-- Automatically creates a profile when a new user signs up
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- UPDATED_AT TRIGGER
-- Automatically updates the updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;

-- Create trigger
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- INDEXES
-- Optimize common queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);
CREATE INDEX IF NOT EXISTS profiles_onboarding_completed_idx ON public.profiles(onboarding_completed);

-- ============================================================================
-- GRANT PERMISSIONS
-- Allow authenticated users to access profiles
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
