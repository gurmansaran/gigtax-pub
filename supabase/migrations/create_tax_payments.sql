-- Create tax_payments table
CREATE TABLE IF NOT EXISTS public.tax_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  quarter TEXT NOT NULL, -- Format: 'Q1 2026', 'Q2 2026', etc.
  date_paid DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.tax_payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can insert their own tax payments"
  ON public.tax_payments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select their own tax payments"
  ON public.tax_payments
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own tax payments"
  ON public.tax_payments
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tax payments"
  ON public.tax_payments
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tax_payments_user_id ON public.tax_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_tax_payments_quarter ON public.tax_payments(quarter);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_tax_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_tax_payments_updated_at
  BEFORE UPDATE ON public.tax_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tax_payments_updated_at();
