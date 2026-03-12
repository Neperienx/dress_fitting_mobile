# dress_fitting_mobile

React Native + Expo starter for a bridal studio mobile app.

## What is included

- `Mobile_version/` Expo TypeScript app
- Email/password auth via Supabase
- Persistent auth session with AsyncStorage
- One-file-per-page screens:
  - `LoginScreen`
  - `SignupScreen`
  - `ForgotPasswordScreen`
  - `HomeScreen`
  - `SessionScreen` (placeholder)
  - `StoresScreen` (placeholder)
  - `AlertsScreen` (placeholder)
- Supabase SQL migration with profiles + studios tables and RLS policies

## Quick start

```bash
cd Mobile_version
npm install
npx supabase start
npx supabase db reset
cp .env.example .env
# Fill EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY from Supabase CLI output
npm run start
```

## Local Supabase URL guide

Use a URL your runtime can access:

- Android emulator: `http://10.0.2.2:54321`
- iOS simulator: `http://127.0.0.1:54321`
- Physical device: `http://<your-computer-LAN-IP>:54321`

Full setup/troubleshooting is in `Mobile_version/README_Mobile.md`.
