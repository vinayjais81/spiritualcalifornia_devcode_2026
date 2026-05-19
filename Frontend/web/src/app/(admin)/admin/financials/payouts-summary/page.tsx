'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AdminHeader } from '@/components/admin/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type Category = 'ALL' | 'SERVICE' | 'EVENT' | 'TOUR' | 'PRODUCT';

interface Summary {
  window: { since: string; until: string };
  category: Category;
  grossSales: number;
  commissionRevenue: number;
  stripeFees: number;
  netPayableAccrued: number;
  paidOut: number;
  outstandingPayable: number;
}

const fmt = (n: number) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function PayoutsSummaryPage() {
  const [since, setSince] = useState(isoDaysAgo(30));
  const [until, setUntil] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<Category>('ALL');

  const { data, isLoading } = useQuery<Summary>({
    queryKey: ['admin', 'payouts-summary', since, until, category],
    queryFn: async () => {
      const params: Record<string, string> = { since, until };
      if (category !== 'ALL') params.category = category;
      const { data } = await api.get('/admin/financials/payouts-summary', { params });
      return data;
    },
  });

  return (
    <div className="space-y-6 p-6">
      <AdminHeader title="Payouts Summary" />
      <p className="text-sm text-gray-500">
        Aggregate P&amp;L for the marketplace payout system.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <label className="flex flex-col text-sm">
              From
              <input
                type="date"
                value={since}
                onChange={(e) => setSince(e.target.value)}
                className="mt-1 rounded border px-2 py-1"
              />
            </label>
            <label className="flex flex-col text-sm">
              To
              <input
                type="date"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
                className="mt-1 rounded border px-2 py-1"
              />
            </label>
            <label className="flex flex-col text-sm">
              Category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="mt-1 rounded border px-2 py-1"
              >
                <option value="ALL">All</option>
                <option value="SERVICE">Services</option>
                <option value="EVENT">Events</option>
                <option value="TOUR">Tours</option>
                <option value="PRODUCT">Products</option>
              </select>
            </label>
          </div>
        </CardContent>
      </Card>

      {isLoading || !data ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Stat label="Gross sales" value={fmt(data.grossSales)} />
          <Stat
            label="Commission revenue"
            value={fmt(data.commissionRevenue)}
            sub={`${data.grossSales ? ((data.commissionRevenue / data.grossSales) * 100).toFixed(2) : '0'}% of gross`}
          />
          <Stat
            label="Stripe fees"
            value={fmt(data.stripeFees)}
            sub="passed through to guides"
          />
          <Stat label="Net accrued to guides" value={fmt(data.netPayableAccrued)} />
          <Stat label="Paid out" value={fmt(data.paidOut)} />
          <Stat
            label="Outstanding payable"
            value={fmt(data.outstandingPayable)}
            sub="liability owed to guides right now"
            highlight
          />
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-4 ${
        highlight ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}
