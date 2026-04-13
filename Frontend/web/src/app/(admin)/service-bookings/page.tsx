'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AdminHeader } from '@/components/admin/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Star, DollarSign, Search, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ServiceBooking {
  id: string;
  status: string;
  totalAmount: string | number;
  currency: string;
  notes: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  completedAt: string | null;
  createdAt: string;
  service: {
    id: string;
    name: string;
    type: string;
    durationMin: number;
    price: string | number;
    guide: {
      id: string;
      displayName: string | null;
      user: { firstName: string; lastName: string; email: string; avatarUrl: string | null };
    };
  };
  seeker: {
    user: { id: string; firstName: string; lastName: string; email: string; avatarUrl: string | null };
  };
  slot: { startTime: string; endTime: string } | null;
  payment: {
    id: string;
    amount: string | number;
    platformFee: string | number;
    guideAmount: string | number;
    status: string;
    createdAt: string;
  } | null;
  review: {
    id: string;
    rating: number;
    body: string | null;
  } | null;
}

interface ServiceBookingsResponse {
  bookings: ServiceBooking[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  statusCounts: Record<string, number>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  NO_SHOW: 'bg-gray-200 text-gray-700',
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  SUCCEEDED: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  FAILED: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-blue-100 text-blue-700',
};

const STATUS_OPTIONS = ['', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function fmtMoney(v: string | number | null | undefined) {
  return `$${Number(v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Avatar({ name, url, size = 32 }: { name: string; url?: string | null; size?: number }) {
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />;
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 600, color: '#7C3AED' }}>
      {initials}
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`h-3 w-3 ${s <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
      ))}
      <span className="ml-1 text-xs text-gray-600">{rating}/5</span>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ServiceBookingsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<ServiceBookingsResponse>({
    queryKey: ['admin', 'service-bookings', page, search, status],
    queryFn: async () => {
      const params: any = { page, limit: 15 };
      if (search) params.search = search;
      if (status) params.status = status;
      const { data } = await api.get('/admin/service-bookings', { params });
      return data;
    },
  });

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const totalAll = Object.values(data?.statusCounts ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col overflow-hidden">
      <AdminHeader title="Service Bookings" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-7xl space-y-6">

          {/* Status summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: 'All', value: totalAll, key: '' },
              { label: 'Pending', value: data?.statusCounts?.PENDING ?? 0, key: 'PENDING' },
              { label: 'Confirmed', value: data?.statusCounts?.CONFIRMED ?? 0, key: 'CONFIRMED' },
              { label: 'Completed', value: data?.statusCounts?.COMPLETED ?? 0, key: 'COMPLETED' },
              { label: 'Cancelled', value: data?.statusCounts?.CANCELLED ?? 0, key: 'CANCELLED' },
              { label: 'No Show', value: data?.statusCounts?.NO_SHOW ?? 0, key: 'NO_SHOW' },
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

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <form onSubmit={handleSearch} className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by seeker email, name, or service title..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                />
              </div>
              <button type="submit" className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700">
                Search
              </button>
            </form>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.filter(Boolean).map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          {/* Bookings list */}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
            </div>
          ) : !data?.bookings?.length ? (
            <Card><CardContent className="py-12 text-center text-sm text-gray-500">No service bookings found.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {data.bookings.map((b) => {
                const isOpen = expanded.has(b.id);
                const guideName = b.service.guide.displayName || `${b.service.guide.user.firstName} ${b.service.guide.user.lastName}`;
                const seekerName = `${b.seeker.user.firstName} ${b.seeker.user.lastName}`;

                return (
                  <Card key={b.id} className="overflow-hidden">
                    {/* Summary row */}
                    <button
                      onClick={() => toggleExpand(b.id)}
                      className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={`text-xs ${STATUS_COLORS[b.status] ?? 'bg-gray-100 text-gray-700'}`}>{b.status.replace(/_/g, ' ')}</Badge>
                          <Badge className="bg-gray-100 text-gray-600 text-[10px]">{b.service.type}</Badge>
                        </div>
                        <div className="mt-1 text-sm font-medium text-gray-900 truncate">{b.service.name}</div>
                        <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                          {b.slot && (
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDateTime(b.slot.startTime)}</span>
                          )}
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{b.service.durationMin} min</span>
                          {b.review && <StarRating rating={b.review.rating} />}
                        </div>
                      </div>

                      <div className="hidden sm:flex items-center gap-6 shrink-0">
                        {/* Guide */}
                        <div className="flex items-center gap-2 min-w-[140px]">
                          <Avatar name={guideName} url={b.service.guide.user.avatarUrl} size={28} />
                          <div className="text-xs"><div className="font-medium text-gray-700 truncate max-w-[100px]">{guideName}</div><div className="text-gray-400">Guide</div></div>
                        </div>
                        {/* Seeker */}
                        <div className="flex items-center gap-2 min-w-[140px]">
                          <Avatar name={seekerName} url={b.seeker.user.avatarUrl} size={28} />
                          <div className="text-xs"><div className="font-medium text-gray-700 truncate max-w-[100px]">{seekerName}</div><div className="text-gray-400">Seeker</div></div>
                        </div>
                        {/* Amount */}
                        <div className="text-right min-w-[80px]">
                          <div className="text-sm font-semibold text-gray-900">{fmtMoney(b.totalAmount)}</div>
                          <div className="text-xs text-gray-400">{fmtDate(b.createdAt)}</div>
                        </div>
                      </div>

                      {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
                    </button>

                    {/* Expanded detail */}
                    {isOpen && (
                      <div className="border-t bg-gray-50/50 px-5 py-4 space-y-5">
                        {/* Info grid */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          <InfoBlock label="Booking ID" value={b.id.slice(0, 16)} />
                          <InfoBlock label="Service Type" value={b.service.type} />
                          <InfoBlock label="Duration" value={`${b.service.durationMin} minutes`} />
                          <InfoBlock label="Booked On" value={fmtDate(b.createdAt)} />
                          {b.slot && (
                            <>
                              <InfoBlock label="Session Start" value={fmtDateTime(b.slot.startTime)} />
                              <InfoBlock label="Session End" value={fmtDateTime(b.slot.endTime)} />
                            </>
                          )}
                          {b.completedAt && <InfoBlock label="Completed At" value={fmtDate(b.completedAt)} />}
                          <InfoBlock label="Total Amount" value={fmtMoney(b.totalAmount)} highlight />
                        </div>

                        {/* Guide & Seeker details */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="rounded-lg border bg-white p-3">
                            <SectionLabel>Guide</SectionLabel>
                            <div className="mt-2 flex items-center gap-3">
                              <Avatar name={guideName} url={b.service.guide.user.avatarUrl} size={36} />
                              <div>
                                <div className="text-sm font-medium text-gray-900">{guideName}</div>
                                <div className="text-xs text-gray-500">{b.service.guide.user.email}</div>
                              </div>
                            </div>
                          </div>
                          <div className="rounded-lg border bg-white p-3">
                            <SectionLabel>Seeker</SectionLabel>
                            <div className="mt-2 flex items-center gap-3">
                              <Avatar name={seekerName} url={b.seeker.user.avatarUrl} size={36} />
                              <div>
                                <div className="text-sm font-medium text-gray-900">{seekerName}</div>
                                <div className="text-xs text-gray-500">{b.seeker.user.email}</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Payment */}
                        {b.payment && (
                          <div>
                            <SectionLabel>Payment Transaction</SectionLabel>
                            <div className="mt-2 rounded-lg border bg-white overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b text-left text-gray-500">
                                    <th className="p-3 font-medium">Date</th>
                                    <th className="p-3 font-medium">Amount</th>
                                    <th className="p-3 font-medium">Platform Fee</th>
                                    <th className="p-3 font-medium">Guide Payout</th>
                                    <th className="p-3 font-medium">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    <td className="p-3 text-gray-600">{fmtDate(b.payment.createdAt)}</td>
                                    <td className="p-3 font-medium text-gray-800">{fmtMoney(b.payment.amount)}</td>
                                    <td className="p-3 text-orange-600">{fmtMoney(b.payment.platformFee)}</td>
                                    <td className="p-3 text-green-600">{fmtMoney(b.payment.guideAmount)}</td>
                                    <td className="p-3"><Badge className={`text-[10px] ${PAYMENT_STATUS_COLORS[b.payment.status] ?? 'bg-gray-100 text-gray-700'}`}>{b.payment.status}</Badge></td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Review */}
                        {b.review && (
                          <div>
                            <SectionLabel>Seeker Review</SectionLabel>
                            <div className="mt-2 rounded-lg border bg-white p-3">
                              <StarRating rating={b.review.rating} />
                              {b.review.body && <p className="mt-2 text-xs text-gray-600 leading-relaxed">{b.review.body}</p>}
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        {b.notes && (
                          <div>
                            <SectionLabel>Session Notes</SectionLabel>
                            <p className="mt-1 text-xs text-gray-600">{b.notes}</p>
                          </div>
                        )}

                        {/* Cancellation */}
                        {b.cancelledAt && (
                          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                            <div className="text-xs font-medium text-red-700">Cancelled on {fmtDate(b.cancelledAt)}</div>
                            {b.cancellationReason && <div className="mt-1 text-xs text-red-600">{b.cancellationReason}</div>}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-gray-500">
                Showing {(data.page - 1) * data.limit + 1}–{Math.min(data.page * data.limit, data.total)} of {data.total} bookings
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {data.page} of {data.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={page >= data.totalPages}
                  className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Shared sub-components ──────────────────────────────────────────────────

function InfoBlock({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-400">{label}</div>
      <div className={`mt-0.5 text-sm ${highlight ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{value}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 mb-1">{children}</div>;
}
