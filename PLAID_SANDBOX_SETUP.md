# Plaid Sandbox Integration - Quick Setup Guide

This guide covers setting up Plaid integration in **Sandbox Mode** for GigTax.

## ✅ What's Already Implemented

1. **Supabase Edge Functions** (ready to deploy):
   - `create-plaid-link-token` - Generates link token for Plaid Link
   - `exchange-plaid-public-token` - Exchanges public token for access token

2. **Database Schema** (`supabase/migrations/001_create_bank_accounts.sql`):
   - Table: `bank_accounts`
   - Columns: `id`, `user_id`, `access_token`, `item_id`, `institution_name`, `created_at`
   - RLS enabled (users can only see their own data)

3. **Frontend Component** (`components/BankLinkButton.tsx`):
   - Fetches link token on mount
   - Integrates with Plaid Link SDK
   - Handles success/error states
   - Alerts "Bank Linked!" on success

## 🚀 Setup Steps

### Step 1: Install Plaid Account

1. Go to https://dashboard.plaid.com/signup
2. Create a free account
3. Navigate to **Team Settings** → **Keys**
4. Copy your **Sandbox** credentials:
   - `client_id` (starts with something like `5f...`)
   - `secret` (starts with `sandbox_...`)

### Step 2: Configure Supabase Secrets

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions** → **Secrets**
3. Add these three secrets:

```
PLAID_CLIENT_ID=your_sandbox_client_id
PLAID_SECRET=your_sandbox_secret_key
PLAID_ENV=sandbox
```

**Important**: Use your **Sandbox** credentials, not Production!

### Step 3: Install React Native Package

```bash
npm install react-native-plaid-link-sdk
```

Or with Expo:
```bash
npx expo install react-native-plaid-link-sdk
```

For iOS:
```bash
cd ios && pod install && cd ..
```

### Step 4: Deploy Edge Functions

**Option A: Using Supabase CLI**

```bash
# Install Supabase CLI if needed
npm install -g supabase

# Login
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy functions
supabase functions deploy create-plaid-link-token
supabase functions deploy exchange-plaid-public-token
```

**Option B: Using Supabase Dashboard**

1. Go to **Edge Functions** in your Supabase Dashboard
2. Click **Create Function**
3. Name: `create-plaid-link-token`
4. Copy/paste contents from `supabase/functions/create-plaid-link-token/index.ts`
5. Click **Deploy**
6. Repeat for `exchange-plaid-public-token`

### Step 5: Run Database Migration

**Option A: Using Supabase CLI**

```bash
supabase db push
```

**Option B: Using Supabase Dashboard**

1. Go to **SQL Editor**
2. Copy contents of `supabase/migrations/001_create_bank_accounts.sql`
3. Paste and click **Run**

### Step 6: Test the Integration

1. Start your app
2. Navigate to a screen that uses `<BankLinkButton />`
3. Click "Connect Primary Bank"
4. You should see Plaid's sandbox interface
5. Use test credentials:
   - **Username**: `user_good`
   - **Password**: `pass_good`
   - **Institution**: Select any test bank (e.g., "First Platypus Bank")

## 🧪 Sandbox Test Credentials

Plaid provides these test credentials for sandbox:

| Field | Value |
|-------|-------|
| Username | `user_good` |
| Password | `pass_good` |
| Institution | Any test bank |

**Common Test Banks:**
- First Platypus Bank
- First Gringotts Bank
- Tattersall Federal Credit Union

## 📋 Verification Checklist

- [ ] Plaid account created
- [ ] Sandbox credentials copied
- [ ] Supabase secrets configured (`PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV=sandbox`)
- [ ] `react-native-plaid-link-sdk` installed
- [ ] Edge Functions deployed
- [ ] Database migration run
- [ ] Tested with sandbox credentials

## 🔍 Troubleshooting

### "Link token not available"
- Check Edge Functions are deployed
- Verify secrets are set in Supabase
- Check function logs in Supabase Dashboard

### "Unauthorized" errors
- Ensure user is logged in
- Verify session token is being passed

### Plaid Link doesn't open
- Check `react-native-plaid-link-sdk` is installed
- For iOS: Run `pod install`
- Check console for errors

### Database errors
- Verify migration was run
- Check RLS policies are enabled
- Ensure user is authenticated

## 🎯 Next Steps (After Sandbox Testing)

Once sandbox is working:

1. **Request Production Access** from Plaid
2. Update `PLAID_ENV` secret to `production`
3. Update `PLAID_CLIENT_ID` and `PLAID_SECRET` to production values
4. Test with real bank accounts

## 📚 Resources

- [Plaid Dashboard](https://dashboard.plaid.com)
- [Plaid Sandbox Docs](https://plaid.com/docs/sandbox/)
- [React Native Plaid Link SDK](https://github.com/plaid/react-native-plaid-link-sdk)
