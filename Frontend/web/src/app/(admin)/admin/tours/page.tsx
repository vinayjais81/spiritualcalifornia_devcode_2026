'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AdminHeader } from '@/components/admin/header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Mountain, GripVertical, Eye, EyeOff, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { SortHeader } from '@/components/admin/SortHeader';

type SortBy = 'sortOrder' | 'title' | 'startDate' | 'createdAt';
type SortDir = 'asc' | 'desc';
type StatusFilter = '' | 'published' | 'draft' | 'cancelled';
type TrackFilter = '' | 'ADVENTURE' | 'HEALING';

interface AdminTour {
  id: string;
  slug: string;
  title: string;
  shortDesc: string | null;
  startDate: string;
  endDate: string;
  location: string | null;
  country: string | null;
  basePrice: number | string;
  capacity: number;
  spotsRemaining: number;
  coverImageUrl: string | null;
  trackType: 'ADVENTURE' | 'HEALING' | null;
  isPublished: boolean;
  isCancelled: boolean;
  sortOrder: number;
  createdAt: string;
  guide: {
    id: string;
    slug: string;
    displayName: string;
    user: { avatarUrl: string | null; isActive: boolean };
  };
  _count: { bookings: number };
}

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: '',          label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft',     label: 'Drafts' },
  { value: 'cancelled', label: 'Cancelled' },
];

const trackFilters: Array<{ value: TrackFilter; label: string }> = [
  { value: '',          label: 'All tracks' },
  { value: 'ADVENTURE', label: 'Soul Adventure' },
  { value: 'HEALING',   label: 'Healing Body' },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatPrice(p: number | string) {
  const n = typeof p === 'string' ? parseFloat(p) : p;
  if (!Number.isFinite(n)) return '—';
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function AdminToursPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [trackFilter, setTrackFilter] = useState<TrackFilter>('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortBy>('sortOrder');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const canReorder = sortBy === 'sortOrder';
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [orderedIds, setOrderedIds] = useState<string[] | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'tours', page, search, statusFilter, trackFilter, sortBy, sortDir],
    queryFn: async () => {
      const { data } = await api.get('/admin/tours', {
        params: {
          page,
          limit: 20,
          search: search || undefined,
          status: statusFilter || undefined,
          track: trackFilter || undefined,
          sortBy,
          sortDir,
        },
      });
      return data as { tours: AdminTour[]; total: number; totalPages: number };
    },
    placeholderData: { tours: [], total: 0, totalPages: 0 },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'tours'] });

  const reorderMutation = useMutation({
    mutationFn: (rows: Array<{ id: string; sortOrder: number }>) =>
      api.post('/admin/tours/reorder', { rows }),
    onSuccess: () => { toast.success('Order saved'); invalidate(); },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to save order');
      setOrderedIds(null);
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      api.patch(`/admin/tours/${id}/published`, { isPublished }),
    onSuccess: (_, { isPublished }) => {
      toast.success(isPublished ? 'Tour published' : 'Tour unpublished');
      invalidate();
    },
    onError: () => toast.error('Failed to update tour'),
  });

  const serverTours = data?.tours ?? [];

  useEffect(() => { setOrderedIds(null); }, [data]);

  const tours: AdminTour[] = useMemo(() => {
    if (!orderedIds) return serverTours;
    const map = new Map(serverTours.map((t) => [t.id, t]));
    return orderedIds.map((id) => map.get(id)).filter((t): t is AdminTour => !!t);
  }, [serverTours, orderedIds]);

  const handleSort = (col: SortBy) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir(col === 'createdAt' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const handleDrop = (targetId: string) => {
    if (!draggingId || draggingId === targetId) return;
    const ids = tours.map((t) => t.id);
    const fromIdx = ids.indexOf(draggingId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...ids];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setOrderedIds(next);
    setDraggingId(null);
    const base = (page - 1) * 20;
    reorderMutation.mutate(next.map((id, i) => ({ id, sortOrder: base + i })));
  };

  return (
    <div className="flex flex-col overflow-hidden">
      <AdminHeader title="Tours" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-7xl space-y-4">

          {/* Search + filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by title, location, or guide…"
                className="pl-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <div className="flex gap-1">
              {statusFilters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => { setStatusFilter(f.value); setPage(1); }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === f.value
                      ? 'bg-purple-600 text-white'
                      : 'bg-white border text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <select
              value={trackFilter}
              onChange={(e) => { setTrackFilter(e.target.value as TrackFilter); setPage(1); }}
              className="rounded-md border bg-white px-3 py-1.5 text-sm text-gray-700"
            >
              {trackFilters.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          <Card>
            <CardContent className="p-0">
              {canReorder && (
                <div className="border-b bg-purple-50 px-4 py-2 text-xs text-purple-800">
                  Drag the <GripVertical className="inline h-3 w-3" /> handle to reorder this admin view. Note: the public <code>/travels</code> page stays chronological — admin order does not affect seekers.
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <th className="px-2 py-3 w-8"></th>
                      <th className="px-4 py-3">
                        <SortHeader label="Tour" col="title" active={sortBy} dir={sortDir} onClick={handleSort} />
                      </th>
                      <th className="px-4 py-3">Guide</th>
                      <th className="px-4 py-3">Track</th>
                      <th className="px-4 py-3">
                        <SortHeader label="Starts" col="startDate" active={sortBy} dir={sortDir} onClick={handleSort} />
                      </th>
                      <th className="px-4 py-3">From</th>
                      <th className="px-4 py-3">Bookings</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">
                        <SortHeader label="Created" col="createdAt" active={sortBy} dir={sortDir} onClick={handleSort} />
                      </th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {isLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 10 }).map((_, j) => (
                            <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                          ))}
                        </tr>
                      ))
                    ) : tours.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                          <Mountain className="mx-auto mb-2 h-8 w-8 opacity-40" />
                          No tours match these filters.
                        </td>
                      </tr>
                    ) : (
                      tours.map((t) => {
                        const isDragging = draggingId === t.id;
                        const trackLabel = t.trackType === 'ADVENTURE'
                          ? 'Soul Adventure'
                          : t.trackType === 'HEALING'
                            ? 'Healing Body'
                            : '—';
                        return (
                          <tr
                            key={t.id}
                            className={`hover:bg-gray-50 ${isDragging ? 'opacity-40' : ''}`}
                            draggable={canReorder}
                            onDragStart={(e) => { setDraggingId(t.id); e.dataTransfer.effectAllowed = 'move'; }}
                            onDragEnd={() => setDraggingId(null)}
                            onDragOver={(e) => { if (canReorder && draggingId) e.preventDefault(); }}
                            onDrop={(e) => { e.preventDefault(); handleDrop(t.id); }}
                          >
                            <td className="px-2 py-3 align-middle">
                              {canReorder && (
                                <GripVertical
                                  className="h-4 w-4 cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing"
                                  aria-label="Drag to reorder"
                                />
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {t.coverImageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={t.coverImageUrl} alt="" className="h-10 w-14 rounded object-cover" />
                                ) : (
                                  <div className="flex h-10 w-14 items-center justify-center rounded bg-gray-100 text-gray-400">
                                    <Mountain className="h-4 w-4" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-gray-900">{t.title}</p>
                                  {(t.location || t.country) && (
                                    <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                                      <MapPin className="h-3 w-3" />
                                      <span className="truncate">{t.location || t.country}</span>
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {t.guide.user.avatarUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={t.guide.user.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                                ) : (
                                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-600">
                                    {t.guide.displayName[0]}
                                  </div>
                                )}
                                <span className="text-gray-700">{t.guide.displayName}</span>
                                {!t.guide.user.isActive && (
                                  <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[10px]">Deactivated</Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">{trackLabel}</td>
                            <td className="px-4 py-3 text-xs text-gray-600">{fmtDate(t.startDate)}</td>
                            <td className="px-4 py-3 text-gray-900 font-medium">{formatPrice(t.basePrice)}</td>
                            <td className="px-4 py-3 text-xs text-gray-600">{t._count.bookings}</td>
                            <td className="px-4 py-3">
                              {t.isCancelled ? (
                                <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Cancelled</Badge>
                              ) : t.isPublished ? (
                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 gap-1">
                                  <Eye className="h-3 w-3" /> Published
                                </Badge>
                              ) : (
                                <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 gap-1">
                                  <EyeOff className="h-3 w-3" /> Draft
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(t.createdAt)}</td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end">
                                <button
                                  onClick={() => togglePublishMutation.mutate({ id: t.id, isPublished: !t.isPublished })}
                                  disabled={togglePublishMutation.isPending || t.isCancelled}
                                  title={
                                    t.isCancelled
                                      ? 'Cancelled tours cannot be published'
                                      : t.isPublished
                                        ? 'Hide from public /travels'
                                        : 'Show on public /travels'
                                  }
                                  className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
                                    t.isPublished
                                      ? 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                                      : 'border-green-200 bg-white text-green-700 hover:bg-green-50'
                                  } disabled:opacity-40`}
                                >
                                  {t.isPublished ? <><EyeOff className="h-3 w-3" /> Unpublish</> : <><Eye className="h-3 w-3" /> Publish</>}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {(data?.totalPages ?? 0) > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-xs text-gray-500">
                    {data?.total} tours · Page {page} of {data?.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="rounded border px-3 py-1 text-xs disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= (data?.totalPages ?? 1)}
                      className="rounded border px-3 py-1 text-xs disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
