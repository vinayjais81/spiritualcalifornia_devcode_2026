'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AdminHeader } from '@/components/admin/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Subscription {
  id: string;
  status: 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELLED';
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt: string | null;
  createdAt: string;
  stripeSubscriptionId: string;
  guide: {
    id: string;
    slug: string;
    displayName: string | null;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

interface SubscriptionsResponse {
  subscriptions: Subscription[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  statusCounts: Record<string, number>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  TRIALING: 'bg-blue-100 text-blue-800',
  PAST_DUE: 'bg-amber-100 text-amber-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
};
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  TRIALING: 'Free trial',
  PAST_DUE: 'Payment due',
  CANCELLED: 'Cancelled',
};

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
  if (url) return <img src={url} alt={name} className="h-8 w-8 rounded-full object-cover" />;
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  return <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-xs font-semibold text-purple-700">{initials}</div>;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'subscriptions', page, status, search],
    queryFn: async () => {
      const params: any = { page, limit: 20 };
      if (status) params.status = status;
      if (search) params.search = search;
      const { data } = await api.get('/admin/subscriptions', { params });
      return data as SubscriptionsResponse;
    },
  });

  const totalAll = Object.values(data?.statusCounts ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col overflow-hidden">
      <AdminHeader title="Subscriptions" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-7xl space-y-6">

          {/* Status filter cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: 'All', value: totalAll, key: '' },
              { label: 'Active', value: data?.statusCounts?.ACTIVE ?? 0, key: 'ACTIVE' },
              { label: 'Free trial', value: data?.statusCounts?.TRIALING ?? 0, key: 'TRIALING' },
              { label: 'Payment due', value: data?.statusCounts?.PAST_DUE ?? 0, key: 'PAST_DUE' },
              { label: 'Cancelled', value: data?.statusCounts?.CANCELLED ?? 0, key: 'CANCELLED' },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => { setStatus(s.key); setPage(1); }}
                className={`rounded-lg border p-3 text-center transition-colors ${status === s.key ? 'border-purple-400 bg-purple-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
              >
                <div className="text-xl font-semibold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </button>
            ))}
          </div>

          {/* Search */}
          <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }} className="flex items-center gap-2 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by guide name or email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 text-sm focus:border-purple-400 focus:outline-none"
              />
            </div>
            <button type="submit" className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700">Search</button>
          </form>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
          ) : !data?.subscriptions?.length ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-gray-500">
                No subscriptions yet. Guides appear here once they subscribe to a paid listing plan.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50/50 text-left text-xs uppercase tracking-wider text-gray-500">
                        <th className="px-4 py-3 font-medium">Guide</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Current Period</th>
                        <th className="px-4 py-3 font-medium">Subscribed</th>
                        <th className="px-4 py-3 font-medium">Stripe Subscription</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.subscriptions.map((s) => (
                        <tr key={s.id} className="border-b hover:bg-gray-50/50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Avatar name={s.guide.name} url={s.guide.avatarUrl} />
                              <div>
                                <div className="font-medium text-gray-900 text-sm">{s.guide.displayName || s.guide.name}</div>
                                <div className="text-xs text-gray-500">{s.guide.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <Badge className={`w-fit text-xs ${STATUS_COLORS[s.status] ?? 'bg-gray-100 text-gray-700'}`}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
                              {s.cancelAtPeriodEnd && <span className="text-[10px] text-amber-600">Cancels at period end</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {fmtDate(s.currentPeriodStart)} – {fmtDate(s.currentPeriodEnd)}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(s.createdAt)}</td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-[10px] text-gray-400">{s.stripeSubscriptionId}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-gray-500">Showing {(page - 1) * data.limit + 1}–{Math.min(page * data.limit, data.total)} of {data.total}</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50">Previous</button>
                <span className="text-sm text-gray-600">Page {page} of {data.totalPages}</span>
                <button onClick={() => setPage(Math.min(data.totalPages, page + 1))} disabled={page >= data.totalPages} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
