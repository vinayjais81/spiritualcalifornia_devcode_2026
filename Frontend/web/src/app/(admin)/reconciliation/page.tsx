'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AdminHeader } from '@/components/admin/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface Mismatch {
  id: string;
  stripeBalanceTxnId: string;
  stripeType: string;
  stripeAmount: number;
  stripeCurrency: string;
  stripeCreatedAt: string;
  expectedLedgerEntryType: string | null;
  paymentId: string | null;
  details: any;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

const fmtMoney = (n: number) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });

export default function ReconciliationPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'open' | 'resolved'>('open');

  const { data, isLoading } = useQuery<Mismatch[]>({
    queryKey: ['admin', 'reconciliation-mismatches', tab],
    queryFn: () =>
      api
        .get('/admin/reconciliation/mismatches', {
          params: { resolved: tab === 'resolved', limit: 200 },
        })
        .then((r) => r.data),
  });

  const resolve = useMutation({
    mutationFn: (input: { id: string; reason: string }) =>
      api
        .post(`/admin/reconciliation/mismatches/${input.id}/resolve`, {
          reason: input.reason,
        })
        .then((r) => r.data),
    onSuccess: () => {
      toast.success('Marked resolved');
      qc.invalidateQueries({ queryKey: ['admin', 'reconciliation-mismatches'] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? 'Failed to resolve'),
  });

  return (
    <div className="space-y-6 p-6">
      <AdminHeader title="Reconciliation" />
      <p className="text-sm text-gray-500">
        Drift between Stripe truth and our ledger. Each row needs operator
        attention — never auto-corrected.
      </p>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('open')}
          className={`rounded px-3 py-1.5 text-sm ${
            tab === 'open'
              ? 'bg-purple-600 text-white'
              : 'border bg-white text-gray-700'
          }`}
        >
          Open
        </button>
        <button
          onClick={() => setTab('resolved')}
          className={`rounded px-3 py-1.5 text-sm ${
            tab === 'resolved'
              ? 'bg-purple-600 text-white'
              : 'border bg-white text-gray-700'
          }`}
        >
          Resolved
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tab === 'open' ? 'Open mismatches' : 'Resolved mismatches'}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !data?.length ? (
            <p className="text-sm text-gray-500">
              {tab === 'open'
                ? 'No open mismatches — Stripe and ledger are in sync.'
                : 'No resolved mismatches yet.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-gray-500">
                  <tr>
                    <th className="py-2 pr-4">When</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2 pr-4">Stripe ID</th>
                    <th className="py-2 pr-4">Expected ledger entry</th>
                    <th className="py-2 pr-4">Payment</th>
                    {tab === 'open' && <th className="py-2 pr-4">Action</th>}
                    {tab === 'resolved' && <th className="py-2 pr-4">Note</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 text-gray-500">
                        {new Date(m.stripeCreatedAt).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline">{m.stripeType}</Badge>
                      </td>
                      <td className="py-2 pr-4 font-mono">
                        {fmtMoney(m.stripeAmount)}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs text-gray-500">
                        {m.stripeBalanceTxnId.slice(0, 22)}…
                      </td>
                      <td className="py-2 pr-4 text-gray-500">
                        {m.expectedLedgerEntryType ?? '—'}
                      </td>
                      <td className="py-2 pr-4 text-gray-500">
                        {m.paymentId ? m.paymentId.slice(0, 10) + '…' : '—'}
                      </td>
                      {tab === 'open' && (
                        <td className="py-2 pr-4">
                          <button
                            onClick={() => {
                              const reason = prompt(
                                'Resolution note — what action did you take?',
                              );
                              if (reason && reason.trim()) {
                                resolve.mutate({ id: m.id, reason: reason.trim() });
                              }
                            }}
                            className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700"
                          >
                            Mark resolved
                          </button>
                        </td>
                      )}
                      {tab === 'resolved' && (
                        <td className="py-2 pr-4 text-xs text-gray-500">
                          {m.resolutionNote ?? '—'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
