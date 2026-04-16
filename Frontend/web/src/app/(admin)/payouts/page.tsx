'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AdminHeader } from '@/components/admin/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, DollarSign, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PayoutRequest {
  id: string;
  amount: number;
  currency: string;
  status: string;
  stripePayoutId: string | null;
  processedAt: string | null;
  createdAt: string;
  guide: {
    id: string;
    displayName: string | null;
    name: string;
    email: string;
    avatarUrl: string | null;
    stripeConnected: boolean;
  };
  balance: { available: number; totalEarned: number; totalPaidOut: number };
}

interface GuideBalance {
  id: string;
  guideId: string;
  displayName: string | null;
  name: string;
  email: string;
  avatarUrl: string | null;
  stripeConnected: boolean;
  availableBalance: number;
  pendingBalance: number;
  totalEarned: number;
  totalPaidOut: number;
  payoutRequestsCount: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
};

function fmtMoney(v: number) { return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

function Avatar({ name, url }: { name: string; url?: string | null }) {
  if (url) return <img src={url} alt={name} className="h-8 w-8 rounded-full object-cover" />;
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  return <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-xs font-semibold text-purple-700">{initials}</div>;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function PayoutsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'requests' | 'balances'>('requests');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // ─── Payout Requests ──────────────────────────────────────────────────

  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    queryKey: ['admin', 'payout-requests', page, status],
    queryFn: async () => {
      const params: any = { page, limit: 15 };
      if (status) params.status = status;
      const { data } = await api.get('/admin/payout-requests', { params });
      return data as {
        requests: PayoutRequest[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        statusCounts: Record<string, number>;
      };
    },
    enabled: tab === 'requests',
  });

  // ─── Guide Balances ───────────────────────────────────────────────────

  const { data: balancesData, isLoading: balancesLoading } = useQuery({
    queryKey: ['admin', 'guide-balances', page, search],
    queryFn: async () => {
      const params: any = { page, limit: 20 };
      if (search) params.search = search;
      const { data } = await api.get('/admin/guide-balances', { params });
      return data as { accounts: GuideBalance[]; total: number; page: number; totalPages: number };
    },
    enabled: tab === 'balances',
  });

  // ─── Process Payout ───────────────────────────────────────────────────

  const processMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/admin/payout-requests/${id}/process`);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Payout processed! Transfer ID: ${data.transferId}`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'payout-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'guide-balances'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? 'Failed to process payout');
    },
  });

  const totalAll = Object.values(requestsData?.statusCounts ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col overflow-hidden">
      <AdminHeader title="Payouts & Guide Balances" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-7xl space-y-6">

          {/* Tab Switch */}
          <div className="flex gap-2">
            <button
              onClick={() => { setTab('requests'); setPage(1); }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === 'requests' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}
            >
              Payout Requests
            </button>
            <button
              onClick={() => { setTab('balances'); setPage(1); }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === 'balances' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}
            >
              Guide Balances
            </button>
          </div>

          {/* ── Payout Requests Tab ──────────────────────────────── */}
          {tab === 'requests' && (
            <>
              {/* Status cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  { label: 'All', value: totalAll, key: '' },
                  { label: 'Pending', value: requestsData?.statusCounts?.PENDING ?? 0, key: 'PENDING' },
                  { label: 'Processing', value: requestsData?.statusCounts?.PROCESSING ?? 0, key: 'PROCESSING' },
                  { label: 'Completed', value: requestsData?.statusCounts?.COMPLETED ?? 0, key: 'COMPLETED' },
                  { label: 'Failed', value: requestsData?.statusCounts?.FAILED ?? 0, key: 'FAILED' },
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

              {/* Table */}
              {requestsLoading ? (
                <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
              ) : !requestsData?.requests?.length ? (
                <Card><CardContent className="py-12 text-center text-sm text-gray-500">No payout requests found.</CardContent></Card>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50/50 text-left text-xs uppercase tracking-wider text-gray-500">
                          <th className="px-4 py-3 font-medium">Guide</th>
                          <th className="px-4 py-3 font-medium">Amount</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Balance</th>
                          <th className="px-4 py-3 font-medium">Stripe</th>
                          <th className="px-4 py-3 font-medium">Requested</th>
                          <th className="px-4 py-3 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {requestsData.requests.map((r) => (
                          <tr key={r.id} className="border-b hover:bg-gray-50/50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Avatar name={r.guide.name} url={r.guide.avatarUrl} />
                                <div>
                                  <div className="font-medium text-gray-900 text-sm">{r.guide.displayName || r.guide.name}</div>
                                  <div className="text-xs text-gray-500">{r.guide.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-semibold text-gray-900">{fmtMoney(r.amount)}</td>
                            <td className="px-4 py-3">
                              <Badge className={`text-xs ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-700'}`}>{r.status}</Badge>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              Avail: {fmtMoney(r.balance.available)}<br />
                              Earned: {fmtMoney(r.balance.totalEarned)}
                            </td>
                            <td className="px-4 py-3">
                              {r.guide.stripeConnected
                                ? <Badge className="bg-green-100 text-green-700 text-[10px]">Connected</Badge>
                                : <Badge className="bg-red-100 text-red-700 text-[10px]">Not Set Up</Badge>
                              }
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(r.createdAt)}</td>
                            <td className="px-4 py-3">
                              {r.status === 'PENDING' && r.guide.stripeConnected && (
                                <button
                                  onClick={() => {
                                    if (confirm(`Process ${fmtMoney(r.amount)} payout to ${r.guide.displayName || r.guide.name}?`)) {
                                      processMutation.mutate(r.id);
                                    }
                                  }}
                                  disabled={processMutation.isPending}
                                  className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  <ArrowUpRight className="h-3 w-3" /> Process
                                </button>
                              )}
                              {r.status === 'PENDING' && !r.guide.stripeConnected && (
                                <span className="text-xs text-red-500">Stripe needed</span>
                              )}
                              {r.status === 'COMPLETED' && r.stripePayoutId && (
                                <span className="font-mono text-[10px] text-gray-400">{r.stripePayoutId.slice(0, 18)}...</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              {/* Pagination */}
              {requestsData && requestsData.totalPages > 1 && (
                <Pagination page={page} totalPages={requestsData.totalPages} total={requestsData.total} limit={requestsData.limit} onPageChange={setPage} />
              )}
            </>
          )}

          {/* ── Guide Balances Tab ───────────────────────────────── */}
          {tab === 'balances' && (
            <>
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

              {balancesLoading ? (
                <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
              ) : !balancesData?.accounts?.length ? (
                <Card><CardContent className="py-12 text-center text-sm text-gray-500">No guide accounts found.</CardContent></Card>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50/50 text-left text-xs uppercase tracking-wider text-gray-500">
                          <th className="px-4 py-3 font-medium">Guide</th>
                          <th className="px-4 py-3 font-medium">Available</th>
                          <th className="px-4 py-3 font-medium">Pending</th>
                          <th className="px-4 py-3 font-medium">Total Earned</th>
                          <th className="px-4 py-3 font-medium">Total Paid Out</th>
                          <th className="px-4 py-3 font-medium">Requests</th>
                          <th className="px-4 py-3 font-medium">Stripe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {balancesData.accounts.map((a) => (
                          <tr key={a.id} className="border-b hover:bg-gray-50/50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Avatar name={a.name} url={a.avatarUrl} />
                                <div>
                                  <div className="font-medium text-gray-900 text-sm">{a.displayName || a.name}</div>
                                  <div className="text-xs text-gray-500">{a.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-semibold text-emerald-600">{fmtMoney(a.availableBalance)}</td>
                            <td className="px-4 py-3 text-yellow-600">{fmtMoney(a.pendingBalance)}</td>
                            <td className="px-4 py-3 text-gray-900">{fmtMoney(a.totalEarned)}</td>
                            <td className="px-4 py-3 text-gray-500">{fmtMoney(a.totalPaidOut)}</td>
                            <td className="px-4 py-3 text-center text-gray-500">{a.payoutRequestsCount}</td>
                            <td className="px-4 py-3">
                              {a.stripeConnected
                                ? <Badge className="bg-green-100 text-green-700 text-[10px]">Connected</Badge>
                                : <Badge className="bg-red-100 text-red-700 text-[10px]">Not Set Up</Badge>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              {balancesData && balancesData.totalPages > 1 && (
                <Pagination page={page} totalPages={balancesData.totalPages} total={balancesData.total} limit={20} onPageChange={setPage} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, total, limit, onPageChange }: { page: number; totalPages: number; total: number; limit: number; onPageChange: (p: number) => void }) {
  return (
    <div className="flex items-center justify-between pt-2">
      <div className="text-xs text-gray-500">Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</div>
      <div className="flex items-center gap-2">
        <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50">Previous</button>
        <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
        <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50">Next</button>
      </div>
    </div>
  );
}
