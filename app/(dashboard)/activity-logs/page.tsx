import { getCurrentUserProfile } from '@/lib/rbac';
import { redirect } from 'next/navigation';
import { getLogUsers, canViewCommunicationLogs } from '@/app/actions/activity-logs';
import ActivityLogsClient from '@/components/activity-logs-client';
import type { UserRole } from '@/lib/types';

export default async function ActivityLogsPage() {
    const profile = await getCurrentUserProfile();

    if (!profile) {
        redirect('/login');
    }

    // Permission check server-side
    const allowedRoles: UserRole[] = ['super_admin', 'admin'];
    if (!allowedRoles.includes(profile.role)) {
        redirect('/dashboard');
    }

    // Pre-fetch filter options on the server in parallel
    const [users, canViewComms] = await Promise.all([
        getLogUsers(),
        canViewCommunicationLogs(),
    ]);

    return (
      <ActivityLogsClient
          canViewComms={canViewComms}
          initialUsers={users}
      />
  );
}
