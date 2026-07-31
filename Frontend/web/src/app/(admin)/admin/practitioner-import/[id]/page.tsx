'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AdminHeader } from '@/components/admin/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Check, Download, Play, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/apiError';

type ProspectStatus =
  | 'PENDING'
  | 'NEEDS_REVIEW'
  | 'SKIPPED_NO_EMAIL'
  | 'SKIPPED_DUPLICATE'
  | 'SKIPPED_SUPPRESSED'
  | 'SKIPPED_NOT_A_PERSON'
  | 'EXCLUDED'
  | 'ACCOUNT_CREATED';

interface Prospect {
  id: string;
  sheetName: string;
  rowNumber: number;
  name: string;
  email: string | null;
  city: string | null;
  modality: string | null;
  websiteUrl: string | null;
  categorySlug: string | null;
  subcategorySlug: string | null;
  status: ProspectStatus;
  skipReason: string | null;
  workedNote: string | null;
  workedAt: string | null;
  userId: string | null;
}

interface Batch {
  id: string;
  filename: string;
  sourceLabel: string | null;
  status: 'DRAFT' | 'COMMITTED' | 'ARCHIVED';
  rowsTotal: number;
  rowsImportable: number;
  accountsCreated: number;
  createdAt: string;
  committedAt: string | null;
  counts: Partial<Record<ProspectStatus, number>>;
  sheets: Array<{ name: string; rows: number }>;
}

/** Label, colour, and — the useful part — what an admin can do about it. */
const STATUS_META: Record<ProspectStatus, { label: string; className: string; hint: string }> = {
  PENDING: {
    label: 'Ready',
    className: 'bg-green-100 text-green-800 border-green-200',
    hint: 'Will become an invited guide account when you commit.',
  },
  NEEDS_REVIEW: {
    label: 'Needs review',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
    hint: 'Reads as an organisation, or its sheet has no category. Approve to include it.',
  },
  SKIPPED_NO_EMAIL: {
    label: 'No email',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    hint: 'Nothing to invite. Add an address you find by hand to bring it in.',
  },
  SKIPPED_DUPLICATE: {
    label: 'Duplicate',
    className: 'bg-orange-100 text-orange-800 border-orange-200',
    hint: 'Another row or an existing account already uses this address.',
  },
  SKIPPED_SUPPRESSED: {
    label: 'Opted out',
    className: 'bg-red-100 text-red-800 border-red-200',
    hint: 'This address asked to be removed. It cannot be re-added.',
  },
  SKIPPED_NOT_A_PERSON: {
    label: 'Not a person',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
    hint: "The spreadsheet's source note, not a practitioner.",
  },
  EXCLUDED: {
    label: 'Excluded',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
    hint: 'Excluded by an admin. Stays excluded if the list is imported again.',
  },
  ACCOUNT_CREATED: {
    label: 'Account created',
    className: 'bg-purple-100 text-purple-800 border-purple-200',
    hint: 'Invited account exists. It is invisible publicly until the practitioner claims it.',
  },
};

const FILTERS: Array<{ key: ProspectStatus | 'ALL'; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Ready' },
  { key: 'NEEDS_REVIEW', label: 'Needs review' },
  { key: 'SKIPPED_NO_EMAIL', label: 'No email' },
  { key: 'SKIPPED_DUPLICATE', label: 'Duplicate' },
  { key: 'SKIPPED_SUPPRESSED', label: 'Opted out' },
  { key: 'SKIPPED_NOT_A_PERSON', label: 'Not a person' },
  { key: 'EXCLUDED', label: 'Excluded' },
  { key: 'ACCOUNT_CREATED', label: 'Created' },
];

export default function ImportBatchPage() {
  const params = useParams<{ id: string }>();
  const batchId = params.id;
  const qc = useQueryClient();

  const [filter, setFilter] = useState<ProspectStatus | 'ALL'>('ALL');
  const [sheet, setSheet] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [emailDrafts, setEmailDrafts] = useState<Record<string, string>>({});

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'import-batch', batchId] });
    qc.invalidateQueries({ queryKey: ['admin', 'import-rows', batchId] });
  };

  const { data: batch, isLoading: batchLoading } = useQuery<Batch>({
    queryKey: ['admin', 'import-batch', batchId],
    queryFn: () => api.get(`/admin/practitioner-import/${batchId}`).then((r) => r.data),
  });

  const { data: rowsData, isLoading: rowsLoading } = useQuery<{
    rows: Prospect[];
    total: number;
    page: number;
    pages: number;
  }>({
    queryKey: ['admin', 'import-rows', batchId, filter, sheet, q, page],
    queryFn: () =>
      api
        .get(`/admin/practitioner-import/${batchId}/rows`, {
          params: {
            ...(filter !== 'ALL' ? { status: filter } : {}),
            ...(sheet ? { sheet } : {}),
            ...(q ? { q } : {}),
            page,
            limit: 50,
          },
        })
        .then((r) => r.data),
  });

  // Shared handlers rather than a hook-returning helper — wrapping useMutation
  // in a function breaks the rules of hooks even when the call order happens to
  // be stable.
  const onRowSuccess = (message: string) => () => {
    toast.success(message);
    invalidate();
  };
  const onRowError = (e: unknown) => toast.error(apiErrorMessage(e, 'That did not work.'));

  const setEmail = useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) =>
      api.patch(`/admin/practitioner-import/rows/${id}`, { email }).then((r) => r.data),
    onSuccess: onRowSuccess('Email saved — the row is ready to import.'),
    onError: onRowError,
  });

  const approve = useMutation({
    mutationFn: (id: string) =>
      api.post(`/admin/practitioner-import/rows/${id}/approve`).then((r) => r.data),
    onSuccess: onRowSuccess('Row approved.'),
    onError: onRowError,
  });

  const exclude = useMutation({
    mutationFn: (id: string) =>
      api.post(`/admin/practitioner-import/rows/${id}/exclude`, {}).then((r) => r.data),
    onSuccess: onRowSuccess('Row excluded — it stays excluded on future imports.'),
    onError: onRowError,
  });

  const note = useMutation({
    mutationFn: ({ id, workedNote }: { id: string; workedNote: string }) =>
      api.patch(`/admin/practitioner-import/rows/${id}`, { workedNote }).then((r) => r.data),
    onSuccess: onRowSuccess('Note saved.'),
    onError: onRowError,
  });

  const commit = useMutation({
    mutationFn: () => api.post(`/admin/practitioner-import/${batchId}/commit`).then((r) => r.data),
    onSuccess: (res: { created: number; failed: number }) => {
      toast.success(
        res.failed
          ? `${res.created} accounts created, ${res.failed} rows failed — see their reasons below.`
          : `${res.created} invited accounts created. No email has been sent.`,
      );
      invalidate();
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, 'Commit failed.')),
  });

  const counts = batch?.counts ?? {};
  const readyCount = counts.PENDING ?? 0;

  const csvHref = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? '';
    const query = new URLSearchParams();
    if (filter !== 'ALL') query.set('status', filter);
    if (sheet) query.set('sheet', sheet);
    return `${base}/admin/practitioner-import/${batchId}/rows.csv?${query.toString()}`;
  }, [batchId, filter, sheet]);

  return (
    <div>
      <AdminHeader title="Import review" />

      <div className="space-y-6 p-6">
        <Link
          href="/admin/practitioner-import"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All imports
        </Link>

        {batchLoading || !batch ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-3">
                {batch.filename}
                <Badge variant="outline">{batch.status.toLowerCase()}</Badge>
                {batch.sourceLabel && (
                  <span className="text-sm font-normal text-gray-500">{batch.sourceLabel}</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
                {FILTERS.filter((f) => f.key !== 'ALL').map((f) => (
                  <button
                    key={f.key}
                    onClick={() => {
                      setFilter(f.key as ProspectStatus);
                      setPage(1);
                    }}
                    className="rounded-lg border p-3 text-left transition hover:border-purple-300"
                  >
                    <div className="text-2xl font-semibold tabular-nums text-gray-900">
                      {counts[f.key as ProspectStatus] ?? 0}
                    </div>
                    <div className="text-xs text-gray-500">{f.label}</div>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t pt-4">
                <Button
                  onClick={() => commit.mutate()}
                  disabled={commit.isPending || readyCount === 0}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Play className="mr-1.5 h-3.5 w-3.5" />
                  {commit.isPending
                    ? 'Creating accounts…'
                    : `Create ${readyCount} invited account${readyCount === 1 ? '' : 's'}`}
                </Button>
                <a href={csvHref} className="inline-flex">
                  <Button variant="outline" type="button">
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Export current filter
                  </Button>
                </a>
                <p className="text-xs text-gray-500">
                  Accounts are created dormant — no password, not published, invisible to
                  the public site. <strong>Nothing is emailed.</strong>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Rows</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => {
                    setFilter(f.key);
                    setPage(1);
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    filter === f.key
                      ? 'border-purple-400 bg-purple-50 text-purple-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {f.label}
                  {f.key !== 'ALL' && counts[f.key as ProspectStatus] !== undefined && (
                    <span className="ml-1.5 tabular-nums text-gray-400">
                      {counts[f.key as ProspectStatus]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search name, email or city"
                className="w-72"
              />
              <select
                value={sheet}
                onChange={(e) => {
                  setSheet(e.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-md border border-gray-200 px-3 text-sm"
              >
                <option value="">All sheets</option>
                {batch?.sheets.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} ({s.rows})
                  </option>
                ))}
              </select>
            </div>

            {filter !== 'ALL' && (
              <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
                {STATUS_META[filter as ProspectStatus].hint}
              </p>
            )}

            {rowsLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : !rowsData?.rows.length ? (
              <p className="py-10 text-center text-sm text-gray-500">No rows match this filter.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="pb-2 pr-4 font-medium">Practitioner</th>
                      <th className="pb-2 pr-4 font-medium">Email</th>
                      <th className="pb-2 pr-4 font-medium">Category</th>
                      <th className="pb-2 pr-4 font-medium">Status</th>
                      <th className="pb-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsData.rows.map((row) => {
                      const meta = STATUS_META[row.status];
                      const canRescue =
                        row.status !== 'ACCOUNT_CREATED' &&
                        row.status !== 'SKIPPED_SUPPRESSED' &&
                        row.status !== 'SKIPPED_NOT_A_PERSON';
                      return (
                        <tr key={row.id} className="border-b align-top last:border-0">
                          <td className="py-3 pr-4">
                            <div className="font-medium text-gray-900">{row.name}</div>
                            <div className="text-xs text-gray-500">
                              {[row.city, row.modality].filter(Boolean).join(' · ') || '—'}
                            </div>
                            <div className="mt-0.5 text-[11px] text-gray-400">
                              {row.sheetName} · row {row.rowNumber}
                            </div>
                            {row.workedNote && (
                              <div className="mt-1 text-[11px] italic text-blue-700">
                                {row.workedNote}
                              </div>
                            )}
                          </td>

                          <td className="py-3 pr-4">
                            {row.email ? (
                              <span className="text-gray-800">{row.email}</span>
                            ) : canRescue ? (
                              <div className="flex gap-1.5">
                                <Input
                                  value={emailDrafts[row.id] ?? ''}
                                  onChange={(e) =>
                                    setEmailDrafts((d) => ({ ...d, [row.id]: e.target.value }))
                                  }
                                  placeholder="add an address"
                                  className="h-8 w-52 text-xs"
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8"
                                  disabled={!emailDrafts[row.id]?.trim()}
                                  onClick={() =>
                                    setEmail.mutate({ id: row.id, email: emailDrafts[row.id].trim() })
                                  }
                                >
                                  Save
                                </Button>
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                            {row.websiteUrl && (
                              <a
                                href={row.websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 block text-[11px] text-purple-600 hover:underline"
                              >
                                {row.websiteUrl.replace(/^https?:\/\//, '')}
                              </a>
                            )}
                          </td>

                          <td className="py-3 pr-4 text-xs text-gray-600">
                            {row.subcategorySlug ? (
                              <>
                                {row.subcategorySlug}
                                <div className="text-[11px] text-gray-400">{row.categorySlug}</div>
                              </>
                            ) : (
                              <span className="text-amber-600">unmapped</span>
                            )}
                          </td>

                          <td className="py-3 pr-4">
                            <Badge variant="outline" className={meta.className}>
                              {meta.label}
                            </Badge>
                            {row.skipReason && (
                              <div className="mt-1 max-w-[16rem] text-[11px] text-gray-500">
                                {row.skipReason}
                              </div>
                            )}
                          </td>

                          <td className="py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {row.status === 'NEEDS_REVIEW' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => approve.mutate(row.id)}
                                >
                                  <Check className="mr-1 h-3 w-3" /> Approve
                                </Button>
                              )}
                              {canRescue && row.status !== 'EXCLUDED' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-red-600"
                                  onClick={() => exclude.mutate(row.id)}
                                >
                                  <X className="mr-1 h-3 w-3" /> Exclude
                                </Button>
                              )}
                              {row.status !== 'ACCOUNT_CREATED' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    const value = window.prompt(
                                      'Outreach note (e.g. "messaged via Psychology Today, 12 Aug")',
                                      row.workedNote ?? '',
                                    );
                                    if (value !== null) note.mutate({ id: row.id, workedNote: value });
                                  }}
                                >
                                  Note
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {rowsData && rowsData.pages > 1 && (
              <div className="flex items-center justify-between border-t pt-3 text-sm">
                <span className="text-gray-500">
                  Page {rowsData.page} of {rowsData.pages} · {rowsData.total} rows
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= rowsData.pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
