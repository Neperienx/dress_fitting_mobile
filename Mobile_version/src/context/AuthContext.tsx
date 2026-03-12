import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Session } from '@supabase/supabase-js';

import { assertSupabaseConfigured, supabase } from '../lib/supabase';

type SignUpInput = {
  username: string;
  password: string;
};

const USERNAME_EMAIL_DOMAIN = 'login.local';

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function usernameToEmail(username: string) {
  const normalizedUsername = normalizeUsername(username);
  if (normalizedUsername.includes('@')) {
    return normalizedUsername;
  }
  return `${normalizedUsername}@${USERNAME_EMAIL_DOMAIN}`;
}

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (username: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      loading,
      signIn: async (username: string, password: string) => {
        assertSupabaseConfigured();
        const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
        if (error) throw error;
      },
      signUp: async ({ username, password }: SignUpInput) => {
        assertSupabaseConfigured();
        const normalizedUsername = normalizeUsername(username);
        const { error } = await supabase.auth.signUp({
          email: usernameToEmail(normalizedUsername),
          password,
          options: {
            data: {
              username: normalizedUsername
            }
          }
        });
        if (error) throw error;
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
      resetPassword: async (username: string) => {
        assertSupabaseConfigured();
        const { error } = await supabase.auth.resetPasswordForEmail(usernameToEmail(username));
        if (error) throw error;
      }
    }),
    [loading, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
