'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types';

interface UserProfileContextValue {
  profile: Profile | null;
  isLoading: boolean;
  error: Error | null;
}

const UserProfileContext = createContext<UserProfileContextValue>({
  profile: null,
  isLoading: true,
  error: null,
});

/**
 * Provider that fetches the user profile ONCE and shares it with all consumers.
 * This eliminates duplicate getUser() + profiles queries from sidebar + every page.
 */
export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchProfile() {
      try {
        const supabase = createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (mounted) {
            setProfile(null);
            setIsLoading(false);
          }
          return;
        }

        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (mounted) {
          if (profileError) {
            console.warn('Could not fetch profile:', profileError.message);
            setProfile(null);
          } else {
            setProfile(data as Profile);
          }
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to fetch profile'));
          setIsLoading(false);
        }
      }
    }

    fetchProfile();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <UserProfileContext.Provider value={{ profile, isLoading, error }}>
      {children}
    </UserProfileContext.Provider>
  );
}

/**
 * Hook to access the shared user profile from the context.
 * Must be used within a UserProfileProvider.
 */
export function useUserProfile() {
  return useContext(UserProfileContext);
}
