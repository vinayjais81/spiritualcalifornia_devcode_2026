'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AdminHeader } from '@/components/admin/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, FileText, CheckCircle, XCircle, User, MapPin } from 'lucide-react';
import { toast } from 'sonner';

interface Credential {
  id: string;
  title: string;
  institution: string | null;
  verificationStatus: string;
  documentUrl: string | null;
  issuedYear: number | null;
}

interface QueueGuide {
  id: string;
  displayName: string;
  tagline: string | null;
  location: string | null;
  verificationStatus: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
  };
  credentials: Credential[];
}

function GuideCard({ guide, onApprove, onReject, isPending }: {
  guide: QueueGuide;
  onApprove: () => void;
  onReject: (reason: string) => void;
  isPending: boolean;
}) {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const handleReject = () => {
    if (!rejectReason.trim()) {
      toast.error('Please enter a rejection reason');
      return;
    }
    onReject(rejectReason.trim());
    setShowRejectForm(false);
    setRejectReason('');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{guide.displayName}</CardTitle>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {guide.user.email}
              </span>
              {guide.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {guide.location}
                </span>
              )}
            </div>
            {guide.tagline && (
              <p className="mt-1 text-sm text-gray-600">{guide.tagline}</p>
            )}
          </div>
          <span className="text-xs text-gray-400">
            Applied {new Date(guide.createdAt).toLocaleDateString()}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Credentials */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Credentials ({guide.credentials.length})
          </p>
          {guide.credentials.length === 0 ? (
            <p className="text-sm text-gray-400">No credentials submitted</p>
          ) : (
            <div className="space-y-2">
              {guide.credentials.map((cred) => (
                <div key={cred.id} className="flex items-center justify-between rounded-lg border bg-gray-50 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{cred.title}</p>
                    {cred.institution && (
                      <p className="text-xs text-gray-500">
                        {cred.institution}{cred.issuedYear ? ` · ${cred.issuedYear}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {cred.documentUrl && (
                      <a
                        href={cred.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        View doc
                      </a>
                    )}
                    <Badge
                      className={
                        cred.verificationStatus === 'APPROVED'
                          ? 'bg-green-100 text-green-700 hover:bg-green-100'
                          : cred.verificationStatus === 'REJECTED'
                          ? 'bg-red-100 text-red-700 hover:bg-red-100'
                          : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100'
                      }
                    >
                      {cred.verificationStatus}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {!showRejectForm ? (
          <div className="flex gap-2 pt-1">
            <button
              onClick={onApprove}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              Approve Guide
            </button>
            <button
              onClick={() => setShowRejectForm(true)}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              Reject
            </button>
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            <p className="text-sm font-medium text-gray-700">Rejection reason:</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this guide is being rejected…"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={handleReject}
                disabled={isPending}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Confirm Rejection
              </button>
              <button
                onClick={() => setShowRejectForm(false)}
                className="rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function VerificationPage() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'verification', page],
    queryFn: async () => {
      const { data } = await api.get('/admin/verification', {
        params: { page, limit: 10 },
      });
      return data;
    },
    placeholderData: { guides: [], total: 0, totalPages: 0 },
  });

  const approveMutation = useMutation({
    mutationFn: (guideId: string) => api.patch(`/admin/verification/${guideId}/approve`),
    onSuccess: () => {
      toast.success('Guide approved');
      queryClient.invalidateQueries({ queryKey: ['admin', 'verification'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'guides'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
    onError: () => toast.error('Failed to approve guide'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ guideId, reason }: { guideId: string; reason: string }) =>
      api.patch(`/admin/verification/${guideId}/reject`, { reason }),
    onSuccess: () => {
      toast.success('Guide rejected');
      queryClient.invalidateQueries({ queryKey: ['admin', 'verification'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'guides'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
    onError: () => toast.error('Failed to reject guide'),
  });

  const guides: QueueGuide[] = data?.guides ?? [];

  return (
    <div className="flex flex-col overflow-hidden">
      <AdminHeader title="Verification Queue" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl space-y-4">

          {/* Summary */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <ShieldCheck className="h-4 w-4 text-orange-500" />
            <span>
              {isLoading ? '…' : data?.total ?? 0} guide{(data?.total ?? 0) !== 1 ? 's' : ''} awaiting review
            </span>
          </div>

          {/* Queue */}
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6 space-y-3">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-16 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : guides.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-gray-400">
                <ShieldCheck className="mb-3 h-12 w-12 opacity-30" />
                <p className="text-base font-medium">All caught up!</p>
                <p className="text-sm">No guides pending verification.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {guides.map((guide) => (
                <GuideCard
                  key={guide.id}
                  guide={guide}
                  isPending={approveMutation.isPending || rejectMutation.isPending}
                  onApprove={() => approveMutation.mutate(guide.id)}
                  onReject={(reason) => rejectMutation.mutate({ guideId: guide.id, reason })}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {(data?.totalPages ?? 0) > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Page {page} of {data?.totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded border px-3 py-1.5 text-xs disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= (data?.totalPages ?? 1)}
                  className="rounded border px-3 py-1.5 text-xs disabled:opacity-40"
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
