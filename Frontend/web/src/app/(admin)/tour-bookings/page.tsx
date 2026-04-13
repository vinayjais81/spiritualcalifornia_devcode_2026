'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AdminHeader } from '@/components/admin/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Users, Calendar, DollarSign, Search, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TourBooking {
  id: string;
  bookingReference: string | null;
  status: string;
  travelers: number;
  totalAmount: string | number;
  depositAmount: string | number | null;
  chosenDepositAmount: string | number | null;
  balanceAmount: string | number | null;
  balanceDueAt: string | null;
  paymentMethod: string | null;
  currency: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  contactPhone: string | null;
  dietaryRequirements: string | null;
  healthConditions: string | null;
  intentions: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  tour: {
    id: string;
    title: string;
    slug: string;
    location: string | null;
    guide: {
      id: string;
      displayName: string | null;
      user: { firstName: string; lastName: string; email: string; avatarUrl: string | null };
    };
  };
  departure: { startDate: string; endDate: string; status: string } | null;
  roomType: { name: string; totalPrice: string | number } | null;
  seeker: {
    user: { firstName: string; lastName: string; email: string; avatarUrl: string | null };
  };
  payments: Array<{
    id: string;
    amount: string | number;
    platformFee: string | number;
    guideAmount: string | number;
    paymentType: string;
    status: string;
    createdAt: string;
  }>;
  travelers_rel: Array<{
    id: string;
    isPrimary: boolean;
    firstName: string;
    lastName: string;
    nationality: string;
  }>;
}

interface TourBookingsResponse {
  bookings: TourBooking[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  statusCounts: Record<string, number>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  DEPOSIT_PAID: 'bg-blue-100 text-blue-800',
  FULLY_PAID: 'bg-emerald-100 text-emerald-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  COMPLETED: 'bg-purple-100 text-purple-800',
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  SUCCEEDED: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  FAILED: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-blue-100 text-blue-700',
};

const STATUS_OPTIONS = ['', 'PENDING', 'DEPOSIT_PAID', 'FULLY_PAID', 'CONFIRMED', 'CANCELLED', 'COMPLETED'];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

// ─── Page ───────────────────────────────────────────────────────────────────

export default function TourBookingsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<TourBookingsResponse>({
    queryKey: ['admin', 'tour-bookings', page, search, status],
    queryFn: async () => {
      const params: any = { page, limit: 15 };
      if (search) params.search = search;
      if (status) params.status = status;
      const { data } = await api.get('/admin/tour-bookings', { params });
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
      <AdminHeader title="Tour Bookings" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-7xl space-y-6">

          {/* Status summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
            {[
              { label: 'All', value: totalAll, key: '' },
              { label: 'Pending', value: data?.statusCounts?.PENDING ?? 0, key: 'PENDING' },
              { label: 'Deposit Paid', value: data?.statusCounts?.DEPOSIT_PAID ?? 0, key: 'DEPOSIT_PAID' },
              { label: 'Fully Paid', value: data?.statusCounts?.FULLY_PAID ?? 0, key: 'FULLY_PAID' },
              { label: 'Confirmed', value: data?.statusCounts?.CONFIRMED ?? 0, key: 'CONFIRMED' },
              { label: 'Completed', value: data?.statusCounts?.COMPLETED ?? 0, key: 'COMPLETED' },
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

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <form onSubmit={handleSearch} className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by reference, email, name, or tour..."
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

          {/* Bookings table */}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
            </div>
          ) : !data?.bookings?.length ? (
            <Card><CardContent className="py-12 text-center text-sm text-gray-500">No tour bookings found.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {data.bookings.map((b) => {
                const isOpen = expanded.has(b.id);
                const guideName = b.tour.guide.displayName || `${b.tour.guide.user.firstName} ${b.tour.guide.user.lastName}`;
                const seekerName = `${b.seeker.user.firstName} ${b.seeker.user.lastName}`;
                const totalPaid = b.payments.filter((p) => p.status === 'SUCCEEDED').reduce((sum, p) => sum + Number(p.amount), 0);

                return (
                  <Card key={b.id} className="overflow-hidden">
                    {/* Summary row */}
                    <button
                      onClick={() => toggleExpand(b.id)}
                      className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-semibold text-purple-700">{b.bookingReference ?? b.id.slice(0, 10)}</span>
                          <Badge className={`text-xs ${STATUS_COLORS[b.status] ?? 'bg-gray-100 text-gray-700'}`}>{b.status.replace(/_/g, ' ')}</Badge>
                        </div>
                        <div className="mt-1 text-sm font-medium text-gray-900 truncate">{b.tour.title}</div>
                        <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                          {b.departure && (
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(b.departure.startDate)} – {fmtDate(b.departure.endDate)}</span>
                          )}
                          {b.tour.location && (
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{b.tour.location}</span>
                          )}
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{b.travelers} traveler{b.travelers > 1 ? 's' : ''}</span>
                        </div>
                      </div>

                      <div className="hidden sm:flex items-center gap-6 shrink-0">
                        {/* Guide */}
                        <div className="flex items-center gap-2 min-w-[140px]">
                          <Avatar name={guideName} url={b.tour.guide.user.avatarUrl} size={28} />
                          <div className="text-xs"><div className="font-medium text-gray-700 truncate max-w-[100px]">{guideName}</div><div className="text-gray-400">Guide</div></div>
                        </div>
                        {/* Seeker */}
                        <div className="flex items-center gap-2 min-w-[140px]">
                          <Avatar name={seekerName} url={b.seeker.user.avatarUrl} size={28} />
                          <div className="text-xs"><div className="font-medium text-gray-700 truncate max-w-[100px]">{seekerName}</div><div className="text-gray-400">Seeker</div></div>
                        </div>
                        {/* Amount */}
                        <div className="text-right min-w-[90px]">
                          <div className="text-sm font-semibold text-gray-900">{fmtMoney(b.totalAmount)}</div>
                          <div className="text-xs text-gray-400">Paid: {fmtMoney(totalPaid)}</div>
                        </div>
                      </div>

                      {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
                    </button>

                    {/* Expanded detail */}
                    {isOpen && (
                      <div className="border-t bg-gray-50/50 px-5 py-4 space-y-5">
                        {/* Info grid */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          <InfoBlock label="Booking Reference" value={b.bookingReference ?? '—'} />
                          <InfoBlock label="Created" value={fmtDate(b.createdAt)} />
                          <InfoBlock label="Room Type" value={b.roomType?.name ?? '—'} />
                          <InfoBlock label="Payment Method" value={b.paymentMethod ?? '—'} />
                          <InfoBlock label="Total Amount" value={fmtMoney(b.totalAmount)} highlight />
                          <InfoBlock label="Deposit Chosen" value={fmtMoney(b.chosenDepositAmount)} />
                          <InfoBlock label="Balance Due" value={fmtMoney(b.balanceAmount)} />
                          <InfoBlock label="Balance Due Date" value={b.balanceDueAt ? fmtDate(b.balanceDueAt) : '—'} />
                        </div>

                        {/* Contact info */}
                        <div>
                          <SectionLabel>Primary Contact</SectionLabel>
                          <div className="mt-1 flex flex-wrap gap-4 text-sm text-gray-700">
                            <span>{b.contactFirstName} {b.contactLastName}</span>
                            <span className="text-gray-400">|</span>
                            <span>{b.contactEmail}</span>
                            {b.contactPhone && <><span className="text-gray-400">|</span><span>{b.contactPhone}</span></>}
                          </div>
                        </div>

                        {/* Travelers */}
                        {b.travelers_rel.length > 0 && (
                          <div>
                            <SectionLabel>Travelers Manifest</SectionLabel>
                            <div className="mt-2 overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b text-left text-gray-500">
                                    <th className="pb-2 pr-4 font-medium">#</th>
                                    <th className="pb-2 pr-4 font-medium">Name</th>
                                    <th className="pb-2 pr-4 font-medium">Nationality</th>
                                    <th className="pb-2 font-medium">Role</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {b.travelers_rel.map((t, i) => (
                                    <tr key={t.id} className="border-b border-gray-100">
                                      <td className="py-2 pr-4 text-gray-400">{i + 1}</td>
                                      <td className="py-2 pr-4 font-medium text-gray-800">{t.firstName} {t.lastName}</td>
                                      <td className="py-2 pr-4 text-gray-600">{t.nationality}</td>
                                      <td className="py-2">{t.isPrimary ? <Badge className="bg-purple-100 text-purple-700 text-[10px]">Primary</Badge> : '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Payments */}
                        {b.payments.length > 0 && (
                          <div>
                            <SectionLabel>Payment Transactions</SectionLabel>
                            <div className="mt-2 overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b text-left text-gray-500">
                                    <th className="pb-2 pr-4 font-medium">Date</th>
                                    <th className="pb-2 pr-4 font-medium">Type</th>
                                    <th className="pb-2 pr-4 font-medium">Amount</th>
                                    <th className="pb-2 pr-4 font-medium">Platform Fee</th>
                                    <th className="pb-2 pr-4 font-medium">Guide Payout</th>
                                    <th className="pb-2 font-medium">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {b.payments.map((p) => (
                                    <tr key={p.id} className="border-b border-gray-100">
                                      <td className="py-2 pr-4 text-gray-600">{fmtDate(p.createdAt)}</td>
                                      <td className="py-2 pr-4"><Badge className="bg-gray-100 text-gray-700 text-[10px]">{p.paymentType}</Badge></td>
                                      <td className="py-2 pr-4 font-medium text-gray-800">{fmtMoney(p.amount)}</td>
                                      <td className="py-2 pr-4 text-orange-600">{fmtMoney(p.platformFee)}</td>
                                      <td className="py-2 pr-4 text-green-600">{fmtMoney(p.guideAmount)}</td>
                                      <td className="py-2"><Badge className={`text-[10px] ${PAYMENT_STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-700'}`}>{p.status}</Badge></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Special requests */}
                        {(b.dietaryRequirements || b.healthConditions || b.intentions) && (
                          <div>
                            <SectionLabel>Special Requests & Notes</SectionLabel>
                            <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
                              {b.dietaryRequirements && <div><span className="text-gray-400">Dietary:</span> <span className="text-gray-700">{b.dietaryRequirements}</span></div>}
                              {b.healthConditions && <div><span className="text-gray-400">Health:</span> <span className="text-gray-700">{b.healthConditions}</span></div>}
                              {b.intentions && <div><span className="text-gray-400">Intentions:</span> <span className="text-gray-700">{b.intentions}</span></div>}
                            </div>
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
