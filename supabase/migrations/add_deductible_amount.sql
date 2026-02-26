-- Add deductible_amount column to user_expenses table
ALTER TABLE public.user_expenses
ADD COLUMN IF NOT EXISTS deductible_amount DECIMAL(10, 2);

-- Update existing rows to set deductible_amount = amount (100% deductible by default)
UPDATE public.user_expenses
SET deductible_amount = amount
WHERE deductible_amount IS NULL;

-- Make deductible_amount NOT NULL with default
ALTER TABLE public.user_expenses
ALTER COLUMN deductible_amount SET DEFAULT 0,
ALTER COLUMN deductible_amount SET NOT NULL;
