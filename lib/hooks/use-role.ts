'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserRole, Profile } from '@/lib/types';

interface UseRoleResult {
  role: UserRole | null;
  profile: Profile | null;
  isLoading: boolean;
  error: Error | null;
  hasPermission: (permission: Permission) => boolean;
  hasMinRole: (minRole: UserRole) => boolean;
}

// Client-side permission matrix (mirrors server-side)
const PERMISSIONS = {
  VIEW_SUBSCRIBERS: ['super_admin', 'admin', 'staff'] as UserRole[],
  CREATE_SUBSCRIBER: ['super_admin', 'admin', 'staff'] as UserRole[],
  UPDATE_SUBSCRIBER: ['super_admin', 'admin', 'staff'] as UserRole[],
  DELETE_SUBSCRIBER: ['super_admin', 'admin'] as UserRole[],
  VIEW_PAYMENTS: ['super_admin', 'admin', 'staff'] as UserRole[],
  CREATE_PAYMENT: ['super_admin', 'admin', 'staff'] as UserRole[],
  UPDATE_PAYMENT: ['super_admin', 'admin'] as UserRole[],
  DELETE_PAYMENT: ['super_admin', 'admin'] as UserRole[],
  VIEW_USERS: ['super_admin', 'admin'] as UserRole[],
  CREATE_USER: ['super_admin', 'admin'] as UserRole[],
  DELETE_USER: ['super_admin', 'admin'] as UserRole[],
  VIEW_ALL_LOGS: ['super_admin'] as UserRole[],
  VIEW_STAFF_LOGS: ['super_admin', 'admin'] as UserRole[],
  VIEW_COMMUNICATION_LOGS: ['super_admin'] as UserRole[],
  TEST_EMAIL: ['super_admin'] as UserRole[],
  TEST_SMS: ['super_admin'] as UserRole[],
  TRIGGER_CRON: ['super_admin'] as UserRole[],
  EXPORT_DATA: ['super_admin'] as UserRole[],
} as const;

type Permission = keyof typeof PERMISSIONS;

const roleHierarchy: Record<UserRole, number> = {
  super_admin: 3,
  admin: 2,
  staff: 1,
};

/**
 * React hook for accessing current user's role and permissions
 * Caches the profile in memory for the session
 */
export function useRole(): UseRoleResult {
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
            // Profile might not exist yet (migration not run)
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

  const hasPermission = useCallback((permission: Permission): boolean => {
    if (!profile?.role) return false;
    return PERMISSIONS[permission]?.includes(profile.role) ?? false;
  }, [profile?.role]);

  const hasMinRole = useCallback((minRole: UserRole): boolean => {
    if (!profile?.role) return false;
    return roleHierarchy[profile.role] >= roleHierarchy[minRole];
  }, [profile?.role]);

  return {
    role: profile?.role ?? null,
    profile,
    isLoading,
    error,
    hasPermission,
    hasMinRole,
  };
}

/**
 * Get role display label
 */
export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    staff: 'Staff',
  };
  return labels[role] || role;
}

/**
 * Get role badge color class
 */
export function getRoleBadgeColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    super_admin: 'bg-purple-100 text-purple-700 border-purple-200',
    admin: 'bg-blue-100 text-blue-700 border-blue-200',
    staff: 'bg-gray-100 text-gray-700 border-gray-200',
  };
  return colors[role] || 'bg-gray-100 text-gray-700 border-gray-200';
}
