# Bridal Studio Mobile setup

## 1) Install and run

```bash
cd Mobile_version
npm install
npm run start
```

## 2) Configure auth + database

1. Create a Supabase project.
2. Copy `.env.example` to `.env` and fill both values.
3. Run the SQL in `supabase/migrations/001_init.sql` in Supabase SQL editor.
4. In Supabase Authentication settings, enable Email provider.

## 3) What is ready

- Auth flow with email/password:
  - Sign in
  - Sign up
  - Forgot password
  - Persistent session using AsyncStorage
- File-per-page structure for quick feature expansion:
  - Login, Signup, ForgotPassword, Home, Session, Stores, Alerts
- Placeholder tabs after login aligned with your wireframe directions.

## 4) Next pages to implement

- Swipe card deck on `SessionScreen.tsx`
- Bride profile intake forms
- Dress catalog + tag filters
- Studio/store CRUD and team roles
