'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AdminHeader } from '@/components/admin/header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Calendar, GripVertical, Eye, EyeOff, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { SortHeader } from '@/components/admin/SortHeader';

type SortBy = 'sortOrder' | 'title' | 'startTime' | 'createdAt';
type SortDir = 'asc' | 'desc';
type StatusFilter = '' | 'published' | 'draft' | 'cancelled';
type TypeFilter = '' | 'VIRTUAL' | 'IN_PERSON' | 'SOUL_TRAVEL' | 'RETREAT';

interface AdminEvent {
  id: string;
  title: string;
  type: 'VIRTUAL' | 'IN_PERSON' | 'SOUL_TRAVEL' | 'RETREAT';
  startTime: string;
  endTime: string;
  location: string | null;
  coverImageUrl: string | null;
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
  ticketTiers: Array<{ price: number | string }>;
}

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: '',          label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft',     label: 'Drafts' },
  { value: 'cancelled', label: 'Cancelled' },
];

const typeFilters: Array<{ value: TypeFilter; label: string }> = [
  { value: '',            label: 'All types' },
  { value: 'IN_PERSON',   label: 'In-person' },
  { value: 'VIRTUAL',     label: 'Virtual' },
  { value: 'RETREAT',     label: 'Retreat' },
  { value: 'SOUL_TRAVEL', label: 'Soul travel' },
];

const TYPE_LABEL: Record<string, string> = {
  IN_PERSON: 'In-person',
  VIRTUAL: 'Virtual',
  RETREAT: 'Retreat',
  SOUL_TRAVEL: 'Soul travel',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatPrice(p: number | string | undefined) {
  if (p === undefined) return 'Free';
  const n = typeof p === 'string' ? parseFloat(p) : p;
  if (!Number.isFinite(n) || n === 0) return 'Free';
  return `$${n.toFixed(0)}`;
}

export default function AdminEventsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortBy>('sortOrder');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const canReorder = sortBy === 'sortOrder';
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [orderedIds, setOrderedIds] = useState<string[] | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'events', page, search, statusFilter, typeFilter, sortBy, sortDir],
    queryFn: async () => {
      const { data } = await api.get('/admin/events', {
        params: {
          page,
          limit: 20,
          search: search || undefined,
          status: statusFilter || undefined,
          type: typeFilter || undefined,
          sortBy,
          sortDir,
        },
      });
      return data as { events: AdminEvent[]; total: number; totalPages: number };
    },
    placeholderData: { events: [], total: 0, totalPages: 0 },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });

  const reorderMutation = useMutation({
    mutationFn: (rows: Array<{ id: string; sortOrder: number }>) =>
      api.post('/admin/events/reorder', { rows }),
    onSuccess: () => { toast.success('Order saved'); invalidate(); },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to save order');
      setOrderedIds(null);
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      api.patch(`/admin/events/${id}/published`, { isPublished }),
    onSuccess: (_, { isPublished }) => {
      toast.success(isPublished ? 'Event published' : 'Event unpublished');
      invalidate();
    },
    onError: () => toast.error('Failed to update event'),
  });

  const serverEvents = data?.events ?? [];

  useEffect(() => { setOrderedIds(null); }, [data]);

  const events: AdminEvent[] = useMemo(() => {
    if (!orderedIds) return serverEvents;
    const map = new Map(serverEvents.map((e) => [e.id, e]));
    return orderedIds.map((id) => map.get(id)).filter((e): e is AdminEvent => !!e);
  }, [serverEvents, orderedIds]);

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
    const ids = events.map((e) => e.id);
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
      <AdminHeader title="Events" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-7xl space-y-4">

          {/* Search + filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by title, description, or guide…"
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
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value as TypeFilter); setPage(1); }}
              className="rounded-md border bg-white px-3 py-1.5 text-sm text-gray-700"
            >
              {typeFilters.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          <Card>
            <CardContent className="p-0">
              {canReorder && (
                <div className="border-b bg-purple-50 px-4 py-2 text-xs text-purple-800">
                  Drag the <GripVertical className="inline h-3 w-3" /> handle to reorder this admin view. Note: the public <code>/events</code> page stays chronological — admin order does not affect seekers.
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <th className="px-2 py-3 w-8"></th>
                      <th className="px-4 py-3">
                        <SortHeader label="Event" col="title" active={sortBy} dir={sortDir} onClick={handleSort} />
                      </th>
                      <th className="px-4 py-3">Guide</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">
                        <SortHeader label="Starts" col="startTime" active={sortBy} dir={sortDir} onClick={handleSort} />
                      </th>
                      <th className="px-4 py-3">Price</th>
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
                          {Array.from({ length: 9 }).map((_, j) => (
                            <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                          ))}
                        </tr>
                      ))
                    ) : events.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                          <Calendar className="mx-auto mb-2 h-8 w-8 opacity-40" />
                          No events match these filters.
                        </td>
                      </tr>
                    ) : (
                      events.map((ev) => {
                        const isDragging = draggingId === ev.id;
                        return (
                          <tr
                            key={ev.id}
                            className={`hover:bg-gray-50 ${isDragging ? 'opacity-40' : ''}`}
                            draggable={canReorder}
                            onDragStart={(e) => { setDraggingId(ev.id); e.dataTransfer.effectAllowed = 'move'; }}
                            onDragEnd={() => setDraggingId(null)}
                            onDragOver={(e) => { if (canReorder && draggingId) e.preventDefault(); }}
                            onDrop={(e) => { e.preventDefault(); handleDrop(ev.id); }}
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
                                {ev.coverImageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={ev.coverImageUrl} alt="" className="h-10 w-14 rounded object-cover" />
                                ) : (
                                  <div className="flex h-10 w-14 items-center justify-center rounded bg-gray-100 text-gray-400">
                                    <Calendar className="h-4 w-4" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-gray-900">{ev.title}</p>
                                  {ev.location && (
                                    <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                                      <MapPin className="h-3 w-3" />
                                      <span className="truncate">{ev.location}</span>
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {ev.guide.user.avatarUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={ev.guide.user.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                                ) : (
                                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-600">
                                    {ev.guide.displayName[0]}
                                  </div>
                                )}
                                <span className="text-gray-700">{ev.guide.displayName}</span>
                                {!ev.guide.user.isActive && (
                                  <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[10px]">Deactivated</Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">{TYPE_LABEL[ev.type] ?? ev.type}</td>
                            <td className="px-4 py-3 text-xs text-gray-600">{fmtDate(ev.startTime)}</td>
                            <td className="px-4 py-3 text-gray-900 font-medium">{formatPrice(ev.ticketTiers[0]?.price)}</td>
                            <td className="px-4 py-3">
                              {ev.isCancelled ? (
                                <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Cancelled</Badge>
                              ) : ev.isPublished ? (
                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 gap-1">
                                  <Eye className="h-3 w-3" /> Published
                                </Badge>
                              ) : (
                                <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 gap-1">
                                  <EyeOff className="h-3 w-3" /> Draft
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(ev.createdAt)}</td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end">
                                <button
                                  onClick={() => togglePublishMutation.mutate({ id: ev.id, isPublished: !ev.isPublished })}
                                  disabled={togglePublishMutation.isPending || ev.isCancelled}
                                  title={
                                    ev.isCancelled
                                      ? 'Cancelled events cannot be published'
                                      : ev.isPublished
                                        ? 'Hide from public /events'
                                        : 'Show on public /events'
                                  }
                                  className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
                                    ev.isPublished
                                      ? 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                                      : 'border-green-200 bg-white text-green-700 hover:bg-green-50'
                                  } disabled:opacity-40`}
                                >
                                  {ev.isPublished ? <><EyeOff className="h-3 w-3" /> Unpublish</> : <><Eye className="h-3 w-3" /> Publish</>}
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
                    {data?.total} events · Page {page} of {data?.totalPages}
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
