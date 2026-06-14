import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiService } from '@/services/api';
import { useSchool } from '@/contexts/SchoolContext';
import { Copy, RefreshCw, Shield, UserCheck, Users, Lock, UserPlus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ParentAccountRow {
  accountId?: number | null;
  studentId: number;
  admissionNumber: string;
  studentName: string;
  guardianName?: string | null;
  guardianContact?: string | null;
  isActive: boolean;
}

type PortalCredentials = {
  studentPortalId: string;
  defaultPassword: string;
  studentName?: string;
  mustChangePassword?: boolean;
};

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active only' },
  { value: 'inactive', label: 'Inactive only' },
];

const ParentAccountsModule: React.FC = () => {
  const { schoolId } = useSchool();
  const [accounts, setAccounts] = useState<ParentAccountRow[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<string>('');
  const [linkStudentId, setLinkStudentId] = useState('');
  const [createPortalId, setCreatePortalId] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [detailCreatePassword, setDetailCreatePassword] = useState('');
  const [linkedStudents, setLinkedStudents] = useState<Array<{
    accountId: number;
    studentId: number;
    admissionNumber: string;
    studentName: string;
  }>>([]);
  const [credentials, setCredentials] = useState<PortalCredentials | null>(null);

  const PAGE_SIZE = 10;

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: 'Copied', description: `${label} copied to clipboard` });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  const showCredentials = (c: PortalCredentials, prefix?: string) => {
    setCredentials(c);
    setFeedback(
      prefix ||
        `Account ready for ${c.studentName || 'student'}. Share Student ID ${c.studentPortalId} and password ${c.defaultPassword}.`
    );
  };

  useEffect(() => {
    if (schoolId != null) {
      apiService.setTenantContext(schoolId);
    }
  }, [schoolId]);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setFeedback('');
    try {
      const query = new URLSearchParams();
      query.set('page', String(page));
      query.set('limit', String(PAGE_SIZE));
      if (search.trim()) query.set('search', search.trim());
      if (statusFilter !== 'all') query.set('status', statusFilter);
      const data = await apiService.get<{
        accounts: ParentAccountRow[];
        total: number;
        page: number;
        limit: number;
      }>(`/parent/admin/accounts?${query.toString()}`);
      setAccounts(data.accounts || []);
      setTotalAccounts(data.total ?? 0);
      if (data.page && data.page !== page) {
        setPage(data.page);
      }
    } catch (error) {
      console.error('Failed to load parent accounts', error);
      setFeedback('Unable to load parent accounts. Try again later.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const refresh = async () => {
    await loadAccounts();
    setFeedback('Refreshed parent account list.');
  };

  const updateAccount = async (accountId: number, payload: Record<string, unknown>, message: string) => {
    setActionLoading(true);
    setFeedback('');
    try {
      await apiService.patch(`/parent/admin/accounts/${accountId}`, payload);
      await loadAccounts();
      setFeedback(message);
    } catch (error) {
      console.error('Parent account update failed', error);
      setFeedback(error instanceof Error ? error.message : 'Unable to update account. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const resetPassword = async (account: ParentAccountRow) => {
    if (!account.accountId) return;
    setActionLoading(true);
    setFeedback('');
    try {
      const res = await apiService.post<{ credentials?: PortalCredentials }>(
        `/parent/admin/accounts/${account.accountId}/reset-password`,
        {}
      );
      await loadAccounts();
      if (res.credentials?.studentPortalId) {
        showCredentials(
          {
            ...res.credentials,
            studentName: account.studentName,
          },
          `Password reset for ${account.studentName}.`
        );
      } else {
        setFeedback(`Password reset for ${account.studentName}.`);
      }
    } catch (error) {
      console.error('Password reset failed', error);
      setFeedback(error instanceof Error ? error.message : 'Unable to reset password. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const createAccount = async (studentRef: number | string, password?: string) => {
    setActionLoading(true);
    setFeedback('');
    try {
      const body: { studentId: number | string; password?: string } = { studentId: studentRef };
      if (password?.trim()) body.password = password.trim();
      const res = await apiService.post<{ credentials?: PortalCredentials }>('/parent/admin/accounts', body);
      await loadAccounts();
      if (res.credentials?.studentPortalId) {
        showCredentials(res.credentials, 'Parent portal account created. Share these login details with the parent.');
        setCreatePortalId('');
        setCreatePassword('');
        setDetailCreatePassword('');
      } else {
        setFeedback('Parent portal account created successfully.');
      }
    } catch (error) {
      console.error('Create parent account failed', error);
      setFeedback(error instanceof Error ? error.message : 'Unable to create parent account. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const selectedDetails = useMemo(
    () => accounts.find((account) => account.studentId === selectedStudentId) || null,
    [accounts, selectedStudentId]
  );

  const totalPages = Math.max(1, Math.ceil(totalAccounts / PAGE_SIZE));

  useEffect(() => {
    if (selectedDetails) {
      setLinkStudentId('');
      setDetailCreatePassword('');
      setLinkedStudents([]);
    }
  }, [selectedDetails]);

  useEffect(() => {
    if (!selectedDetails?.accountId || schoolId == null) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiService.get<{ linkedStudents?: typeof linkedStudents }>(
          `/parent/admin/accounts/${selectedDetails.accountId}?tenantId=${schoolId}`
        );
        if (!cancelled) {
          setLinkedStudents(data.linkedStudents || []);
        }
      } catch {
        if (!cancelled) setLinkedStudents([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDetails?.accountId, schoolId]);

  const linkSiblingStudent = async () => {
    if (!selectedDetails?.accountId) return;
    const ids = linkStudentId
      .split(/[\s,;]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      setFeedback('Enter at least one sibling Student ID to link.');
      return;
    }
    setActionLoading(true);
    setFeedback('');
    try {
      const res = await apiService.post<{ linkedStudents?: typeof linkedStudents; message?: string; success?: boolean }>(
        `/parent/admin/accounts/${selectedDetails.accountId}/link-sibling`,
        { studentLoginIds: ids }
      );
      setLinkedStudents(res.linkedStudents || []);
      setLinkStudentId('');
      setFeedback(
        res.message ||
          'Siblings linked. Parent can switch between all linked children without logging in again.'
      );
    } catch (error) {
      console.error('Link sibling failed', error);
      setFeedback(error instanceof Error ? error.message : 'Unable to link sibling student. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm">
            <Users className="h-4 w-4 text-indigo-500" />
            Parent Account Management
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">School Parent Accounts</h1>
            <p className="text-sm text-slate-500 max-w-2xl">
              Parents log in with Student ID as username and password. Link sibling students here — they appear automatically in the parent switcher with no extra login.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label htmlFor="parent-account-search" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Search</label>
            <input
              id="parent-account-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Student name, ID, guardian"
              className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="parent-account-status" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</label>
            <select
              id="parent-account-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading || actionLoading}
            className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="ml-2">Refresh</span>
          </button>
        </div>
      </div>

      {credentials ? (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-4 text-sm text-indigo-950 shadow-sm">
          <p className="font-semibold">Login credentials — share with parent</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-indigo-100 bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Student ID (username)</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="font-mono font-semibold">{credentials.studentPortalId}</span>
                <button type="button" onClick={() => void copyText('Student ID', credentials.studentPortalId)} className="rounded-lg border px-2 py-1 text-xs">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-indigo-100 bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Password</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="font-mono font-semibold">{credentials.defaultPassword}</span>
                <button type="button" onClick={() => void copyText('Password', credentials.defaultPassword)} className="rounded-lg border px-2 py-1 text-xs">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
          {credentials.studentName ? (
            <p className="mt-2 text-xs text-indigo-900/80">Student: {credentials.studentName}</p>
          ) : null}
          {credentials.mustChangePassword === false ? (
            <p className="mt-2 text-xs text-indigo-900/80">Parent can use this password directly — no forced change on first login.</p>
          ) : (
            <p className="mt-2 text-xs text-indigo-900/80">Parent must change password on first login.</p>
          )}
        </div>
      ) : null}

      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="create-parent-portal-id" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Student ID
            </label>
            <input
              id="create-parent-portal-id"
              type="text"
              value={createPortalId}
              onChange={(e) => setCreatePortalId(e.target.value.trim())}
              placeholder="e.g. 12345678"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="create-parent-password" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Password (optional)
            </label>
            <input
              id="create-parent-password"
              type="text"
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              placeholder="Leave blank = same as Student ID"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Optional: set a custom password now. If left blank, password defaults to the Student ID and parent must change it on first login.
          </p>
          <button
            type="button"
            disabled={actionLoading || !createPortalId.trim()}
            onClick={() => void createAccount(createPortalId.trim(), createPassword)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <UserPlus className="h-4 w-4" />
            Create account
          </button>
        </div>
      </div>

      {feedback ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
          feedback.toLowerCase().includes('unable') || feedback.toLowerCase().includes('cannot') || feedback.toLowerCase().includes('failed') || feedback.toLowerCase().includes('not found')
            ? 'border-rose-100 bg-rose-50 text-rose-800'
            : 'border-emerald-100 bg-emerald-50 text-emerald-800'
        }`}>
          {feedback}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.4fr,0.9fr]">
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-slate-50">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Parent Accounts</p>
              <p className="text-xs text-slate-500">Total accounts: {totalAccounts}</p>
            </div>
            <p className="text-xs text-slate-400">Tenant scoped</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-600">
                  {['Student', 'Admission', 'Parent', 'Status', 'Action'].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-semibold uppercase tracking-[0.18em] text-slate-500">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Loading parent accounts...</td>
                  </tr>
                ) : accounts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No parent accounts found.</td>
                  </tr>
                ) : (
                  accounts.map((account) => {
                    const isSelected = selectedStudentId === account.studentId;
                    return (
                      <tr
                        key={`${account.studentId}-${account.accountId ?? 'new'}`}
                        className={`transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'} cursor-pointer`}
                        onClick={() => setSelectedStudentId(account.studentId)}
                      >
                        <td className="px-4 py-4">{account.studentName}</td>
                        <td className="px-4 py-4">{account.admissionNumber}</td>
                        <td className="px-4 py-4">
                          <div>{account.guardianName || '–'}</div>
                          <div className="text-xs text-slate-500">{account.guardianContact || 'No phone'}</div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${account.accountId ? (account.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700') : 'bg-slate-100 text-slate-500'}`}>
                            {account.accountId ? (account.isActive ? 'Active' : 'Inactive') : 'No account'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {account.accountId ? (
                            <button
                              type="button"
                              className="rounded-2xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                            >
                              Manage
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                createAccount(account.studentId);
                              }}
                              disabled={actionLoading}
                              className="rounded-2xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              Create account
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {totalAccounts > PAGE_SIZE && (
            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-600">
                Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, totalAccounts)} of {totalAccounts} parent accounts
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1 || loading}
                  className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages || loading}
                  className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-indigo-50 text-indigo-700">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900">Account details</p>
              <p className="text-sm text-slate-500">Select an account from the list to manage it.</p>
            </div>
          </div>

          {!selectedDetails ? (
            <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              Select a parent account to manage its student link and password.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2 rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Selected student</p>
                <p className="text-lg font-bold text-slate-900">{selectedDetails.studentName}</p>
                <p className="text-sm text-slate-500">ID: {selectedDetails.admissionNumber}</p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Parent / Guardian</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{selectedDetails.guardianName || 'Not available'}</p>
                <p className="text-xs text-slate-500">{selectedDetails.guardianContact || 'No phone'}</p>
              </div>

              {!selectedDetails.accountId ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-4 space-y-4">
                  <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
                    Parents can also log in on their own with Student ID as username and password. Use Create below only if you want to set up the account or choose a custom password for them.
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="detail-create-password" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Password (optional)
                    </label>
                    <input
                      id="detail-create-password"
                      type="text"
                      value={detailCreatePassword}
                      onChange={(e) => setDetailCreatePassword(e.target.value)}
                      placeholder="Leave blank = Student ID; parent changes on first login"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => createAccount(selectedDetails.studentId, detailCreatePassword)}
                    disabled={actionLoading}
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    Create Parent Account
                  </button>
                </div>
              ) : (
                <>
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 space-y-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Linked sibling students</p>
                    {linkedStudents.length > 0 ? (
                      <ul className="space-y-2">
                        {linkedStudents.map((sibling) => (
                          <li
                            key={sibling.studentId}
                            className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                          >
                            <span className="font-semibold">{sibling.studentName}</span>
                            <span className="text-slate-500"> · ID {sibling.admissionNumber}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-500">No linked siblings yet. Add a sibling below.</p>
                    )}
                    <div className="grid gap-3 sm:grid-cols-[1fr,auto]">
                      <input
                        type="text"
                        value={linkStudentId}
                        onChange={(e) => setLinkStudentId(e.target.value)}
                        placeholder="Sibling IDs — e.g. 12345678, 87654321"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
                      <button
                        type="button"
                        onClick={() => void linkSiblingStudent()}
                        disabled={actionLoading}
                        className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        Link Sibling(s)
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">
                      Link as many siblings as you need — comma or space separated. If a sibling already has their own parent account, they are merged into this family automatically.
                    </p>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{selectedDetails.isActive ? 'Active' : 'Inactive'}</p>
                      </div>
                      <button
                        onClick={() => updateAccount(selectedDetails.accountId, { isActive: !selectedDetails.isActive }, selectedDetails.isActive ? 'Account deactivated.' : 'Account activated.')}
                        disabled={actionLoading}
                        className={`rounded-2xl px-4 py-2 text-xs font-semibold text-white transition ${selectedDetails.isActive ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                      >
                        {selectedDetails.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">Inactive accounts cannot sign in to the parent portal until reactivated.</p>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                        <Lock className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Reset password</p>
                        <p className="text-xs text-slate-500">Resets the password to the student&apos;s portal ID and forces a password change on next login.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => resetPassword(selectedDetails)}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                    >
                      <UserCheck className="h-4 w-4" />
                      Reset Password
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ParentAccountsModule;
