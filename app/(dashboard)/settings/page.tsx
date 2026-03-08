import { getCurrentUserProfile } from '@/lib/rbac';
import { redirect } from 'next/navigation';
import SettingsClient from '@/components/settings-client';
import type { UserRole } from '@/lib/types';

// Permission matrix (same as client-side)
const PERMISSIONS: Record<string, UserRole[]> = {
    TEST_EMAIL: ['super_admin'],
    TEST_SMS: ['super_admin'],
    TRIGGER_CRON: ['super_admin'],
    EXPORT_DATA: ['super_admin'],
};

export default async function SettingsPage() {
    const profile = await getCurrentUserProfile();

    if (!profile) {
        redirect('/login');
    }

    const permissions = {
        canTestEmail: PERMISSIONS.TEST_EMAIL.includes(profile.role),
        canTestSMS: PERMISSIONS.TEST_SMS.includes(profile.role),
        canTriggerCron: PERMISSIONS.TRIGGER_CRON.includes(profile.role),
        canExportData: PERMISSIONS.EXPORT_DATA.includes(profile.role),
  };

    return <SettingsClient profile={profile} permissions={permissions} />;
}
