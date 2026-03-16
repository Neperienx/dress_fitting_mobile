# Bridal Studio Mobile setup

## 1) Install and run

```bash
cd Mobile_version
npm install
npm run start
```

or 
open docker
npx supabase start
npx expo start -c

## 2) Start Supabase locally

From `Mobile_version/`:

```bash
npx supabase start
npx supabase db reset
```

Then copy the values printed by `supabase start` into `Mobile_version/.env`:

```bash
cp .env.example .env
```

Set:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### Which local URL should I use?

Use the Supabase URL that your app runtime can reach:

- **Android emulator:** `http://10.0.2.2:54321`
- **iOS simulator:** `http://127.0.0.1:54321` (or `http://localhost:54321`)
- **Physical phone (Expo Go):** `http://<your-computer-LAN-IP>:54321` (for example `http://192.168.1.40:54321`)

> Note: the app auto-converts `localhost`/`127.0.0.1` to `10.0.2.2` when running on Android.

## 3) Configure auth + database

1. Keep Email provider enabled in Supabase Authentication settings.
2. If you changed schemas, run `npx supabase db reset` again.

## 4) What is ready

- Auth flow with email/password:
  - Sign in
  - Sign up
  - Forgot password
  - Persistent session using AsyncStorage
- File-per-page structure for quick feature expansion:
  - Login, Signup, ForgotPassword, Home, Session, Stores, Alerts
- Placeholder tabs after login aligned with your wireframe directions.

## 5) Next pages to implement

- Swipe card deck on `SessionScreen.tsx`
- Bride profile intake forms
- Dress catalog + tag filters
- Studio/store CRUD and team roles

## Troubleshooting

- If you see `Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY`, your `.env` was not loaded.
- If you see `Network request failed`, the host in `EXPO_PUBLIC_SUPABASE_URL` is not reachable from your runtime.
- After editing `.env`, fully restart Expo (`npm run start` again).
- If inventory fails with `Could not find the table 'public.dresses' in the schema cache · code: PGRST205`, your DB is missing the inventory migration. From `Mobile_version/` run `npx supabase db push` (or `npx supabase db reset` for local), then reload the app.
- For physical devices, ensure phone and computer are on the same network and port `54321` is reachable.
