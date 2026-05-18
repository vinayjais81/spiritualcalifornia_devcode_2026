'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AdminHeader } from '@/components/admin/header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Users, KeyRound, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { PasswordStrengthMeter, evaluatePassword } from '@/components/auth/PasswordStrengthMeter';

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
  const [pwTarget, setPwTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [pwReason, setPwReason] = useState('');
  const [showPw, setShowPw] = useState(false);
  const queryClient = useQueryClient();

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

  const passwordMutation = useMutation({
    mutationFn: ({ id, newPassword, reason }: { id: string; newPassword: string; reason: string }) =>
      api.post(`/admin/users/${id}/password`, { newPassword, reason }),
    onSuccess: () => {
      toast.success('Password changed. The user has been emailed and all their sessions are now signed out.');
      setPwTarget(null);
      setNewPassword('');
      setPwReason('');
      setShowPw(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to change password');
    },
  });

  const users: User[] = data?.users ?? [];

  const pwEvaluation = pwTarget
    ? evaluatePassword(newPassword, {
        email: pwTarget.email,
        firstName: pwTarget.firstName,
        lastName: pwTarget.lastName,
      })
    : null;
  const pwReady = !!pwEvaluation?.allPassed && pwReason.trim().length >= 3;

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
                      <th className="px-4 py-3">Actions</th>
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
                            <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                          </tr>
                        ))
                      : users.length === 0
                      ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
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
                            <td className="px-4 py-3">
                              <button
                                onClick={() => {
                                  setPwTarget(user);
                                  setNewPassword('');
                                  setPwReason('');
                                  setShowPw(false);
                                }}
                                title="Set a new password for this user"
                                className="inline-flex items-center gap-1 rounded border border-purple-200 bg-white px-2.5 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50"
                              >
                                <KeyRound className="h-3 w-3" />
                                Reset password
                              </button>
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

      {pwTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => (passwordMutation.isPending ? undefined : setPwTarget(null))}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-full bg-amber-100 p-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Set new password
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  For <span className="font-medium">{pwTarget.firstName} {pwTarget.lastName}</span> ({pwTarget.email}).
                  All their active sessions will be signed out and the user will be emailed about this change.
                </p>
              </div>
            </div>

            <label className="block text-xs font-medium text-gray-700">
              New password <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <input
                autoFocus
                type={showPw ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="10+ chars, mixed case, digit, symbol"
                className="w-full rounded border border-gray-300 px-3 py-2 pr-9 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title={showPw ? 'Hide' : 'Show'}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <PasswordStrengthMeter
              password={newPassword}
              email={pwTarget.email}
              firstName={pwTarget.firstName}
              lastName={pwTarget.lastName}
            />

            <label className="mt-4 block text-xs font-medium text-gray-700">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={pwReason}
              onChange={(e) => setPwReason(e.target.value)}
              placeholder="e.g. user locked out, support ticket #1234, security incident"
              rows={2}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <p className="mt-1 text-[11px] text-gray-500">
              The reason is recorded in the audit log and included in the email to the user.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setPwTarget(null)}
                disabled={passwordMutation.isPending}
                className="rounded border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  passwordMutation.mutate({
                    id: pwTarget.id,
                    newPassword,
                    reason: pwReason.trim(),
                  })
                }
                disabled={passwordMutation.isPending || !pwReady}
                className="rounded bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {passwordMutation.isPending ? 'Changing…' : 'Change password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
