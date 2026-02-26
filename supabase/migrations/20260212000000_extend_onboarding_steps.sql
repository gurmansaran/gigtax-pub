-- Extend onboarding_step constraint from 5 to 7 steps
-- Step 6: Plaid bank link
-- Step 7: Paywall / free plan selection

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_onboarding_step_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_onboarding_step_check
  CHECK (onboarding_step >= 1 AND onboarding_step <= 7);
