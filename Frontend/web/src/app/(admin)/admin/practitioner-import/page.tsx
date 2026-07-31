'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AdminHeader } from '@/components/admin/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { FileSpreadsheet, Upload, Users } from 'lucide-react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/apiError';

interface ImportBatch {
  id: string;
  filename: string;
  sourceLabel: string | null;
  status: 'DRAFT' | 'COMMITTED' | 'ARCHIVED';
  rowsTotal: number;
  rowsImportable: number;
  accountsCreated: number;
  createdAt: string;
  committedAt: string | null;
  uploadedBy: { firstName: string; lastName: string; email: string };
  _count: { prospects: number };
}

const STATUS_STYLE: Record<ImportBatch['status'], string> = {
  DRAFT: 'bg-amber-100 text-amber-800 border-amber-200',
  COMMITTED: 'bg-green-100 text-green-800 border-green-200',
  ARCHIVED: 'bg-gray-100 text-gray-600 border-gray-200',
};

export default function PractitionerImportPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sourceLabel, setSourceLabel] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const { data: batches, isLoading } = useQuery<ImportBatch[]>({
    queryKey: ['admin', 'practitioner-import'],
    queryFn: () => api.get('/admin/practitioner-import').then((r) => r.data),
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a spreadsheet first.');
      const form = new FormData();
      form.append('file', file);
      if (sourceLabel.trim()) form.append('sourceLabel', sourceLabel.trim());
      const { data } = await api.post('/admin/practitioner-import/upload', form);
      return data;
    },
    onSuccess: (batch: { id: string; rowsTotal: number }) => {
      toast.success(`Parsed ${batch.rowsTotal} rows — review before anything is created.`);
      qc.invalidateQueries({ queryKey: ['admin', 'practitioner-import'] });
      setFile(null);
      setSourceLabel('');
      if (fileRef.current) fileRef.current.value = '';
      router.push(`/admin/practitioner-import/${batch.id}`);
    },
    // Never fail silently — see docs/form-validation-feedback.md.
    onError: (e: unknown) => toast.error(apiErrorMessage(e, 'Could not read that file.')),
  });

  return (
    <div>
      <AdminHeader title="Practitioner Import" />

      <div className="space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4" /> Import a practitioner list
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="max-w-2xl text-sm text-gray-600">
              Upload an .xlsx list and we&apos;ll parse it into reviewable rows. Nothing
              is created and <strong>no email is sent</strong> until you review the
              result and commit it.
            </p>

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <label htmlFor="import-file" className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Spreadsheet (.xlsx)
                </label>
                <Input
                  id="import-file"
                  ref={fileRef}
                  type="file"
                  accept=".xlsx"
                  className="w-80"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="import-label" className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Source label (optional)
                </label>
                <Input
                  id="import-label"
                  value={sourceLabel}
                  onChange={(e) => setSourceLabel(e.target.value)}
                  placeholder="Bay Area list, Jul 2026"
                  className="w-72"
                />
              </div>
              <Button
                onClick={() => upload.mutate()}
                disabled={upload.isPending}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {upload.isPending ? 'Parsing…' : 'Parse spreadsheet'}
              </Button>
            </div>

            <p className="text-xs text-gray-500">
              Expected: one sheet per modality, a header row on row 1, and a column
              whose header mentions Name, City, Email or Website. Sheets with other
              layouts still import — unrecognised headers are reported rather than
              guessed at.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" /> Previous imports
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : !batches?.length ? (
              <p className="py-8 text-center text-sm text-gray-500">
                No imports yet. Upload a list above to get started.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="pb-2 pr-4 font-medium">File</th>
                      <th className="pb-2 pr-4 font-medium">Status</th>
                      <th className="pb-2 pr-4 text-right font-medium tabular-nums">Rows</th>
                      <th className="pb-2 pr-4 text-right font-medium tabular-nums">Ready</th>
                      <th className="pb-2 pr-4 text-right font-medium tabular-nums">Accounts</th>
                      <th className="pb-2 pr-4 font-medium">Uploaded</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((b) => (
                      <tr key={b.id} className="border-b last:border-0">
                        <td className="py-3 pr-4">
                          <div className="font-medium text-gray-900">{b.filename}</div>
                          {b.sourceLabel && (
                            <div className="text-xs text-gray-500">{b.sourceLabel}</div>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant="outline" className={STATUS_STYLE[b.status]}>
                            {b.status.toLowerCase()}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums">{b.rowsTotal}</td>
                        <td className="py-3 pr-4 text-right tabular-nums">{b.rowsImportable}</td>
                        <td className="py-3 pr-4 text-right tabular-nums">
                          {b.accountsCreated > 0 ? (
                            <span className="inline-flex items-center gap-1 font-medium text-green-700">
                              <Users className="h-3 w-3" /> {b.accountsCreated}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-xs text-gray-500">
                          {new Date(b.createdAt).toLocaleDateString()} ·{' '}
                          {b.uploadedBy.firstName} {b.uploadedBy.lastName}
                        </td>
                        <td className="py-3 text-right">
                          <Link
                            href={`/admin/practitioner-import/${b.id}`}
                            className="text-sm font-medium text-purple-600 hover:text-purple-700"
                          >
                            Review →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
