'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useRole, getRoleLabel, getRoleBadgeColor } from '@/lib/hooks/use-role';
import type { UserRole } from '@/lib/types';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Settings,
  LogOut,
  CreditCard,
  Menu,
  X,
  Activity,
  Shield,
  DollarSign,
} from 'lucide-react';
import { useState, useMemo } from 'react';

// Navigation items with role requirements
interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredRoles?: UserRole[];
}

const allNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Financials', href: '/financials', icon: DollarSign },
  { name: 'Subscribers', href: '/subscribers', icon: Users },
  { name: 'Add New', href: '/subscribers/new', icon: UserPlus },
  { name: 'Activity Logs', href: '/activity-logs', icon: Activity, requiredRoles: ['super_admin', 'admin'] },
  { name: 'Users', href: '/users', icon: Shield, requiredRoles: ['super_admin', 'admin'] },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { role, profile, isLoading } = useRole();

  // Filter navigation based on role
  const navigation = useMemo(() => {
    if (!role) {
      // Show basic nav while loading
      return allNavigation.filter(item => !item.requiredRoles);
    }

    return allNavigation.filter(item => {
      if (!item.requiredRoles) return true;
      return item.requiredRoles.includes(role);
    });
  }, [role]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-6">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
          <CreditCard className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">SubTrack</h1>
          <p className="text-xs text-gray-500">Admin System</p>
        </div>
      </div>

      <Separator className="bg-gray-200" />

      {/* User Info */}
      {isLoading ? (
        <div className="px-4 py-3">
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        profile && (
          <div className="px-4 py-3">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Shield className="w-4 h-4 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                    {/* Show 'User' if full_name is email-like or empty */}
                    {profile.full_name && !profile.full_name.includes('@') ? profile.full_name : 'User'}
                </p>
                <Badge className={`text-xs ${getRoleBadgeColor(profile.role)}`}>
                  {getRoleLabel(profile.role)}
                </Badge>
              </div>
            </div>
          </div>
        )
      )}

      <Separator className="bg-gray-200" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              )}
            >
              <item.icon className={cn('w-5 h-5', isActive && 'text-blue-600')} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-gray-200">
        <Button
          variant="ghost"
          className="w-full justify-start text-gray-500 hover:text-red-600 hover:bg-red-50"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5 mr-3" />
          Sign out
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 py-3 flex items-center justify-between safe-area-inset-top">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
            <CreditCard className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900">SubTrack</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-gray-500 h-10 w-10 touch-target"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile sidebar overlay */}
      <div 
        className={`lg:hidden fixed inset-0 z-30 transition-opacity duration-300 ${mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileOpen(false)}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div
          className={`fixed inset-y-0 left-0 w-72 bg-white border-r border-gray-200 flex flex-col pt-16 shadow-xl transform transition-transform duration-300 ease-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <SidebarContent />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-gray-200">
        <SidebarContent />
      </div>
    </>
  );
}

