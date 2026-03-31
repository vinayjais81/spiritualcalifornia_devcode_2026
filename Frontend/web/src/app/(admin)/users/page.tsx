'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AdminHeader } from '@/components/admin/header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Users } from 'lucide-react';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isEmailVerified: boolean;
  isActive: boolean;
  isBanned: boolean;
  createdAt: string;
  roles: Array<{ role: string }>;
}

const roleBadgeColor: Record<string, string> = {
  SEEKER: 'bg-blue-100 text-blue-700',
  GUIDE: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-red-100 text-red-700',
  SUPER_ADMIN: 'bg-red-200 text-red-800',
};

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, search],
    queryFn: async () => {
      const { data } = await api.get('/admin/users', {
        params: { page, limit: 20, search: search || undefined },
      });
      return data;
    },
    placeholderData: { users: [], total: 0, totalPages: 0 },
  });

  const users: User[] = data?.users ?? [];

  return (
    <div className="flex flex-col overflow-hidden">
      <AdminHeader title="Users" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-7xl space-y-4">

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by name or email…"
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Roles</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {isLoading
                      ? Array.from({ length: 8 }).map((_, i) => (
                          <tr key={i}>
                            <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                            <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                            <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                            <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                          </tr>
                        ))
                      : users.length === 0
                      ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-12 text-center text-gray-400">
                              <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                              No users found
                            </td>
                          </tr>
                        )
                      : users.map((user) => (
                          <tr key={user.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium text-gray-900">
                                  {user.firstName} {user.lastName}
                                </p>
                                <p className="text-xs text-gray-500">{user.email}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {user.roles.map(({ role }) => (
                                  <span
                                    key={role}
                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeColor[role] ?? 'bg-gray-100 text-gray-700'}`}
                                  >
                                    {role}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {user.isBanned ? (
                                <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Banned</Badge>
                              ) : !user.isActive ? (
                                <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">Inactive</Badge>
                              ) : !user.isEmailVerified ? (
                                <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Unverified</Badge>
                              ) : (
                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-500">
                              {new Date(user.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {(data?.totalPages ?? 0) > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-xs text-gray-500">
                    Page {page} of {data?.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="rounded border px-3 py-1 text-xs disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= (data?.totalPages ?? 1)}
                      className="rounded border px-3 py-1 text-xs disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
