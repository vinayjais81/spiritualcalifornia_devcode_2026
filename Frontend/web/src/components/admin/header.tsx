'use client';

import { Bell } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { Badge } from '@/components/ui/badge';

interface AdminHeaderProps {
  title: string;
}

export function AdminHeader({ title }: AdminHeaderProps) {
  const { user } = useAuthStore();

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-4">
        <button className="relative rounded-full p-1.5 text-gray-500 hover:bg-gray-100">
          <Bell className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-sm font-semibold text-purple-700">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-900">
              {user?.firstName} {user?.lastName}
            </p>
            <div className="flex gap-1">
              {user?.roles?.map((role) => (
                <Badge key={role} variant="secondary" className="h-4 px-1 text-xs">
                  {role}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
