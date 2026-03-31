'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AdminHeader } from '@/components/admin/header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Star, CheckCircle, Clock, XCircle, BookOpen, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

type VerificationStatus = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'FLAGGED';

interface Guide {
  id: string;
  displayName: string;
  tagline: string | null;
  location: string | null;
  verificationStatus: VerificationStatus;
  averageRating: number;
  totalReviews: number;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
    isActive: boolean;
    isBanned: boolean;
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
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'guides', page, search, statusFilter],
    queryFn: async () => {
      const { data } = await api.get('/admin/guides', {
        params: {
          page,
          limit: 20,
          search: search || undefined,
          status: statusFilter || undefined,
        },
      });
      return data;
    },
    placeholderData: { guides: [], total: 0, totalPages: 0 },
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

  const guides: Guide[] = data?.guides ?? [];

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
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-3">Guide</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Credentials</th>
                      <th className="px-4 py-3">Rating</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {isLoading
                      ? Array.from({ length: 6 }).map((_, i) => (
                          <tr key={i}>
                            {Array.from({ length: 6 }).map((_, j) => (
                              <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                            ))}
                          </tr>
                        ))
                      : guides.length === 0
                      ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                              <BookOpen className="mx-auto mb-2 h-8 w-8 opacity-40" />
                              No guides found
                            </td>
                          </tr>
                        )
                      : guides.map((guide) => {
                          const cfg = statusConfig[guide.verificationStatus] ?? statusConfig.PENDING;
                          const StatusIcon = cfg.icon;
                          return (
                            <tr key={guide.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-medium text-gray-900">{guide.displayName}</p>
                                  <p className="text-xs text-gray-500">{guide.user.email}</p>
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
                                {guide.verificationStatus === 'PENDING' && (
                                  <button
                                    onClick={() => approveMutation.mutate(guide.id)}
                                    disabled={approveMutation.isPending}
                                    className="rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                                  >
                                    Approve
                                  </button>
                                )}
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
