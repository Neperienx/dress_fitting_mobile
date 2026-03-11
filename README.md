# dress_fitting_mobile
# Bridal Studio Mobile (React Native + Expo)

This folder contains a **fresh mobile app implementation** of the existing Bridal Studio web experience, built from scratch with **React Native + Expo** and designed for a **single codebase targeting both iOS and Android**.

> Scope note: this mobile code lives entirely under `Mobile_version/` and does not modify the web app code.

---

## 1) Goals

- Keep iOS and Android in one shared codebase.
- Reuse the existing backend APIs exposed by `landing_server.py`.
- Start with a practical MVP covering:
  - Owner sign-in by email (prototype style)
  - Stores list + create store
  - Store details + dress photo upload
  - Default swipe session (like/dislike)
- Keep architecture ready for future enhancements (real auth, richer ranking, offline support).

---

## 2) Tech stack

- **Expo SDK 51**
- **React Native 0.74**
- **TypeScript**
- **React Navigation (native stack)**
- **AsyncStorage** for local session persistence
- **expo-image-picker** for photo selection/upload

Why this stack:
- Expo provides the smoothest cross-platform setup and build flow.
- React Navigation gives standard iOS/Android navigation behavior.
- TypeScript keeps contracts with backend payloads explicit.

---

## 3) Project structure

```text
Mobile_version/
├── app.json
├── babel.config.js
├── index.ts
├── package.json
├── tsconfig.json
├── README_Mobile.md
└── src/
    ├── App.tsx
    ├── config.ts
    ├── types.ts
    ├── api/
    │   ├── client.ts
    │   └── stores.ts
    ├── navigation/
    │   └── AppNavigator.tsx
    ├── screens/
    │   ├── LoginScreen.tsx
    │   ├── SessionScreen.tsx
    │   ├── StoreDetailsScreen.tsx
    │   └── StoresScreen.tsx
    └── storage/
        └── session.ts
```

---

## 4) Features implemented

## 4.1 Login screen

- Accepts owner email and stores it locally.
- Restores session on app startup from AsyncStorage.

## 4.2 Stores screen

- Calls `GET /api/stores?owner=<email>`
- Renders all linked stores
- Creates new store via `POST /api/stores`
- Navigates to:
  - Store details screen
  - Session screen

## 4.3 Store details screen

- Shows store metadata
- Uses device gallery picker to select a dress image
- Uploads selected image as `multipart/form-data` to:
  - `POST /api/stores/:id/dress-photo`

## 4.4 Session screen

- Loads default deck from backend:
  - `GET /api/default-dress-photos`
  - `GET /api/default-dress-metadata`
- Displays one card at a time
- Tracks like/dislike interactions locally
- Shows completion summary

---

## 5) Backend compatibility assumptions

This mobile app is wired to the API shape currently exposed by the existing Python server. In particular:

- Stores endpoint requires owner query param.
- Upload endpoint requires `owner_email` in multipart payload.
- Default session endpoints return lists of photo paths and optional tags.

If backend contracts change, update:
- `src/types.ts`
- `src/api/client.ts`
- `src/api/stores.ts`

---

## 6) Configuration

### API base URL

Configured in `src/config.ts` with platform-aware defaults:

- **Android emulator** defaults to `http://10.0.2.2:8000`
- **iOS simulator / web** default to `http://localhost:8000`

You can override for any environment with:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:8000 npm run start
```

For real devices, `localhost` points to the phone itself, so use your machine LAN IP.

### iOS / Android package IDs

Defined in `app.json`:
- `ios.bundleIdentifier`
- `android.package`

Replace these placeholders before production build.

---

## 7) Run locally

From repo root:

```bash
cd Mobile_version
npm install
npm run start
```

Then:
- Press `i` for iOS simulator (macOS + Xcode required)
- Press `a` for Android emulator
- Or scan QR code with Expo Go on device

---