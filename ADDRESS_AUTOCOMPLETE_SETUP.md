# Address Autocomplete Setup Guide

This guide covers setting up Google Places Autocomplete for the onboarding flow.

## Step 1: Install Dependencies

The `react-native-google-places-autocomplete` package is **not installed**. Run:

```bash
npm install react-native-google-places-autocomplete
```

Or with Expo:

```bash
npx expo install react-native-google-places-autocomplete
```

## Step 2: Get Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Places API**:
   - Navigate to **APIs & Services** → **Library**
   - Search for "Places API"
   - Click **Enable**
4. Create an API Key:
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **API Key**
   - Copy your API key
5. (Recommended) Restrict the API key:
   - Click on the API key to edit it
   - Under **Application restrictions**, select **iOS apps** or **Android apps**
   - Add your app's bundle identifier
   - Under **API restrictions**, select **Restrict key** and choose **Places API**

## Step 3: Configure Environment Variable

Add your Google Maps API key to your `.env` file:

```env
EXPO_PUBLIC_GOOGLE_MAPS_KEY=your_api_key_here
```

**Important**: 
- The `EXPO_PUBLIC_` prefix is required for Expo to expose the variable to the client
- Never commit your API key to version control
- Add `.env` to your `.gitignore` file

## Step 4: Usage

The `AddressSearch` component is already integrated into `app/onboarding/step1.tsx`.

When a user selects an address:
- **Street Address** is automatically filled
- **City** is automatically filled
- **State** is automatically filled (short code, e.g., "CA")
- **Zip Code** is automatically filled

## Component Features

- ✅ Fintech-styled input (white background, clean borders)
- ✅ Map pin icon on the left
- ✅ Professional dropdown with shadow
- ✅ No separator lines
- ✅ Removed "Powered by Google" branding (legally compliant)
- ✅ US addresses only (restricted via `components: 'country:us'`)
- ✅ Auto-fills City, State, and Zip when address is selected

## Troubleshooting

### "EXPO_PUBLIC_GOOGLE_MAPS_KEY is not set"
- Verify your `.env` file has the correct variable name
- Restart your Expo development server after adding the variable
- Check that the variable starts with `EXPO_PUBLIC_`

### Autocomplete not showing results
- Verify Places API is enabled in Google Cloud Console
- Check API key restrictions (should allow Places API)
- Ensure you have billing enabled (Google requires billing for Places API)

### Address components not parsing correctly
- The component uses Google's `address_components` array
- If parsing fails, it falls back to `formatted_address`
- Check Google Places API documentation for address component types

## Cost Considerations

Google Places API has usage-based pricing:
- **Autocomplete (Per Session)**: $2.83 per 1,000 sessions
- **Place Details**: $17 per 1,000 requests

A "session" includes all autocomplete requests from when the user starts typing until they select a place.

**Tip**: Consider implementing request debouncing (already included) and caching to reduce API calls.

## Legal Compliance

The component disables the "Powered by Google" logo by setting `enablePoweredByContainer={false}`. According to Google's terms, you may remove this branding if you:
- Use the Places API for your own business purposes
- Don't redistribute the data
- Provide proper attribution elsewhere in your app

Consider adding a small "Powered by Google" text in your app's settings or footer for full compliance.
