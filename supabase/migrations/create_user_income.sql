-- Create user_income table
CREATE TABLE IF NOT EXISTS public.user_income (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('plaid', 'screenshot')),
  description TEXT,
  status TEXT DEFAULT 'verified' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.user_income ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can insert their own income"
  ON public.user_income
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select their own income"
  ON public.user_income
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own income"
  ON public.user_income
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own income"
  ON public.user_income
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_income_user_id ON public.user_income(user_id);
CREATE INDEX IF NOT EXISTS idx_user_income_date ON public.user_income(date DESC);
CREATE INDEX IF NOT EXISTS idx_user_income_amount_date ON public.user_income(amount, date);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_user_income_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_income_updated_at
  BEFORE UPDATE ON public.user_income
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_income_updated_at();
