'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AdminHeader } from '@/components/admin/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, Phone, MessageSquare, Inbox, Clock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface ContactLead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  type: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
}

interface LeadsResponse {
  leads: ContactLead[];
  total: number;
  page: number;
  totalPages: number;
  statusCounts: Record<string, number>;
}

const TYPE_LABELS: Record<string, string> = {
  general: 'General Inquiry',
  guide: 'Become a Guide',
  partnership: 'Partnership',
  support: 'Technical Support',
  media: 'Media & Press',
  feedback: 'Feedback',
};

const STATUS_OPTIONS = ['new', 'in_progress', 'resolved'];

function statusBadgeClass(status: string) {
  if (status === 'new') return 'bg-blue-100 text-blue-700 hover:bg-blue-100';
  if (status === 'in_progress') return 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100';
  return 'bg-green-100 text-green-700 hover:bg-green-100';
}

function statusLabel(status: string) {
  if (status === 'new') return 'New';
  if (status === 'in_progress') return 'In Progress';
  return 'Resolved';
}

function LeadRow({ lead, onStatusChange, isPending }: {
  lead: ContactLead;
  onStatusChange: (id: string, status: string) => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-start gap-4 px-4 py-4">
        {/* Left: name + contact */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{lead.name}</span>
            <Badge className="bg-purple-50 text-purple-700 hover:bg-purple-50 text-xs">
              {TYPE_LABELS[lead.type] ?? lead.type}
            </Badge>
            <Badge className={`${statusBadgeClass(lead.status)} text-xs`}>
              {statusLabel(lead.status)}
            </Badge>
          </div>

          <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
            <a
              href={`mailto:${lead.email}`}
              className="flex items-center gap-1 text-blue-600 hover:underline"
            >
              <Mail className="h-3 w-3" />
              {lead.email}
            </a>
            {lead.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {lead.phone}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(lead.createdAt).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </span>
          </div>

          <p className="mt-1 text-sm font-medium text-gray-700">{lead.subject}</p>

          {expanded ? (
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{lead.message}</p>
          ) : (
            <p className="mt-1 line-clamp-2 text-sm text-gray-500">{lead.message}</p>
          )}

          {lead.message.length > 120 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs text-purple-600 hover:underline"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        {/* Right: status select */}
        <div className="shrink-0">
          <select
            value={lead.status}
            disabled={isPending}
            onChange={(e) => onStatusChange(lead.id, e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-50"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export default function ContactsPage() {
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<LeadsResponse>({
    queryKey: ['admin', 'contacts', page, filterStatus, filterType],
    queryFn: async () => {
      const { data } = await api.get('/contact/leads', {
        params: {
          page,
          limit: 20,
          ...(filterStatus ? { status: filterStatus } : {}),
          ...(filterType ? { type: filterType } : {}),
        },
      });
      return data;
    },
    placeholderData: { leads: [], total: 0, page: 1, totalPages: 0, statusCounts: {} },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/contact/leads/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['admin', 'contacts'] });
    },
    onError: () => toast.error('Failed to update status'),
  });

  const leads = data?.leads ?? [];
  const statusCounts = data?.statusCounts ?? {};
  const total = data?.total ?? 0;
  const newCount = statusCounts['new'] ?? 0;
  const inProgressCount = statusCounts['in_progress'] ?? 0;
  const resolvedCount = statusCounts['resolved'] ?? 0;

  return (
    <div className="flex flex-col overflow-hidden">
      <AdminHeader title="Contact Leads" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl space-y-6">

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Total Leads', value: total, icon: MessageSquare, color: 'text-purple-600' },
              { label: 'New', value: newCount, icon: Inbox, color: 'text-blue-600' },
              { label: 'In Progress', value: inProgressCount, icon: Clock, color: 'text-yellow-600' },
              { label: 'Resolved', value: resolvedCount, icon: CheckCircle2, color: 'text-green-600' },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
                <CardContent className="flex items-center gap-3 p-4">
                  <Icon className={`h-8 w-8 shrink-0 ${color} opacity-80`} />
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {isLoading ? '—' : value}
                    </p>
                    <p className="text-xs text-gray-500">{label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300"
            >
              <option value="">All Statuses</option>
              <option value="new">New</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>

            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300"
            >
              <option value="">All Types</option>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            {(filterStatus || filterType) && (
              <button
                onClick={() => { setFilterStatus(''); setFilterType(''); setPage(1); }}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Leads list */}
          <Card>
            {isLoading ? (
              <CardContent className="space-y-4 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </CardContent>
            ) : leads.length === 0 ? (
              <CardContent className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Mail className="mb-3 h-12 w-12 opacity-30" />
                <p className="text-base font-medium">No leads found</p>
                <p className="text-sm">
                  {filterStatus || filterType ? 'Try adjusting your filters.' : 'Contact form submissions will appear here.'}
                </p>
              </CardContent>
            ) : (
              <div>
                {leads.map((lead) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    isPending={updateStatusMutation.isPending}
                    onStatusChange={(id, status) => updateStatusMutation.mutate({ id, status })}
                  />
                ))}
              </div>
            )}
          </Card>

          {/* Pagination */}
          {(data?.totalPages ?? 0) > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Page {page} of {data?.totalPages} · {total} total leads
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
