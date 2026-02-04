'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { UserRole, Profile } from '@/lib/types';
import { PERMISSIONS, type Permission } from '@/lib/rbac-permissions';

// =============================================
// Role Checking Functions
// =============================================

/**
 * Get the current user's profile including role
 */
export async function getCurrentUserProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return profile as Profile | null;
}

/**
 * Get the current user's role
 */
export async function getCurrentUserRole(): Promise<UserRole | null> {
  const profile = await getCurrentUserProfile();
  return profile?.role ?? null;
}

/**
 * Check if current user has a specific permission
 */
export async function hasPermission(permission: Permission): Promise<boolean> {
  const role = await getCurrentUserRole();
  if (!role) return false;
  
  return PERMISSIONS[permission].includes(role);
}

/**
 * Check if current user has at least the minimum required role
 * Role hierarchy: super_admin > admin > staff
 */
export async function hasMinRole(minRole: UserRole): Promise<boolean> {
  const role = await getCurrentUserRole();
  if (!role) return false;

  const roleHierarchy: Record<UserRole, number> = {
    super_admin: 3,
    admin: 2,
    staff: 1,
  };

  return roleHierarchy[role] >= roleHierarchy[minRole];
}

/**
 * Require a specific permission, throws if not authorized
 */
export async function requirePermission(permission: Permission): Promise<void> {
  const allowed = await hasPermission(permission);
  if (!allowed) {
    throw new Error(`Unauthorized: Missing permission ${permission}`);
  }
}

/**
 * Require minimum role level, throws if not authorized
 */
export async function requireRole(minRole: UserRole): Promise<void> {
  const allowed = await hasMinRole(minRole);
  if (!allowed) {
    throw new Error(`Unauthorized: Requires ${minRole} or higher`);
  }
}

// =============================================
// User Management Functions
// =============================================

/**
 * Get all users with their profiles (respects RLS)
 */
export async function getUsers(): Promise<Profile[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }

  return data as Profile[];
}

/**
 * Get users that the current user can manage
 * Super admin: all users
 * Admin: only staff
 */
export async function getManageableUsers(): Promise<Profile[]> {
  const role = await getCurrentUserRole();
  if (!role || role === 'staff') return [];

  const supabase = await createClient();
  
  let query = supabase.from('profiles').select('*');
  
  if (role === 'admin') {
    query = query.eq('role', 'staff');
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching manageable users:', error);
    return [];
  }

  return data as Profile[];
}

/**
 * Create a new user with specified role
 */
export async function createUser(
  email: string,
  password: string,
  role: UserRole,
  fullName?: string
): Promise<{ success: boolean; error?: string; userId?: string }> {
  const currentRole = await getCurrentUserRole();
  
  // Check permissions
  if (!currentRole || currentRole === 'staff') {
    return { success: false, error: 'Unauthorized: Cannot create users' };
  }

  // Admins can only create staff
  if (currentRole === 'admin' && role !== 'staff') {
    return { success: false, error: 'Admins can only create staff accounts' };
  }

  // Super admins can create any role
  const adminSupabase = createAdminClient();

  try {
    const { data, error } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role },
      user_metadata: { full_name: fullName },
    });

    if (error) {
      console.error('Supabase createUser error:', JSON.stringify(error, null, 2));
      throw error;
    }

    // Explicitly update the profile to ensure the role is set correctly
    // This bypasses any issues with the database trigger
    const { error: profileError } = await adminSupabase
      .from('profiles')
      .update({ role, full_name: fullName || null })
      .eq('id', data.user.id);

    if (profileError) {
      console.error('Profile update error:', profileError);
      // If profile update fails, try to insert it
      const { error: insertError } = await adminSupabase
        .from('profiles')
        .insert({ id: data.user.id, role, full_name: fullName || null });
      
      if (insertError) {
        console.error('Profile insert error:', insertError);
      }
    }

    return { success: true, userId: data.user.id };
  } catch (error: any) {
    console.error('createUser caught error:', error);
    return { success: false, error: error.message || 'Database error creating new user' };
  }
}

/**
 * Delete a user (respects role hierarchy)
 */
export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
  const currentRole = await getCurrentUserRole();
  const currentProfile = await getCurrentUserProfile();
  
  if (!currentRole || !currentProfile) {
    return { success: false, error: 'Unauthorized' };
  }

  // Cannot delete yourself
  if (currentProfile.id === userId) {
    return { success: false, error: 'Cannot delete your own account' };
  }

  const adminSupabase = createAdminClient();

  // Get target user's role
  const { data: targetProfile } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!targetProfile) {
    return { success: false, error: 'User not found' };
  }

  const targetRole = targetProfile.role as UserRole;

  // Check role hierarchy
  const roleHierarchy: Record<UserRole, number> = {
    super_admin: 3,
    admin: 2,
    staff: 1,
  };

  if (roleHierarchy[currentRole] <= roleHierarchy[targetRole]) {
    return { success: false, error: 'Cannot delete user with equal or higher role' };
  }

  try {
    const { error } = await adminSupabase.auth.admin.deleteUser(userId);
    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Update a user's role (super_admin only)
 */
export async function updateUserRole(
  userId: string,
  newRole: UserRole
): Promise<{ success: boolean; error?: string }> {
  await requireRole('super_admin');

  const adminSupabase = createAdminClient();

  try {
    const { error } = await adminSupabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
