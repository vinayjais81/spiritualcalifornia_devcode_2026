'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AdminHeader } from '@/components/admin/header';
import { StatsCard } from '@/components/admin/stats-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, BookOpen, Calendar, DollarSign, ShieldCheck, TrendingUp,
  Plane, Briefcase, Award,
} from 'lucide-react';

interface TopGuide {
  guideId: string;
  displayName: string | null;
  name: string;
  totalRevenue: number;
  totalBookings: number;
}

interface IntegrationStatus {
  name: string;
  description: string;
  detail: string;
  status: 'operational' | 'test' | 'unconfigured';
}

interface DashboardStats {
  totalUsers: number;
  totalGuides: number;
  totalBookings: number;
  serviceBookings: number;
  tourBookings: number;
  totalRevenue: number;
  totalServiceRevenue: number;
  totalTourRevenue: number;
  revenueThisMonth: number;
  pendingVerifications: number;
  newUsersThisWeek: number;
  topGuides: TopGuide[];
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 9 }).map((_, i) => (
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

function fmtMoney(v: number) {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/admin/dashboard');
      return data;
    },
    placeholderData: {
      totalUsers: 0,
      totalGuides: 0,
      totalBookings: 0,
      serviceBookings: 0,
      tourBookings: 0,
      totalRevenue: 0,
      totalServiceRevenue: 0,
      totalTourRevenue: 0,
      revenueThisMonth: 0,
      pendingVerifications: 0,
      newUsersThisWeek: 0,
      topGuides: [],
    },
  });

  // Derived live from env at the backend — don't hardcode statuses here.
  const { data: integrations = [] } = useQuery<IntegrationStatus[]>({
    queryKey: ['admin', 'integration-status'],
    queryFn: async () => {
      const { data } = await api.get('/admin/integration-status');
      return data;
    },
    refetchInterval: 60_000,
  });

  return (
    <div className="flex flex-col overflow-hidden">
      <AdminHeader title="Dashboard" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-7xl space-y-6">

          {/* Primary KPI Grid */}
          {isLoading ? (
            <StatsSkeleton />
          ) : (
            <>
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
                  title="Pending Verifications"
                  value={stats?.pendingVerifications ?? 0}
                  subtitle="Awaiting review"
                  icon={ShieldCheck}
                  iconColor="text-orange-600"
                  iconBg="bg-orange-50"
                />
              </div>

              {/* Bookings & Revenue Split */}
              <div>
                <h3 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wider">Bookings & Revenue</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <StatsCard
                    title="Total Bookings"
                    value={stats?.totalBookings ?? 0}
                    subtitle={`${stats?.serviceBookings ?? 0} services · ${stats?.tourBookings ?? 0} tours`}
                    icon={Calendar}
                    iconColor="text-green-600"
                    iconBg="bg-green-50"
                  />
                  <StatsCard
                    title="Service Bookings"
                    value={stats?.serviceBookings ?? 0}
                    subtitle={`Revenue: ${fmtMoney(stats?.totalServiceRevenue ?? 0)}`}
                    icon={Briefcase}
                    iconColor="text-cyan-600"
                    iconBg="bg-cyan-50"
                  />
                  <StatsCard
                    title="Tour Bookings"
                    value={stats?.tourBookings ?? 0}
                    subtitle={`Revenue: ${fmtMoney(stats?.totalTourRevenue ?? 0)}`}
                    icon={Plane}
                    iconColor="text-indigo-600"
                    iconBg="bg-indigo-50"
                  />
                  <StatsCard
                    title="Platform Revenue (Total)"
                    value={fmtMoney(stats?.totalRevenue ?? 0)}
                    subtitle="Lifetime platform fees"
                    icon={DollarSign}
                    iconColor="text-emerald-600"
                    iconBg="bg-emerald-50"
                  />
                  <StatsCard
                    title="Revenue This Month"
                    value={fmtMoney(stats?.revenueThisMonth ?? 0)}
                    subtitle="Last 30 days"
                    icon={TrendingUp}
                    iconColor="text-teal-600"
                    iconBg="bg-teal-50"
                  />
                  <StatsCard
                    title="New Users This Week"
                    value={stats?.newUsersThisWeek ?? 0}
                    icon={Users}
                    iconColor="text-indigo-600"
                    iconBg="bg-indigo-50"
                  />
                </div>
              </div>
            </>
          )}

          {/* Bottom section: Top Guides + Quick Actions */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Top Guides by Revenue */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Award className="h-4 w-4 text-yellow-500" />
                  Top Guides by Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!stats?.topGuides?.length ? (
                  <p className="py-6 text-center text-sm text-gray-400">No revenue data yet</p>
                ) : (
                  <div className="space-y-3">
                    {stats.topGuides.map((g, i) => (
                      <div key={g.guideId} className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-500'
                        }`}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{g.displayName || g.name}</div>
                          <div className="text-xs text-gray-500">{g.totalBookings} booking{g.totalBookings !== 1 ? 's' : ''}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold text-emerald-600">{fmtMoney(g.totalRevenue)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <a
                  href="/financials"
                  className="mt-4 block text-center text-xs font-medium text-purple-600 hover:text-purple-700"
                >
                  View full guide revenue breakdown →
                </a>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: 'Review verification queue', href: '/verification', badge: stats?.pendingVerifications, color: 'bg-orange-100 text-orange-700' },
                  { label: 'Manage tour bookings', href: '/tour-bookings', badge: stats?.tourBookings, color: 'bg-indigo-100 text-indigo-700' },
                  { label: 'Manage service bookings', href: '/service-bookings', badge: stats?.serviceBookings, color: 'bg-cyan-100 text-cyan-700' },
                  { label: 'View financial reports', href: '/financials', badge: null, color: null },
                  { label: 'Manage users', href: '/users', badge: null, color: null },
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
          </div>

          {/* System Status — live-derived from /admin/integration-status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">System Status</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {integrations.length === 0 ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-11 rounded-lg" />
                ))
              ) : (
                integrations.map((item) => {
                  const label =
                    item.status === 'operational'
                      ? 'Operational'
                      : item.status === 'test'
                      ? 'Test Mode'
                      : 'Not Configured';
                  const className =
                    item.status === 'operational'
                      ? 'bg-green-100 text-green-700 hover:bg-green-100'
                      : item.status === 'test'
                      ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100'
                      : 'bg-red-100 text-red-700 hover:bg-red-100';
                  return (
                    <div key={item.name} className="flex items-center justify-between rounded-lg border px-4 py-2.5" title={item.detail}>
                      <span className="text-sm text-gray-600">{item.name}</span>
                      <Badge variant="secondary" className={className}>
                        {label}
                      </Badge>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
