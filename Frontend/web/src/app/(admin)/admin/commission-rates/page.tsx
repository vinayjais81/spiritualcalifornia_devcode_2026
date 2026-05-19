'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AdminHeader } from '@/components/admin/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Percent } from 'lucide-react';
import { toast } from 'sonner';

type Category = 'SERVICE' | 'EVENT' | 'TOUR' | 'PRODUCT';
const CATEGORIES: Category[] = ['SERVICE', 'EVENT', 'TOUR', 'PRODUCT'];
const DEFAULTS: Record<Category, number> = {
  SERVICE: 15,
  EVENT: 12,
  TOUR: 15,
  PRODUCT: 10,
};

interface CommissionRateRow {
  id: string;
  category: Category;
  guideId: string | null;
  guideName: string | null;
  percent: number;
  effectiveFrom: string;
  effectiveUntil: string | null;
  createdBy: string | null;
  createdAt: string;
}

export default function CommissionRatesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<CommissionRateRow[]>({
    queryKey: ['admin', 'commission-rates'],
    queryFn: () => api.get('/admin/commission-rates').then((r) => r.data),
  });

  const upsert = useMutation({
    mutationFn: (input: {
      category: Category;
      guideId?: string;
      percent: number;
      effectiveFrom?: string;
      effectiveUntil?: string;
    }) => api.post('/admin/commission-rates', input).then((r) => r.data),
    onSuccess: () => {
      toast.success('Commission rate saved');
      qc.invalidateQueries({ queryKey: ['admin', 'commission-rates'] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? 'Failed to save commission rate'),
  });

  // Currently-effective default rate per category (used in the table headers).
  const currentDefaults: Record<Category, CommissionRateRow | undefined> = {
    SERVICE: undefined,
    EVENT: undefined,
    TOUR: undefined,
    PRODUCT: undefined,
  };
  const overrides: CommissionRateRow[] = [];
  if (data) {
    const now = Date.now();
    for (const r of data) {
      const effective =
        new Date(r.effectiveFrom).getTime() <= now &&
        (!r.effectiveUntil || new Date(r.effectiveUntil).getTime() > now);
      if (!effective) continue;
      if (r.guideId === null) {
        currentDefaults[r.category] = r;
      } else {
        overrides.push(r);
      }
    }
  }

  return (
    <div className="space-y-6 p-6">
      <AdminHeader title="Commission Rates" />
      <p className="text-sm text-gray-500">
        Per-category platform commission. Set a per-guide override for partner deals or promotional rates.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Platform defaults
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {CATEGORIES.map((cat) => (
                <DefaultRateCard
                  key={cat}
                  category={cat}
                  current={currentDefaults[cat]}
                  fallback={DEFAULTS[cat]}
                  onSave={(percent) =>
                    upsert.mutate({ category: cat, percent })
                  }
                  saving={upsert.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-guide overrides</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : overrides.length === 0 ? (
            <p className="text-sm text-gray-500">
              No active overrides. Use the form below to set a guide-specific rate.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-gray-500">
                  <tr>
                    <th className="py-2 pr-4">Guide</th>
                    <th className="py-2 pr-4">Category</th>
                    <th className="py-2 pr-4">Rate</th>
                    <th className="py-2 pr-4">Effective from</th>
                    <th className="py-2 pr-4">Effective until</th>
                  </tr>
                </thead>
                <tbody>
                  {overrides.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{r.guideName ?? r.guideId}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline">{r.category}</Badge>
                      </td>
                      <td className="py-2 pr-4 font-mono">{Number(r.percent).toFixed(2)}%</td>
                      <td className="py-2 pr-4 text-gray-500">
                        {new Date(r.effectiveFrom).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-4 text-gray-500">
                        {r.effectiveUntil
                          ? new Date(r.effectiveUntil).toLocaleDateString()
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <OverrideForm onSubmit={(input) => upsert.mutate(input)} saving={upsert.isPending} />
        </CardContent>
      </Card>
    </div>
  );
}

function DefaultRateCard({
  category,
  current,
  fallback,
  onSave,
  saving,
}: {
  category: Category;
  current: CommissionRateRow | undefined;
  fallback: number;
  onSave: (percent: number) => void;
  saving: boolean;
}) {
  const [val, setVal] = useState<string>(
    current ? Number(current.percent).toFixed(2) : String(fallback),
  );
  return (
    <div className="rounded-md border bg-white p-4">
      <div className="text-xs uppercase text-gray-500">{category}</div>
      <div className="mt-1 text-2xl font-semibold">
        {current ? `${Number(current.percent)}%` : `${fallback}% (default)`}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="number"
          step="0.01"
          min={0}
          max={100}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          className="w-20 rounded border px-2 py-1 text-sm"
        />
        <span className="text-sm text-gray-500">%</span>
        <button
          disabled={saving || isNaN(Number(val))}
          onClick={() => onSave(Number(val))}
          className="ml-auto rounded bg-gray-900 px-3 py-1 text-xs text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function OverrideForm({
  onSubmit,
  saving,
}: {
  onSubmit: (input: {
    category: Category;
    guideId: string;
    percent: number;
    effectiveFrom?: string;
    effectiveUntil?: string;
  }) => void;
  saving: boolean;
}) {
  const [category, setCategory] = useState<Category>('SERVICE');
  const [guideId, setGuideId] = useState('');
  const [percent, setPercent] = useState('15');
  const [from, setFrom] = useState('');
  const [until, setUntil] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!guideId.trim()) return toast.error('Guide ID is required');
        const p = Number(percent);
        if (isNaN(p) || p < 0 || p > 100)
          return toast.error('Percent must be between 0 and 100');
        onSubmit({
          category,
          guideId: guideId.trim(),
          percent: p,
          effectiveFrom: from || undefined,
          effectiveUntil: until || undefined,
        });
      }}
      className="mt-6 grid grid-cols-1 gap-3 rounded-md border bg-gray-50 p-4 md:grid-cols-5"
    >
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as Category)}
        className="rounded border px-2 py-1 text-sm"
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input
        placeholder="Guide ID"
        value={guideId}
        onChange={(e) => setGuideId(e.target.value)}
        className="rounded border px-2 py-1 text-sm"
      />
      <input
        type="number"
        step="0.01"
        min={0}
        max={100}
        placeholder="Percent"
        value={percent}
        onChange={(e) => setPercent(e.target.value)}
        className="rounded border px-2 py-1 text-sm"
      />
      <input
        type="date"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="rounded border px-2 py-1 text-sm"
      />
      <div className="flex gap-2">
        <input
          type="date"
          value={until}
          onChange={(e) => setUntil(e.target.value)}
          className="flex-1 rounded border px-2 py-1 text-sm"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-purple-600 px-3 py-1 text-xs text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Add override'}
        </button>
      </div>
    </form>
  );
}
