-- Create user_expenses table
CREATE TABLE IF NOT EXISTS public.user_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  merchant TEXT NOT NULL,
  date DATE NOT NULL,
  category TEXT NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.user_expenses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only insert their own expenses
CREATE POLICY "Users can insert their own expenses"
  ON public.user_expenses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only select their own expenses
CREATE POLICY "Users can select their own expenses"
  ON public.user_expenses
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only update their own expenses
CREATE POLICY "Users can update their own expenses"
  ON public.user_expenses
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own expenses
CREATE POLICY "Users can delete their own expenses"
  ON public.user_expenses
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_expenses_user_id ON public.user_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_expenses_date ON public.user_expenses(date DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_expenses_updated_at
  BEFORE UPDATE ON public.user_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
