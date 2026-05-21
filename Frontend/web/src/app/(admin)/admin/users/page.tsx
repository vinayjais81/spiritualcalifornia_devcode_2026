'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AdminHeader } from '@/components/admin/header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Users, KeyRound, AlertTriangle, Eye, EyeOff, UserX, UserCheck, Mail, Send } from 'lucide-react';
import { toast } from 'sonner';
import { PasswordStrengthMeter, evaluatePassword } from '@/components/auth/PasswordStrengthMeter';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isEmailVerified: boolean;
  isActive: boolean;
  isTestAccount: boolean;
  deactivatedReason?: string | null;
  createdAt: string;
  roles: Array<{ role: string }>;
}

// `.test` is RFC-2606 reserved — never routes real mail. Used to gray out
// the Resend-invite button when the row's email is still a placeholder
// (a Resend on a `.test` address goes to a black hole).
function emailLooksLikeTestDomain(email: string): boolean {
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  return email.slice(at + 1).toLowerCase().endsWith('.test');
}

const roleBadgeColor: Record<string, string> = {
  SEEKER: 'bg-blue-100 text-blue-700',
  GUIDE: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-red-100 text-red-700',
  SUPER_ADMIN: 'bg-red-200 text-red-800',
};

type StatusFilter = '' | 'active' | 'deactivated' | 'unverified';

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: '',            label: 'All' },
  { value: 'active',      label: 'Active' },
  { value: 'unverified',  label: 'Unverified' },
  { value: 'deactivated', label: 'Deactivated' },
];

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [pwTarget, setPwTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [pwReason, setPwReason] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [convertTarget, setConvertTarget] = useState<User | null>(null);
  const [convertEmail, setConvertEmail] = useState('');
  const [convertSendInvite, setConvertSendInvite] = useState(true);
  const [convertReason, setConvertReason] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, search, statusFilter],
    queryFn: async () => {
      const { data } = await api.get('/admin/users', {
        params: {
          page,
          limit: 20,
          search: search || undefined,
          status: statusFilter || undefined,
        },
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

  const deactivateMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/admin/users/${id}/deactivate`, { reason }),
    onSuccess: () => {
      toast.success('Account deactivated. Active sessions have been signed out.');
      setDeactivateTarget(null);
      setDeactivateReason('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to deactivate account');
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/users/${id}/activate`),
    onSuccess: () => {
      toast.success('Account reactivated.');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to reactivate account');
    },
  });

  // Pre-launch test-account conversion. Swap the throwaway test-domain
  // email for the real one; backend nulls passwordHash + mints a one-time
  // claim token + emails the new address. Only enabled for rows where
  // User.isTestAccount = true (server enforces this too).
  const convertMutation = useMutation({
    mutationFn: ({
      id,
      newEmail,
      sendInvite,
      reason,
    }: {
      id: string;
      newEmail: string;
      sendInvite: boolean;
      reason: string;
    }) =>
      api.patch(`/admin/users/${id}/convert-test-account`, {
        newEmail,
        sendInvite,
        reason: reason || undefined,
      }),
    onSuccess: (_, vars) => {
      toast.success(
        vars.sendInvite
          ? `Email swapped → claim invite sent to ${vars.newEmail}`
          : `Email swapped to ${vars.newEmail}. Invite NOT sent (you can send it later from /admin/guides).`,
      );
      setConvertTarget(null);
      setConvertEmail('');
      setConvertReason('');
      setConvertSendInvite(true);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to convert account');
    },
  });

  // Re-fires the claim invite for a row that's already been converted
  // (real email assigned, isTestAccount still true, isEmailVerified still
  // false). Rotates the token so any prior link goes dead.
  const resendInviteMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/users/${id}/resend-claim-invite`),
    onSuccess: () => {
      toast.success('Claim invite re-sent.');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to resend invite');
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

          {/* Search + Lifecycle filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by name or email…"
                className="pl-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <div className="flex gap-1">
              {statusFilters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => { setStatusFilter(f.value); setPage(1); }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === f.value
                      ? 'bg-purple-600 text-white'
                      : 'bg-white border text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
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
                                <p className="flex items-center gap-1.5 text-xs text-gray-500">
                                  <span>{user.email}</span>
                                  {user.isTestAccount && (
                                    <span
                                      className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800"
                                      title="Pre-launch test account. Use Convert to swap in the real email."
                                    >
                                      Test
                                    </span>
                                  )}
                                </p>
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
                              {!user.isActive ? (
                                <div className="flex flex-col gap-1">
                                  <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Deactivated</Badge>
                                  {user.deactivatedReason && (
                                    <span className="text-[11px] text-gray-500" title={user.deactivatedReason}>
                                      {user.deactivatedReason.length > 32
                                        ? `${user.deactivatedReason.slice(0, 32)}…`
                                        : user.deactivatedReason}
                                    </span>
                                  )}
                                </div>
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
                              <div className="flex flex-wrap items-center gap-2">
                                {/* Convert / Resend live inline with the other row
                                    actions so admin doesn't have to switch pages.
                                    Convert is shown whenever the row is flagged
                                    isTestAccount (admin may legitimately want to
                                    re-swap a typo'd address). Resend is only
                                    useful once the throwaway email has already
                                    been swapped for a real one — gated by both
                                    `!isEmailVerified` (claim still pending) AND
                                    `!emailLooksLikeTestDomain` (Resend on a
                                    `.test` address would mail a dead inbox). */}
                                {user.isTestAccount && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setConvertTarget(user);
                                        setConvertEmail('');
                                        setConvertReason('');
                                        setConvertSendInvite(true);
                                      }}
                                      title="Swap the throwaway email for the real one. The old password stops working immediately."
                                      className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                                    >
                                      <Mail className="h-3 w-3" />
                                      Convert
                                    </button>
                                    {!user.isEmailVerified && !emailLooksLikeTestDomain(user.email) && (
                                      <button
                                        onClick={() => {
                                          if (!window.confirm(
                                            `Re-send the claim invite to ${user.email}? Any prior link will stop working.`,
                                          )) return;
                                          resendInviteMutation.mutate(user.id);
                                        }}
                                        disabled={resendInviteMutation.isPending}
                                        title="Re-issue the claim invite (rotates the token)"
                                        className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                                      >
                                        <Send className="h-3 w-3" />
                                        Resend invite
                                      </button>
                                    )}
                                  </>
                                )}
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
                                {user.isActive ? (
                                  <button
                                    onClick={() => {
                                      setDeactivateTarget(user);
                                      setDeactivateReason('');
                                    }}
                                    title="Block this user from logging in and hide their public profile"
                                    className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                                  >
                                    <UserX className="h-3 w-3" />
                                    Deactivate
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => activateMutation.mutate(user.id)}
                                    disabled={activateMutation.isPending}
                                    title="Restore this user's login and public visibility"
                                    className="inline-flex items-center gap-1 rounded border border-green-200 bg-white px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                                  >
                                    <UserCheck className="h-3 w-3" />
                                    Activate
                                  </button>
                                )}
                              </div>
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

      {convertTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => (convertMutation.isPending ? undefined : setConvertTarget(null))}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-full bg-amber-100 p-2">
                <Mail className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Convert test account
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Swap{' '}
                  <span className="font-medium">{convertTarget.email}</span>{' '}
                  for the real email below. The current password stops working
                  immediately. By default, a one-time claim link is emailed to
                  the new address so the guide can verify it and set a password.
                </p>
              </div>
            </div>

            <label className="block text-xs font-medium text-gray-700">
              New email <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              type="email"
              value={convertEmail}
              onChange={(e) => setConvertEmail(e.target.value)}
              placeholder="real.guide@gmail.com"
              autoComplete="off"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />

            <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={convertSendInvite}
                onChange={(e) => setConvertSendInvite(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              Email the claim link to the new address now
            </label>
            <p className="ml-6 text-[11px] text-gray-500">
              Uncheck to swap silently and send the invite later from
              {' '}<code className="rounded bg-gray-100 px-1">/admin/guides</code>.
            </p>

            <label className="mt-4 block text-xs font-medium text-gray-700">
              Reason <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={convertReason}
              onChange={(e) => setConvertReason(e.target.value)}
              placeholder="e.g. real email received from guide via Slack #onboarding"
              rows={2}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <p className="mt-1 text-[11px] text-gray-500">
              Recorded in the audit log (<code>admin.user.convertTestAccount</code>).
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConvertTarget(null)}
                disabled={convertMutation.isPending}
                className="rounded border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  convertMutation.mutate({
                    id: convertTarget.id,
                    newEmail: convertEmail.trim(),
                    sendInvite: convertSendInvite,
                    reason: convertReason.trim(),
                  })
                }
                disabled={
                  convertMutation.isPending ||
                  !convertEmail.trim() ||
                  !convertEmail.includes('@') ||
                  convertEmail.trim().toLowerCase() === convertTarget.email.toLowerCase()
                }
                className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {convertMutation.isPending
                  ? 'Swapping…'
                  : convertSendInvite
                    ? 'Swap & send invite'
                    : 'Swap silently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deactivateTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => (deactivateMutation.isPending ? undefined : setDeactivateTarget(null))}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-full bg-red-100 p-2">
                <UserX className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Deactivate account?
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  <span className="font-medium">{deactivateTarget.firstName} {deactivateTarget.lastName}</span> ({deactivateTarget.email}) won't be able to sign in, and their public profile (if any) will be hidden from the marketplace. Existing bookings and payouts continue normally. You can reactivate them later.
                </p>
              </div>
            </div>

            <label className="block text-xs font-medium text-gray-700">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              autoFocus
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
              placeholder="e.g. user requested account closure, suspected fraud (ticket #1234), TOS violation"
              rows={3}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <p className="mt-1 text-[11px] text-gray-500">
              Recorded in the audit log (`admin.user.deactivate`). Visible to other admins.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setDeactivateTarget(null)}
                disabled={deactivateMutation.isPending}
                className="rounded border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  deactivateMutation.mutate({
                    id: deactivateTarget.id,
                    reason: deactivateReason.trim(),
                  })
                }
                disabled={deactivateMutation.isPending || deactivateReason.trim().length < 3}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deactivateMutation.isPending ? 'Deactivating…' : 'Deactivate account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
