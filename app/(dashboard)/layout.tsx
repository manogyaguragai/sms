import { Sidebar } from '@/components/sidebar';
import { Toaster } from '@/components/ui/sonner';
import { UserProfileProvider } from '@/lib/hooks/user-profile-context';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProfileProvider>
      <div className="min-h-screen bg-gray-50/50">
        <Sidebar />
        <main className="lg:pl-64">
          <div className="pt-16 lg:pt-0 min-h-screen">
            {children}
          </div>
        </main>
        <Toaster richColors position="top-right" />
      </div>
    </UserProfileProvider>
  );
}

