-- Plaid Access Token Encryption Migration
-- ============================================================
-- Plaid access tokens are now encrypted at rest using AES-256-GCM
-- inside the Supabase Edge Functions before being stored.
--
-- Encryption is handled server-side in:
--   supabase/functions/exchange-plaid-public-token/index.ts
--   supabase/functions/exchange-plaid-token/index.ts
--
-- Decryption is handled server-side in:
--   supabase/functions/fetch-plaid-transactions/index.ts
--
-- Format stored in the access_token column: "enc:<base64(iv+ciphertext)>"
-- The encryption key is SUPABASE_VAULT_KEY (set in Supabase dashboard secrets).
-- The access_token is NEVER decrypted or returned to the client app.
-- ============================================================

-- Update column comment to reflect encryption
COMMENT ON COLUMN bank_accounts.access_token
  IS 'AES-256-GCM encrypted Plaid access token. Format: enc:<base64>. Decrypted server-side only.';

-- Add comment for user_bank_accounts if the table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_bank_accounts'
  ) THEN
    EXECUTE $inner$
      COMMENT ON COLUMN user_bank_accounts.access_token
        IS 'AES-256-GCM encrypted Plaid access token. Format: enc:<base64>. Decrypted server-side only.';
    $inner$;
  END IF;
END $$;
