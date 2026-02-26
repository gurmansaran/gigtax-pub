# GigTax Authentication & Onboarding System

This document explains the rebuilt authentication and onboarding system for the GigTax app.

## Overview

The authentication system consists of:
- **Sign Up** - Create new accounts with email/password
- **Login** - Authenticate existing users
- **Onboarding** - 5-step wizard to collect user profile data
- **Profile Management** - Store and sync user data with Supabase

## Architecture

### Database Schema

The system uses a single `profiles` table in Supabase:

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  home_lat DOUBLE PRECISION,
  home_lng DOUBLE PRECISION,
  date_of_birth DATE,
  ssn TEXT,
  filing_status TEXT,
  gig_apps TEXT[],
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_step INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Key Features

1. **Auto-Profile Creation** - A database trigger automatically creates a profile when a user signs up
2. **Row Level Security** - Users can only access their own profile data
3. **Step Persistence** - Onboarding progress is saved after each step
4. **Session Persistence** - Sessions are stored in AsyncStorage for offline access

## File Structure

```
app/
├── index.tsx           # Entry point - handles auth redirects
├── login.tsx           # Login screen
├── signup.tsx          # Sign up screen
├── onboarding/
│   ├── _layout.tsx     # Onboarding stack layout
│   └── index.tsx       # 5-step onboarding wizard
└── _layout.tsx         # Root layout with providers

lib/
├── supabase.ts         # Supabase client + helper functions
└── CtxProvider.tsx     # Context providers (Auth, RevenueCat, Onboarding, TaxProfile)

supabase/migrations/
└── 20260211000000_auth_system.sql  # Database schema
```

## User Flows

### New User Flow
1. User opens app → Redirected to `/login`
2. User taps "Sign Up" → Redirected to `/signup`
3. User enters email + password → Account created
4. Profile auto-created by trigger → Redirected to `/onboarding`
5. User completes 5 steps (data saved after each) → Redirected to `/(tabs)/dashboard`

### Returning User (Incomplete Onboarding)
1. User opens app → Session restored from AsyncStorage
2. App checks `onboarding_completed` → `false`
3. User redirected to `/onboarding` at their last step

### Returning User (Complete Onboarding)
1. User opens app → Session restored
2. App checks `onboarding_completed` → `true`
3. User redirected to `/(tabs)/dashboard`

### Logout Flow
1. User taps logout → `supabase.auth.signOut()` called
2. Session cleared from AsyncStorage
3. User redirected to `/login`

## Onboarding Steps

| Step | Fields | Database Columns |
|------|--------|------------------|
| 1 | First Name, Last Name | `full_name` |
| 2 | Phone Number | `phone` |
| 3 | Address (Google Places) | `address`, `city`, `state`, `zip`, `home_lat`, `home_lng` |
| 4 | Date of Birth, SSN | `date_of_birth`, `ssn` |
| 5 | Gig Platforms | `gig_apps` |

## Context Providers

### AuthProvider
- Manages Supabase session state
- Listens for auth state changes
- Exports `useAuth()` hook

### OnboardingProvider
- Tracks onboarding completion status
- Checks AsyncStorage first, then database
- Exports `useOnboarding()` hook

### TaxProfileProvider
- Loads profile data from database
- Provides `updateTaxProfile()` for local updates
- Exports `useTaxProfile()` hook

### RevenueCatProvider
- Manages subscription state
- Links user identity to RevenueCat
- Exports `useRevenueCat()` hook

## API Functions

### supabase.ts

```typescript
// Auth helpers
isAuthenticated(): Promise<boolean>
getCurrentUser(): Promise<User | null>
signOut(): Promise<{ error: Error | null }>

// Profile helpers
getUserProfile(userId: string): Promise<Profile | null>
updateUserProfile(userId: string, updates: Partial<Profile>): Promise<{ success: boolean; error?: string }>
getOnboardingStatus(userId: string): Promise<{ completed: boolean; step: number }>
completeOnboarding(userId: string): Promise<{ success: boolean; error?: string }>
```

## Database Migration

To apply the database schema:

1. Go to Supabase Dashboard → SQL Editor
2. Paste the contents of `supabase/migrations/20260211000000_auth_system.sql`
3. Run the SQL

Or use Supabase CLI:
```bash
supabase db push
```

## Security Considerations

1. **SSN Storage** - SSN is base64 encoded before storage. For production, use proper encryption.
2. **RLS Policies** - All profile data is protected by Row Level Security
3. **Password Requirements** - Minimum 8 characters enforced in the UI
4. **Session Management** - Sessions auto-refresh and persist across app restarts

## Testing Checklist

- [ ] Sign up with new email → Profile created → Onboarding starts
- [ ] Complete all 5 onboarding steps → Data saved → Dashboard loads
- [ ] Close app → Reopen → Still logged in → Dashboard loads
- [ ] Log out → Login screen shows
- [ ] Log in with incomplete onboarding → Resumes at correct step
- [ ] Log in with complete onboarding → Dashboard loads
- [ ] Test password reset flow

## Troubleshooting

### "Profile not found" error
- Check if the `on_auth_user_created` trigger exists in Supabase
- Manually insert a profile for testing

### "Permission denied" error
- Verify RLS policies are in place
- Check that the user is authenticated

### Session not persisting
- Verify AsyncStorage is working
- Check Supabase auth settings

## Design System

Colors:
- Background: `#0A0A0A`
- Card: `#1A1A1A`
- Text: `#FFFFFF`
- Text Secondary: `#999999`
- Accent: `#00D395`
- Accent Dark: `#00A878`
- Border: `#333333`
- Error: `#FF3B30`
