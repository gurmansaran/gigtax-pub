# RevenueCat Integration Setup Guide

## ✅ Installation Complete

The RevenueCat SDK has been integrated into your GigTax app. Follow these steps to complete the setup.

## Step 1: Install Packages

Run this command in your project root:

```bash
npx expo install react-native-purchases react-native-purchases-ui
```

**Important**: After installing, you must create an **Expo development build** (not Expo Go) to test subscriptions. RevenueCat requires native dependencies.

```bash
# For iOS
npx expo run:ios

# For Android
npx expo run:android
```

## Step 2: Configure API Key

Your API key is already set in `.env`:

```
EXPO_PUBLIC_REVENUECAT_KEY=test_HgzVYGRbzYMWbFOxGuKMBJiGHcF
```

**Note**: The `test_` prefix indicates this is a **test/sandbox** API key. For production:
- Get your **production** API keys from RevenueCat Dashboard → Project Settings → API Keys
- iOS uses keys starting with `appl_`
- Android uses keys starting with `goog_`
- Update `.env` with the appropriate key for your platform

## Step 3: RevenueCat Dashboard Configuration

### 3.1 Create Entitlement

1. Go to [RevenueCat Dashboard](https://app.revenuecat.com)
2. Navigate to **Project Settings** → **Entitlements**
3. Create a new entitlement:
   - **Identifier**: `pro`
   - **Display Name**: `Gig Tax Pro` (optional, for your reference)

### 3.2 Create Products in App Store Connect / Google Play Console

Create these products in your app's store console:

#### iOS (App Store Connect)
1. Go to **App Store Connect** → Your App → **In-App Purchases**
2. Create two subscriptions:
   - **Product ID**: `monthly` (or `com.saran.gigtax.monthly`) — $14.99/mo with 7-day free trial
   - **Product ID**: `yearly` (or `com.saran.gigtax.yearly`) — $149/yr with 7-day free trial

#### Android (Google Play Console)
1. Go to **Google Play Console** → Your App → **Monetize** → **Subscriptions**
2. Create two subscriptions with the same product IDs as above

### 3.3 Link Products in RevenueCat

1. In RevenueCat Dashboard → **Products**
2. Add your products:
   - `monthly` → Link to App Store / Play Store product
   - `yearly` → Link to App Store / Play Store product

### 3.4 Create Offering

1. Go to **Offerings** → Create a new offering
2. Name it "Default" (or any name)
3. Add packages:
   - Monthly package → Product: `monthly`
   - Yearly package → Product: `yearly`
4. Mark this offering as **Current**

### 3.5 Attach Entitlement

1. In your Offering, ensure all packages grant the `pro` entitlement
2. Or in **Entitlements** → `pro` → Attach products: `monthly`, `yearly`

## Step 4: Code Usage

### Check Pro Status

```typescript
import { useRevenueCat } from '@/lib/CtxProvider';

function MyComponent() {
  const { isPro, customerInfo } = useRevenueCat();
  
  if (isPro) {
    // User has Gig Tax Pro
  }
}
```

### Present Paywall

```typescript
import { useRevenueCat } from '@/lib/CtxProvider';

function MyComponent() {
  const { presentPaywall } = useRevenueCat();
  
  const handleUpgrade = async () => {
    const { success } = await presentPaywall();
    if (success) {
      // Purchase completed or restored
    }
  };
}
```

### Present Paywall Only If Needed

```typescript
const { presentPaywallIfNeeded } = useRevenueCat();

// Only shows if user doesn't have "pro" entitlement
await presentPaywallIfNeeded();
```

### Customer Center (Manage Subscription)

```typescript
const { presentCustomerCenter } = useRevenueCat();

// Opens RevenueCat Customer Center
await presentCustomerCenter();
```

### Purchase Specific Package

```typescript
import { getOfferings, getPackageByIdentifier, purchasePackage } from '@/lib/purchaseService';

const offering = await getOfferings();
const monthlyPkg = getPackageByIdentifier(offering, 'monthly');
if (monthlyPkg) {
  const { customerInfo, error } = await purchasePackage(monthlyPkg);
  if (customerInfo) {
    // Success
  }
}
```

### Restore Purchases

```typescript
import { restorePurchases } from '@/lib/purchaseService';

const { customerInfo, error } = await restorePurchases();
```

## Step 5: Testing

### Sandbox Testing

1. Use **sandbox/test accounts** in App Store Connect / Play Console
2. Test purchases will not charge real money
3. Your test API key (`test_...`) is already configured

### Expo Go Limitation

⚠️ **RevenueCat does NOT work in Expo Go**. You must:
- Create a development build: `npx expo run:ios` or `npx expo run:android`
- Or use EAS Build: `eas build --profile development --platform ios`

### Testing Checklist

- [ ] Install packages: `npx expo install react-native-purchases react-native-purchases-ui`
- [ ] Create development build
- [ ] Configure products in App Store Connect / Play Console
- [ ] Link products in RevenueCat Dashboard
- [ ] Create entitlement `pro` in RevenueCat
- [ ] Create offering with packages
- [ ] Test purchase flow
- [ ] Test restore purchases
- [ ] Test Customer Center
- [ ] Verify entitlement check (`isPro`)

## Step 6: Production

1. **Replace test API key** with production keys:
   - iOS: `appl_...` key
   - Android: `goog_...` key
   - Update `.env` or use environment-specific configs

2. **Verify products** are approved in App Store / Play Store

3. **Test with real accounts** (not sandbox) before release

## Troubleshooting

### "Purchases not available"
- You're likely in Expo Go. Create a development build.

### "No offerings found"
- Check RevenueCat Dashboard → Offerings → Ensure one is marked "Current"
- Verify products are linked and approved

### "Entitlement not active"
- Verify entitlement `pro` exists in RevenueCat Dashboard
- Ensure packages grant the `pro` entitlement
- Check customer info: `customerInfo.entitlements.active['pro']`

### API Key Issues
- Ensure key matches platform (iOS: `appl_`, Android: `goog_`, Test: `test_`)
- Verify key is in `.env` as `EXPO_PUBLIC_REVENUECAT_KEY`

## Files Modified

- ✅ `lib/purchaseService.ts` - Core RevenueCat integration
- ✅ `lib/CtxProvider.tsx` - Context with `useRevenueCat` hook
- ✅ `components/Paywall.tsx` - RevenueCat Paywall UI
- ✅ `app/(tabs)/profile.tsx` - Customer Center & Upgrade button
- ✅ `.env` - API key configuration
- ✅ `package.json` - Added `react-native-purchases-ui`

## Support

- [RevenueCat Docs](https://www.revenuecat.com/docs)
- [React Native Guide](https://www.revenuecat.com/docs/getting-started/installation/react-native)
- [Expo Guide](https://www.revenuecat.com/docs/getting-started/installation/expo)
