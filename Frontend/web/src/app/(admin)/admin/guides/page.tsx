'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AdminHeader } from '@/components/admin/header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Star, CheckCircle, Clock, XCircle, BookOpen, AlertTriangle, Sparkles, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { SortHeader } from '@/components/admin/SortHeader';

type SortBy = 'sortOrder' | 'displayName' | 'createdAt' | 'rating';
type SortDir = 'asc' | 'desc';

type VerificationStatus = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'FLAGGED';

interface Guide {
  id: string;
  displayName: string;
  tagline: string | null;
  location: string | null;
  verificationStatus: VerificationStatus;
  averageRating: number;
  totalReviews: number;
  isFeatured: boolean;
  sortOrder: number;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
    isActive: boolean;
    isTestAccount: boolean;
    isEmailVerified: boolean;
  };
  credentials: Array<{ id: string; verificationStatus: string; title: string }>;
}

const statusConfig: Record<VerificationStatus, { label: string; className: string; icon: React.ElementType }> = {
  APPROVED:  { label: 'Approved',   className: 'bg-green-100 text-green-700',  icon: CheckCircle },
  PENDING:   { label: 'Pending',    className: 'bg-yellow-100 text-yellow-700', icon: Clock },
  IN_REVIEW: { label: 'In Review',  className: 'bg-blue-100 text-blue-700',    icon: Clock },
  REJECTED:  { label: 'Rejected',   className: 'bg-red-100 text-red-700',      icon: XCircle },
  FLAGGED:   { label: 'Flagged',    className: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
};

const statusFilters: Array<{ value: string; label: string }> = [
  { value: '',          label: 'All' },
  { value: 'APPROVED',  label: 'Approved' },
  { value: 'PENDING',   label: 'Pending' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'REJECTED',  label: 'Rejected' },
  { value: 'FLAGGED',   label: 'Flagged' },
];

export default function GuidesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('sortOrder');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const queryClient = useQueryClient();

  // Drag-to-reorder state. Only meaningful in the default sortOrder view —
  // dragging while sorted by another column would silently lose the user's
  // change because the server orders by that column instead. We hide the
  // grip handles when sortBy !== 'sortOrder' to make that constraint clear.
  const canReorder = sortBy === 'sortOrder';
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [orderedIds, setOrderedIds] = useState<string[] | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'guides', page, search, statusFilter, sortBy, sortDir],
    queryFn: async () => {
      const { data } = await api.get('/admin/guides', {
        params: {
          page,
          limit: 20,
          search: search || undefined,
          status: statusFilter || undefined,
          sortBy,
          sortDir,
        },
      });
      return data;
    },
    placeholderData: { guides: [], total: 0, totalPages: 0 },
  });

  const reorderMutation = useMutation({
    mutationFn: (rows: Array<{ id: string; sortOrder: number }>) =>
      api.post('/admin/guides/reorder', { rows }),
    onSuccess: () => {
      toast.success('Order saved');
      queryClient.invalidateQueries({ queryKey: ['admin', 'guides'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to save order');
      // Roll local optimistic order back to whatever the server thinks is true.
      setOrderedIds(null);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (guideId: string) => api.patch(`/admin/verification/${guideId}/approve`),
    onSuccess: () => {
      toast.success('Guide approved successfully');
      queryClient.invalidateQueries({ queryKey: ['admin', 'guides'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
    onError: () => toast.error('Failed to approve guide'),
  });

  const featureMutation = useMutation({
    mutationFn: ({ guideId, isFeatured }: { guideId: string; isFeatured: boolean }) =>
      api.patch(`/admin/guides/${guideId}/featured`, { isFeatured }),
    onSuccess: (_, { isFeatured }) => {
      toast.success(isFeatured ? 'Guide featured on practitioners page' : 'Removed from featured');
      queryClient.invalidateQueries({ queryKey: ['admin', 'guides'] });
    },
    onError: () => toast.error('Failed to update featured status'),
  });

  // Pre-launch test-account conversion. Admin pastes the real email; the
  // backend swaps it, invalidates the placeholder password, and (by default)
  // fires the claim-invite. The flag stays on the row as a historical marker
  // until the user actually claims it.
  const convertMutation = useMutation({
    mutationFn: ({ userId, newEmail }: { userId: string; newEmail: string }) =>
      api.patch(`/admin/users/${userId}/convert-test-account`, { newEmail, sendInvite: true }),
    onSuccess: () => {
      toast.success('Test account converted — claim invite sent');
      queryClient.invalidateQueries({ queryKey: ['admin', 'guides'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to convert test account');
    },
  });

  // Re-issues the claim invite when the original link expired or the email
  // bounced. The previous token is rotated, so any in-flight link goes dead
  // the moment this fires.
  const resendInviteMutation = useMutation({
    mutationFn: (userId: string) =>
      api.post(`/admin/users/${userId}/resend-claim-invite`),
    onSuccess: () => {
      toast.success('Claim invite re-sent');
      queryClient.invalidateQueries({ queryKey: ['admin', 'guides'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to resend invite');
    },
  });

  const serverGuides: Guide[] = data?.guides ?? [];

  // Reset any pending drag-state reordering when the server data refreshes
  // (e.g., after the mutation resolves) so the rendered order matches truth.
  useEffect(() => {
    setOrderedIds(null);
  }, [data]);

  // Compose the display order. While the user is mid-drag we apply the
  // optimistic orderedIds; otherwise we render whatever the server returned.
  const guides: Guide[] = useMemo(() => {
    if (!orderedIds) return serverGuides;
    const idToGuide = new Map(serverGuides.map((g) => [g.id, g]));
    return orderedIds.map((id) => idToGuide.get(id)).filter((g): g is Guide => !!g);
  }, [serverGuides, orderedIds]);

  const handleSort = (col: SortBy) => {
    if (sortBy === col) {
      // Toggle direction. For sortOrder, allow flipping to desc but the
      // canonical view is ascending — clicking again returns to default.
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir(col === 'rating' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const handleDrop = (targetId: string) => {
    if (!draggingId || draggingId === targetId) return;
    const ids = guides.map((g) => g.id);
    const fromIdx = ids.indexOf(draggingId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...ids];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setOrderedIds(next);
    setDraggingId(null);
    // Persist. sortOrder = page-aware index so paginated reorders work too.
    const base = (page - 1) * 20;
    reorderMutation.mutate(
      next.map((id, i) => ({ id, sortOrder: base + i })),
    );
  };

  return (
    <div className="flex flex-col overflow-hidden">
      <AdminHeader title="Guides" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-7xl space-y-4">

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search guides…"
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
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {canReorder && (
                <div className="border-b bg-purple-50 px-4 py-2 text-xs text-purple-800">
                  Drag the <GripVertical className="inline h-3 w-3" /> handle to reorder. The order is saved automatically and shows on the public /practitioners page.
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <th className="px-2 py-3 w-8"></th>
                      <th className="px-4 py-3">
                        <SortHeader label="Guide" col="displayName" active={sortBy} dir={sortDir} onClick={handleSort} />
                      </th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Credentials</th>
                      <th className="px-4 py-3">
                        <SortHeader label="Rating" col="rating" active={sortBy} dir={sortDir} onClick={handleSort} />
                      </th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Featured</th>
                      <th className="px-4 py-3">
                        <SortHeader label="Joined" col="createdAt" active={sortBy} dir={sortDir} onClick={handleSort} />
                      </th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {isLoading
                      ? Array.from({ length: 6 }).map((_, i) => (
                          <tr key={i}>
                            {Array.from({ length: 9 }).map((_, j) => (
                              <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                            ))}
                          </tr>
                        ))
                      : guides.length === 0
                      ? (
                          <tr>
                            <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                              <BookOpen className="mx-auto mb-2 h-8 w-8 opacity-40" />
                              No guides found
                            </td>
                          </tr>
                        )
                      : guides.map((guide) => {
                          const cfg = statusConfig[guide.verificationStatus] ?? statusConfig.PENDING;
                          const StatusIcon = cfg.icon;
                          const isDragging = draggingId === guide.id;
                          return (
                            <tr
                              key={guide.id}
                              className={`hover:bg-gray-50 ${isDragging ? 'opacity-40' : ''}`}
                              draggable={canReorder}
                              onDragStart={(e) => {
                                setDraggingId(guide.id);
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                              onDragEnd={() => setDraggingId(null)}
                              onDragOver={(e) => { if (canReorder && draggingId) e.preventDefault(); }}
                              onDrop={(e) => { e.preventDefault(); handleDrop(guide.id); }}
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
                                <div>
                                  <p className="font-medium text-gray-900">{guide.displayName}</p>
                                  <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                    <span>{guide.user.email}</span>
                                    {guide.user.isTestAccount && (
                                      <span
                                        className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800"
                                        title="Pre-launch test account. Use Convert to swap in the real email."
                                      >
                                        Test
                                      </span>
                                    )}
                                  </p>
                                  {guide.tagline && (
                                    <p className="mt-0.5 text-xs text-gray-400 line-clamp-1">{guide.tagline}</p>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {guide.location ?? '—'}
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs text-gray-500">
                                  {guide.credentials.length} credential{guide.credentials.length !== 1 ? 's' : ''}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {guide.totalReviews > 0 ? (
                                  <div className="flex items-center gap-1">
                                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                                    <span className="text-xs font-medium">{guide.averageRating.toFixed(1)}</span>
                                    <span className="text-xs text-gray-400">({guide.totalReviews})</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">No reviews</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <Badge className={`${cfg.className} hover:${cfg.className} gap-1`}>
                                  <StatusIcon className="h-3 w-3" />
                                  {cfg.label}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => featureMutation.mutate({ guideId: guide.id, isFeatured: !guide.isFeatured })}
                                  disabled={featureMutation.isPending || guide.verificationStatus !== 'APPROVED'}
                                  title={guide.verificationStatus !== 'APPROVED' ? 'Only approved guides can be featured' : guide.isFeatured ? 'Click to un-feature' : 'Click to feature'}
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                                    guide.isFeatured
                                      ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                  }`}
                                >
                                  <Sparkles className={`h-3 w-3 ${guide.isFeatured ? 'fill-amber-500 text-amber-500' : ''}`} />
                                  {guide.isFeatured ? 'Featured' : 'Feature'}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-500">
                                {new Date(guide.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  {guide.verificationStatus === 'PENDING' && (
                                    <button
                                      onClick={() => approveMutation.mutate(guide.id)}
                                      disabled={approveMutation.isPending}
                                      className="rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                                    >
                                      Approve
                                    </button>
                                  )}
                                  {/* Test-account actions. "Convert" until the guide claims it,
                                      then we offer Resend in case the original mail bounced. */}
                                  {guide.user.isTestAccount && !guide.user.isEmailVerified && (
                                    <>
                                      <button
                                        onClick={() => {
                                          const newEmail = window.prompt(
                                            `Convert "${guide.user.email}" to which real email?`,
                                            '',
                                          );
                                          if (!newEmail) return;
                                          const trimmed = newEmail.trim();
                                          if (!trimmed) return;
                                          if (!window.confirm(
                                            `Swap ${guide.user.email} → ${trimmed}? The current placeholder password stops working immediately and a claim-invite is sent.`,
                                          )) return;
                                          convertMutation.mutate({ userId: guide.user.id, newEmail: trimmed });
                                        }}
                                        disabled={convertMutation.isPending}
                                        className="rounded bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                                      >
                                        Convert
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (!window.confirm(
                                            `Re-send the claim invite to ${guide.user.email}? Any prior link will stop working.`,
                                          )) return;
                                          resendInviteMutation.mutate(guide.user.id);
                                        }}
                                        disabled={resendInviteMutation.isPending}
                                        className="rounded border border-amber-600 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                                      >
                                        Resend invite
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {(data?.totalPages ?? 0) > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-xs text-gray-500">
                    {data?.total} guides · Page {page} of {data?.totalPages}
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

