'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ShieldCheck,
  BarChart3,
  Settings,
  LogOut,
  Sparkles,
  Mail,
  Plane,
  Briefcase,
  Wallet,
  FileText,
  FilePen,
  Percent,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/guides', label: 'Guides', icon: BookOpen },
  { href: '/verification', label: 'Verification Queue', icon: ShieldCheck },
  { href: '/blog', label: 'Blog', icon: FileText },
  { href: '/static-pages', label: 'Static Pages', icon: FilePen },
  { href: '/tour-bookings', label: 'Tour Bookings', icon: Plane },
  { href: '/service-bookings', label: 'Service Bookings', icon: Briefcase },
  { href: '/payouts', label: 'Payouts', icon: Wallet },
  { href: '/commission-rates', label: 'Commission Rates', icon: Percent },
  { href: '/reconciliation', label: 'Reconciliation', icon: ShieldCheck },
  { href: '/financials', label: 'Financials', icon: BarChart3 },
  { href: '/contacts', label: 'Contact Leads', icon: Mail },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-white">
      {/* Logo */}
      <div className="flex items-center gap-2 border-b px-6 py-5">
        <Sparkles className="h-6 w-6 text-purple-600" />
        <div>
          <p className="text-sm font-semibold leading-none text-gray-900">Spiritual California</p>
          <p className="mt-0.5 text-xs text-gray-500">Admin Panel</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-purple-50 text-purple-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              )}
            >
              <Icon className={cn('h-4 w-4', active ? 'text-purple-600' : 'text-gray-400')} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="border-t px-3 py-4">
        <div className="mb-2 px-3">
          <p className="text-sm font-medium text-gray-900">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-xs text-gray-500">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
