-- RPC: add_secure_dependent (SSN encrypted before touching disk)
-- Use this instead of direct INSERT into dependents.
CREATE OR REPLACE FUNCTION add_secure_dependent(name_input TEXT, ssn_input TEXT)
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
