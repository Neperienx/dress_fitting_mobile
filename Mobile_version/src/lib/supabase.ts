import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const rawSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function normalizeSupabaseUrl(url?: string) {
  if (!url) {
    return url;
  }

  try {
    const parsedUrl = new URL(url);

    if (Platform.OS === 'android' && (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1')) {
      parsedUrl.hostname = '10.0.2.2';
      return parsedUrl.toString().replace(/\/$/, '');
    }

    return parsedUrl.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
}

const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const missingSupabaseEnvMessage =
  'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to Mobile_version/.env, then restart Expo.';

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Falling back to a placeholder client until env vars are configured.'
  );
}

if (rawSupabaseUrl && supabaseUrl && rawSupabaseUrl !== supabaseUrl) {
  // eslint-disable-next-line no-console
  console.info(`EXPO_PUBLIC_SUPABASE_URL normalized from ${rawSupabaseUrl} to ${supabaseUrl} for ${Platform.OS}.`);
}

export function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(missingSupabaseEnvMessage);
  }
}

const fallbackSupabaseUrl = 'https://placeholder.supabase.co';
const fallbackSupabaseAnonKey = 'placeholder-anon-key';

export const supabase = createClient(
  supabaseUrl ?? fallbackSupabaseUrl,
  supabaseAnonKey ?? fallbackSupabaseAnonKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  }
);
