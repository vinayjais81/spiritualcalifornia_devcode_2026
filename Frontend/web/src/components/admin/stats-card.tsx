import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
}

export function StatsCard({ title, value, subtitle, icon: Icon, iconColor = 'text-purple-600', iconBg = 'bg-purple-50' }: StatsCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', iconBg)}>
          <Icon className={cn('h-6 w-6', iconColor)} />
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
