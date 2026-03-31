'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AdminHeader } from '@/components/admin/header';
import { StatsCard } from '@/components/admin/stats-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, BookOpen, Calendar, DollarSign, ShieldCheck, TrendingUp } from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  totalGuides: number;
  totalBookings: number;
  totalRevenue: number;
  pendingVerifications: number;
  newUsersThisWeek: number;
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="flex items-center gap-4 p-6">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/admin/dashboard');
      return data;
    },
    // Fallback to mock data if endpoint not ready yet
    placeholderData: {
      totalUsers: 0,
      totalGuides: 0,
      totalBookings: 0,
      totalRevenue: 0,
      pendingVerifications: 0,
      newUsersThisWeek: 0,
    },
  });

  return (
    <div className="flex flex-col overflow-hidden">
      <AdminHeader title="Dashboard" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-7xl space-y-6">

          {/* Stats Grid */}
          {isLoading ? (
            <StatsSkeleton />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatsCard
                title="Total Users"
                value={stats?.totalUsers ?? 0}
                icon={Users}
                iconColor="text-blue-600"
                iconBg="bg-blue-50"
              />
              <StatsCard
                title="Verified Guides"
                value={stats?.totalGuides ?? 0}
                icon={BookOpen}
                iconColor="text-purple-600"
                iconBg="bg-purple-50"
              />
              <StatsCard
                title="Total Bookings"
                value={stats?.totalBookings ?? 0}
                icon={Calendar}
                iconColor="text-green-600"
                iconBg="bg-green-50"
              />
              <StatsCard
                title="Platform Revenue"
                value={`$${(stats?.totalRevenue ?? 0).toLocaleString()}`}
                icon={DollarSign}
                iconColor="text-emerald-600"
                iconBg="bg-emerald-50"
              />
              <StatsCard
                title="Pending Verifications"
                value={stats?.pendingVerifications ?? 0}
                subtitle="Awaiting review"
                icon={ShieldCheck}
                iconColor="text-orange-600"
                iconBg="bg-orange-50"
              />
              <StatsCard
                title="New Users This Week"
                value={stats?.newUsersThisWeek ?? 0}
                icon={TrendingUp}
                iconColor="text-indigo-600"
                iconBg="bg-indigo-50"
              />
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: 'Review verification queue', href: '/verification', badge: stats?.pendingVerifications, color: 'bg-orange-100 text-orange-700' },
                  { label: 'Manage users', href: '/users', badge: null, color: null },
                  { label: 'View financial reports', href: '/financials', badge: null, color: null },
                  { label: 'Platform settings', href: '/settings', badge: null, color: null },
                ].map((action) => (
                  <a
                    key={action.href}
                    href={action.href}
                    className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    {action.label}
                    {action.badge ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${action.color}`}>
                        {action.badge}
                      </span>
                    ) : (
                      <span className="text-gray-400">→</span>
                    )}
                  </a>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'API Server', status: 'Operational' },
                  { label: 'Database', status: 'Operational' },
                  { label: 'Stripe Payments', status: 'Test Mode' },
                  { label: 'Email (Resend)', status: 'Dev Mode' },
                  { label: 'Verification (Persona)', status: 'Not Configured' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{item.label}</span>
                    <Badge
                      variant={item.status === 'Operational' ? 'default' : 'secondary'}
                      className={
                        item.status === 'Operational'
                          ? 'bg-green-100 text-green-700 hover:bg-green-100'
                          : item.status === 'Not Configured'
                          ? 'bg-red-100 text-red-700 hover:bg-red-100'
                          : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100'
                      }
                    >
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
