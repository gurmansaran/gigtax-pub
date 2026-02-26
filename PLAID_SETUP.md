# Plaid Integration Setup Guide

This guide will help you set up Plaid banking integration for GigTax.

## Prerequisites

1. A Plaid account (sign up at https://plaid.com)
2. Supabase project with Edge Functions enabled
3. Environment variables configured

## Step 1: Install Dependencies

**Install the Plaid Link SDK:**

```bash
npm install react-native-plaid-link-sdk
```

**Or if using Expo:**

```bash
npx expo install react-native-plaid-link-sdk
```

**For iOS, you may also need to run:**
```bash
cd ios && pod install && cd ..
```

For iOS, you may also need to run:
```bash
cd ios && pod install && cd ..
```

## Step 2: Configure Plaid Environment Variables

Add these to your Supabase project's Edge Function secrets:

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions** → **Secrets**
3. Add the following secrets:

```
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret_key
PLAID_ENV=sandbox  # or 'development' or 'production'
```

**Important**: Never expose these secrets in your client-side code!

## Step 3: Deploy Supabase Edge Functions

Deploy the Edge Functions to your Supabase project:

```bash
# Install Supabase CLI if you haven't already
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy the functions
supabase functions deploy create-plaid-link-token
supabase functions deploy exchange-plaid-public-token
```

Alternatively, you can deploy via the Supabase Dashboard:
1. Go to **Edge Functions** in your Supabase Dashboard
2. Click **Create Function**
3. Copy the contents of `supabase/functions/create-plaid-link-token/index.ts`
4. Name it `create-plaid-link-token`
5. Repeat for `exchange-plaid-public-token`

## Step 4: Run Database Migration

Run the SQL migration to create the `bank_accounts` table:

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/migrations/001_create_bank_accounts.sql`
4. Click **Run**

Or use the Supabase CLI:

```bash
supabase db push
```

## Step 5: Configure App.json (iOS)

Add Plaid to your `app.json` for iOS URL scheme handling:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "CFBundleURLTypes": [
          {
            "CFBundleURLSchemes": ["gigtax"]
          }
        ]
      }
    }
  }
}
```

## Step 6: Test the Integration

1. Start your app
2. Navigate to the screen where `BankLinkButton` is used
3. Click "Connect Primary Bank"
4. You should see the Plaid Link interface
5. Use Plaid's test credentials (for sandbox mode):
   - Username: `user_good`
   - Password: `pass_good`
   - Institution: Select any test bank

## Security Notes

- ✅ Access tokens are stored securely in Supabase (server-side)
- ✅ All Plaid API calls go through Edge Functions (never from client)
- ✅ Row Level Security (RLS) ensures users can only access their own data
- ⚠️ Consider encrypting `access_token` in production for extra security

## Troubleshooting

### "Link token not available"
- Check that Edge Functions are deployed
- Verify environment variables are set in Supabase
- Check Supabase function logs for errors

### "Unauthorized" errors
- Ensure user is authenticated
- Verify session token is being passed correctly

### iOS Build Issues
- Run `pod install` in the `ios` directory
- Clean build folder: `cd ios && xcodebuild clean`

## Next Steps

1. Create a `fetch-plaid-transactions` Edge Function for secure transaction fetching
2. Implement webhook handling for real-time transaction updates
3. Add support for multiple bank accounts per user (modify the UNIQUE constraint)
4. Add encryption for `access_token` in production
