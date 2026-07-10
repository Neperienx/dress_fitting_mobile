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

## Production environment

Production builds must use the hosted Supabase project, not the local Supabase URL from development.

Required production variables:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Use [`.env.production.example`](./.env.production.example) as the template for the expected values. Do not commit a real `.env.production` file.

For EAS builds, set the values in the production EAS environment before creating release builds:

```bash
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://your-project-ref.supabase.co
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value your-production-anon-key
```

For local production-style verification, copy the template to `.env.production`, fill in the hosted Supabase values, and start Expo with that env file loaded by your shell/build command. The app intentionally rejects local URLs such as `localhost`, `127.0.0.1`, and `10.0.2.2` in production builds so an app-store build cannot accidentally point at your development machine.

## Debug OpenAI image generation setup

The OpenAI inventory image generator is a development/debug-only feature. It must not be enabled in production builds, and the OpenAI API key must never be committed to git.

On a new machine:

```bash
cd Mobile_version
cp .env.debug.example .env.debug
```

Then open `Mobile_version/.env.debug` and set:

- `EXPO_PUBLIC_ENABLE_OPENAI_INVENTORY_DEBUG=true`
- `EXPO_PUBLIC_DEBUG_OPENAI_API_KEY=your-real-openai-api-key`

The real key file is ignored by git through `Mobile_version/.gitignore`, so it stays local to your machine. After creating or editing the file, fully restart Expo:

```bash
npm run start
```

If the debug generator does not appear, confirm that you are running a development build and that Expo was restarted after editing the env file.

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


## Inventory offline behavior

- Inventory metadata (dresses + image URLs) is cached per store in `AsyncStorage`.
- On each load, the app uses the local cache first and only checks Supabase for changes when the cache is older than ~30 minutes.
- When stale, it fetches only an index (`id + updated_at`) and then downloads only changed/new rows; unchanged rows are reused from local cache.
- Deletions are reconciled by comparing local IDs with remote IDs.
- If the revision in Supabase matches the local revision, no full inventory download is done.
- If a new phone signs in, it will download inventory once and then reuse its local cache.
- Image URLs are prefetched for faster reuse, but canonical storage remains in Supabase + remote image host.

## Troubleshooting

- If you see `Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY`, your `.env` was not loaded.
- If you see `Network request failed`, the host in `EXPO_PUBLIC_SUPABASE_URL` is not reachable from your runtime.
- After editing `.env`, fully restart Expo (`npm run start` again).
- If inventory fails with `Could not find the table 'public.dresses' in the schema cache · code: PGRST205`, your DB is missing the inventory migration. From `Mobile_version/` run `npx supabase db push` (or `npx supabase db reset` for local), then reload the app.
- If you see errors about `updated_at` missing, run `npx supabase db push` to apply migration `004_inventory_updated_at.sql`.
- For physical devices, ensure phone and computer are on the same network and port `54321` is reachable.
- If you see `fontFamily "cursive" is not a system font and has not been loaded through expo-font`, avoid generic CSS family names (`cursive`) in React Native styles. Use a known system family (`serif`, `sans-serif`, etc.) or bundle a real font file with `expo-font`.

### Bundled custom cursive font (long-term / reproducible setup)

`expo-font` is now a direct dependency, so a plain `npm install` includes it automatically.
A `postinstall` check also confirms that the app config keeps both `ios` and `android` enabled.

If you want a fully custom cursive typeface that behaves the same on all devices and builds:

1. Add a font file to source control (for example `Mobile_version/assets/fonts/GreatVibes-Regular.ttf`).
2. Load it at app startup:
   ```ts
   import { useFonts } from 'expo-font';

   const [fontsLoaded] = useFonts({
     BrandCursive: require('../assets/fonts/GreatVibes-Regular.ttf')
   });
   ```
3. Use the loaded family name in styles:
   ```ts
   fontFamily: 'BrandCursive'
   ```

This approach is the most stable because the font is versioned in the repo and bundled with the app instead of relying on device defaults, and it works on both iOS and Android.

## Session shortlist recap sharing

- The shortlist view now includes a **Share shortlist recap** button that creates a pastel SVG recap card using the top three ranked dresses.
- Selection logic:
  - shortlisted dresses are ranked first by the session score;
  - if fewer than three shortlisted dresses exist, the remaining slots are filled from the best-ranked dresses in the full session result.
- The generated recap currently uses an SVG-based soft pink background so it works without bundling a separate image asset.
- If you want to swap in your own JPEG/PNG background:
  1. add the asset to `Mobile_version/assets/` (for example `session-share-background.png`);
  2. resolve it in `SessionScreen.tsx` with `Image.resolveAssetSource(require('../../assets/session-share-background.png')).uri`;
  3. pass that URI into the SVG generator in `src/utils/sessionShare.ts` and render it with an SVG `<image ... />` as the background layer.
