'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Settings,
  LogOut,
  CreditCard,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Subscribers', href: '/subscribers', icon: Users },
  { name: 'Add New', href: '/subscribers/new', icon: UserPlus },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);

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
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <CreditCard className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900">SubTrack</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-gray-500"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setMobileOpen(false)}>
          <div
            className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col pt-16"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-gray-200">
        <SidebarContent />
      </div>
    </>
  );
}
