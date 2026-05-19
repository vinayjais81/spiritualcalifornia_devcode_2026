'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AdminHeader } from '@/components/admin/header';
import { StatsCard } from '@/components/admin/stats-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, TrendingUp, CreditCard, BarChart3 } from 'lucide-react';

interface Payment {
  id: string;
  amount: string;
  platformFee: string;
  status: string;
  createdAt: string;
  booking: {
    seeker: { user: { firstName: string; lastName: string } };
    service: {
      guide: {
        user: { firstName: string; lastName: string };
        displayName: string;
      };
    };
  } | null;
}

interface FinancialsData {
  summary: {
    totalRevenue: number;
    monthlyRevenue: number;
    totalPayments: number;
  };
  revenueByMonth: Array<{ month: string; revenue: number }>;
  payments: Payment[];
  total: number;
  totalPages: number;
}

const statusColors: Record<string, string> = {
  SUCCEEDED: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  FAILED: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-blue-100 text-blue-700',
  PARTIALLY_REFUNDED: 'bg-indigo-100 text-indigo-700',
};

export default function FinancialsPage() {
  const { data, isLoading } = useQuery<FinancialsData>({
    queryKey: ['admin', 'financials'],
    queryFn: async () => {
      const { data } = await api.get('/admin/financials', {
        params: { page: 1, limit: 50 },
      });
      return data;
    },
  });

  const maxRevenue = Math.max(...(data?.revenueByMonth?.map((m) => m.revenue) ?? [1]));

  return (
    <div className="flex flex-col overflow-hidden">
      <AdminHeader title="Financials" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-7xl space-y-6">

          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="flex items-center gap-4 p-6">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-7 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <>
                <StatsCard
                  title="Total Platform Revenue"
                  value={`$${(data?.summary.totalRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  icon={DollarSign}
                  iconColor="text-emerald-600"
                  iconBg="bg-emerald-50"
                />
                <StatsCard
                  title="Revenue This Month"
                  value={`$${(data?.summary.monthlyRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  icon={TrendingUp}
                  iconColor="text-blue-600"
                  iconBg="bg-blue-50"
                />
                <StatsCard
                  title="Total Transactions"
                  value={data?.summary.totalPayments ?? 0}
                  icon={CreditCard}
                  iconColor="text-purple-600"
                  iconBg="bg-purple-50"
                />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Revenue Chart */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4 text-gray-400" />
                  Revenue by Month
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : (data?.revenueByMonth?.length ?? 0) === 0 ? (
                  <p className="text-sm text-gray-400">No data yet</p>
                ) : (
                  <div className="space-y-3">
                    {data!.revenueByMonth.map((m) => (
                      <div key={m.month}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium text-gray-700">{m.month}</span>
                          <span className="text-gray-500">${m.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${(m.revenue / maxRevenue) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment History */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        <th className="px-4 py-3">Seeker → Guide</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Platform Fee</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {isLoading
                        ? Array.from({ length: 6 }).map((_, i) => (
                            <tr key={i}>
                              {Array.from({ length: 5 }).map((_, j) => (
                                <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                              ))}
                            </tr>
                          ))
                        : (data?.payments ?? []).length === 0
                        ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                                No transactions yet
                              </td>
                            </tr>
                          )
                        : (data?.payments ?? []).map((payment) => (
                            <tr key={payment.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                {payment.booking ? (
                                  <div className="text-xs">
                                    <span className="font-medium text-gray-900">
                                      {payment.booking.seeker.user.firstName} {payment.booking.seeker.user.lastName}
                                    </span>
                                    <span className="mx-1 text-gray-400">→</span>
                                    <span className="text-gray-600">
                                      {payment.booking.service.guide.displayName}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 font-medium text-gray-900">
                                ${Number(payment.amount).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-emerald-600 font-medium">
                                ${Number(payment.platformFee).toFixed(2)}
                              </td>
                              <td className="px-4 py-3">
                                <Badge className={`${statusColors[payment.status] ?? 'bg-gray-100 text-gray-600'} hover:opacity-100`}>
                                  {payment.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-500">
                                {new Date(payment.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
