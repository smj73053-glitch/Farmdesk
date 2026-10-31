import * as React from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import i18n from '@/i18n';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { profileService } from '@/services/farmService';
import type { Profile, UserPreferences } from '@/types/models';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  preferences: UserPreferences | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, language?: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  refresh: () => Promise<void>;
  saveProfile: (input: Partial<Profile>) => Promise<void>;
  savePreferences: (input: Partial<UserPreferences>) => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

async function loadProfileWithRetry(userId: string): Promise<Profile | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const profile = await profileService.getProfile(userId);
    if (profile) return profile;
    await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = React.useState<Session | null>(null);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [preferences, setPreferences] = React.useState<UserPreferences | null>(null);
  const [loading, setLoading] = React.useState(true);

  const hydrate = React.useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    if (!nextSession?.user) {
      setProfile(null);
      setPreferences(null);
      setLoading(false);
      return;
    }
    try {
      const [nextProfile, nextPreferences] = await Promise.all([
        loadProfileWithRetry(nextSession.user.id),
        profileService.getPreferences(nextSession.user.id),
      ]);
      setProfile(nextProfile);
      setPreferences(nextPreferences);
      const language = nextProfile?.preferred_language;
      if (language && i18n.language !== language) await i18n.changeLanguage(language);
    } catch (error) {
      console.error('Could not hydrate account', error);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    void supabase.auth.getSession().then(({ data }) => hydrate(data.session));

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT') {
        queryClient.clear();
        setSession(null);
        setProfile(null);
        setPreferences(null);
        setLoading(false);
        return;
      }
      void hydrate(nextSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, [hydrate, queryClient]);

  const signIn = React.useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email or password is incorrect.' : error.message);
  }, []);

  const signUp = React.useCallback(async (email: string, password: string, fullName: string, language = 'en') => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim(), preferred_language: language },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) throw new Error(error.message);
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut();
    queryClient.clear();
  }, [queryClient]);

  const sendPasswordReset = React.useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/settings`,
    });
    if (error) throw new Error(error.message);
  }, []);

  const updatePassword = React.useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  }, []);

  const refresh = React.useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await hydrate(data.session);
  }, [hydrate]);

  const saveProfile = React.useCallback(async (input: Partial<Profile>) => {
    if (!session?.user) throw new Error('Please sign in to continue');
    const updated = await profileService.updateProfile(session.user.id, input);
    setProfile(updated);
    if (updated.preferred_language) await i18n.changeLanguage(updated.preferred_language);
  }, [session]);

  const savePreferences = React.useCallback(async (input: Partial<UserPreferences>) => {
    if (!session?.user) throw new Error('Please sign in to continue');
    const updated = await profileService.updatePreferences(session.user.id, input);
    setPreferences(updated);
  }, [session]);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    preferences,
    loading,
    configured: isSupabaseConfigured,
    signIn,
    signUp,
    signOut,
    sendPasswordReset,
    updatePassword,
    refresh,
    saveProfile,
    savePreferences,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
