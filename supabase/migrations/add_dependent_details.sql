-- Add date_of_birth and relationship to dependents table for CTC/ODC logic.
ALTER TABLE dependents ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE dependents ADD COLUMN IF NOT EXISTS relationship TEXT;

-- Update add_secure_dependent RPC to accept and store the new fields.
CREATE OR REPLACE FUNCTION add_secure_dependent(
  name_input TEXT,
  ssn_input TEXT,
  date_of_birth_input DATE DEFAULT NULL,
  relationship_input TEXT DEFAULT NULL
)
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

  INSERT INTO dependents (user_id, full_name, encrypted_ssn, date_of_birth, relationship, updated_at)
  VALUES (current_user_id, name_input, encrypted_value, date_of_birth_input, relationship_input, NOW())
  RETURNING id INTO dependent_id;

  RETURN dependent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
