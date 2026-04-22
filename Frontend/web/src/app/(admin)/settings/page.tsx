'use client';

import { useQuery } from '@tanstack/react-query';
import { AdminHeader } from '@/components/admin/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Server,
  Database,
  CreditCard,
  Mail,
  ShieldCheck,
  Cloud,
  MessageSquare,
  Search,
  Video,
  CalendarDays,
} from 'lucide-react';
import { api } from '@/lib/api';

const iconMap: Record<string, React.ElementType> = {
  'API Server':           Server,
  'PostgreSQL':           Database,
  'Stripe Connect':       CreditCard,
  'Resend':               Mail,
  'Persona':              ShieldCheck,
  'AWS S3 + CloudFront':  Cloud,
  'Anthropic Claude':     MessageSquare,
  'Algolia':              Search,
  'Zoom':                 Video,
  'Calendly':             CalendarDays,
};

const statusMap = {
  operational:  { label: 'Operational', className: 'bg-green-100 text-green-700' },
  test:         { label: 'Test / Sandbox', className: 'bg-yellow-100 text-yellow-700' },
  dev:          { label: 'Dev Mode', className: 'bg-blue-100 text-blue-700' },
  unconfigured: { label: 'Not Configured', className: 'bg-red-100 text-red-700' },
};

export default function SettingsPage() {
  const { data: integrations, isLoading } = useQuery({
    queryKey: ['admin', 'integration-status'],
    queryFn: async () => {
      const { data } = await api.get('/admin/integration-status');
      return data as Array<{ name: string; description: string; detail: string; status: string }>;
    },
    staleTime: 30_000,
  });

  return (
    <div className="flex flex-col overflow-hidden">
      <AdminHeader title="Settings" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">

          {/* Platform Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Platform Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                { label: 'Platform Name', value: 'Spiritual California' },
                { label: 'Environment', value: 'Development' },
                { label: 'API Version', value: 'v1' },
                { label: 'Frontend', value: 'Next.js 15 (App Router)' },
                { label: 'Backend', value: 'NestJS 11' },
                { label: 'Database', value: 'PostgreSQL 16 + Prisma 7' },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium uppercase tracking-wider text-gray-400">{label}</span>
                  <span className="text-sm text-gray-900">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Integration Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Integration Status</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-lg" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-3.5 w-32" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                      </div>
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                  ))
                : (integrations ?? []).map(({ name, description, detail, status }) => {
                    const Icon = iconMap[name] ?? Server;
                    const { label, className } = statusMap[status as keyof typeof statusMap] ?? statusMap.unconfigured;
                    return (
                      <div key={name} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                            <Icon className="h-4 w-4 text-gray-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{name}</p>
                            <p className="text-xs text-gray-500">{description} · {detail}</p>
                          </div>
                        </div>
                        <Badge className={`${className} hover:opacity-100`}>{label}</Badge>
                      </div>
                    );
                  })}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
