import { getCurrentUserProfile, getManageableUsers } from '@/lib/rbac';
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
        ? ['admin', 'staff']
    : ['staff'];

  return (
      <UsersClient
          profile={profile}
          role={profile.role}
          initialUsers={users}
          creatableRoles={creatableRoles}
      />
  );
}
