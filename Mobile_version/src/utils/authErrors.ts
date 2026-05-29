export function getAuthErrorMessage(error: unknown) {
  const fallbackMessage = 'Something went wrong. Please try again.';
  const message = error instanceof Error ? error.message : String(error || fallbackMessage);

  if (/JSON Parse error:.*Unexpected character:\s*</i.test(message)) {
    return 'Supabase returned an unexpected HTML response. Check EXPO_PUBLIC_SUPABASE_URL in Mobile_version/.env, then fully restart Expo.';
  }

  if (/Network request failed/i.test(message)) {
    return 'Could not reach Supabase. Check your internet connection and EXPO_PUBLIC_SUPABASE_URL in Mobile_version/.env.';
  }

  return message || fallbackMessage;
}
