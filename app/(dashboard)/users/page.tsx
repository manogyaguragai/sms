import { getCurrentUserProfile, getManageableUsers } from '@/lib/rbac';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import UsersClient from '@/components/users-client';
import type { UserRole } from '@/lib/types';

export default async function UsersPage() {
    const profile = await getCurrentUserProfile();

    if (!profile) {
        redirect('/login');
    }

    // Permission check server-side
    const allowedRoles: UserRole[] = ['super_admin', 'admin'];
    if (!allowedRoles.includes(profile.role)) {
        redirect('/dashboard');
    }

    // Pre-fetch users on the server
    const users = await getManageableUsers();

    const creatableRoles: UserRole[] = profile.role === 'super_admin'
        ? ['admin', 'staff', 'view_only']
        : ['staff', 'view_only'];

    // Enrich user profiles with emails from Supabase Auth (for edit functionality)
    let usersWithEmail = users.map(u => ({ ...u, email: '' }));

    if (profile.role === 'super_admin') {
        try {
            const adminSupabase = createAdminClient();
            const { data: authData } = await adminSupabase.auth.admin.listUsers();
            if (authData?.users) {
                const emailMap = new Map(
                    authData.users.map(u => [u.id, u.email || ''])
                );
                usersWithEmail = users.map(u => ({
                    ...u,
                    email: emailMap.get(u.id) || '',
                }));
            }
        } catch (error) {
            console.error('Failed to fetch user emails:', error);
        }
    }

  return (
      <UsersClient
          profile={profile}
          role={profile.role}
          initialUsers={usersWithEmail}
          creatableRoles={creatableRoles}
          isSuperAdmin={profile.role === 'super_admin'}
      />
  );
}
