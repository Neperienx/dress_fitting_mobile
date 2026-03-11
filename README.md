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
cp .env.example .env
# Fill EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
npm run start
```

Then run SQL from `Mobile_version/supabase/migrations/001_init.sql` in your Supabase project.
