import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAdminUsers,
  inviteUser,
  patchAdminUser,
  type AdminUser,
  type InviteResponse,
} from '../lib/admin';
import { useAuth } from '../hooks/useAuth';

export default function SettingsUsers() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [showInvite, setShowInvite] = useState(false);
  const [lastInvite, setLastInvite] = useState<InviteResponse | null>(null);

  const query = useQuery({ queryKey: ['admin-users'], queryFn: fetchAdminUsers });

  const toggleMutation = useMutation({
    mutationFn: (u: AdminUser) =>
      patchAdminUser(u.id, { isActive: !u.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const roleMutation = useMutation({
    mutationFn: (input: { id: string; role: AdminUser['role'] }) =>
      patchAdminUser(input.id, { role: input.role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  if (user && user.role !== 'admin') {
    return <div className="p-6 text-sm text-slate-500">Admin only.</div>;
  }

  return (
    <div className="p-6 max-w-5xl">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500">Invite teammates and manage roles.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Invite user
        </button>
      </header>

      {lastInvite && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-semibold text-amber-800">
            Invite created for {lastInvite.invite.email}.{' '}
            {lastInvite.emailSent ? 'Email sent.' : 'Email NOT sent (SendGrid not configured).'}
          </p>
          <p className="text-xs text-amber-700 mt-1 break-all">
            Share this link: <code>{lastInvite.inviteUrl}</code>
          </p>
        </div>
      )}

      <div className="overflow-x-auto bg-white border border-slate-200 rounded-md">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
              <th className="py-2 px-3">Name</th>
              <th className="py-2 px-3">Email</th>
              <th className="py-2 px-3">Role</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {query.data?.map((u) => (
              <tr key={u.id} className="border-b border-slate-100">
                <td className="py-2 px-3 font-medium text-slate-800">{u.name}</td>
                <td className="py-2 px-3 text-slate-600">{u.email}</td>
                <td className="py-2 px-3">
                  <select
                    value={u.role}
                    onChange={(e) =>
                      roleMutation.mutate({
                        id: u.id,
                        role: e.target.value as AdminUser['role'],
                      })
                    }
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                  >
                    <option value="admin">admin</option>
                    <option value="agent">agent</option>
                    <option value="viewer">viewer</option>
                  </select>
                </td>
                <td className="py-2 px-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      u.isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {u.isActive ? 'Active' : 'Deactivated'}
                  </span>
                </td>
                <td className="py-2 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => toggleMutation.mutate(u)}
                    className="text-xs text-slate-600 hover:underline"
                  >
                    {u.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSuccess={(r) => {
            setLastInvite(r);
            setShowInvite(false);
            qc.invalidateQueries({ queryKey: ['admin-users'] });
          }}
        />
      )}
    </div>
  );
}

function InviteModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (r: InviteResponse) => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<AdminUser['role']>('agent');

  const mutation = useMutation({
    mutationFn: () => inviteUser({ email, name, role }),
    onSuccess,
  });

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">Invite user</h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="p-4 space-y-3"
        >
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
              Name
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
              Email
            </label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AdminUser['role'])}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="admin">admin</option>
              <option value="agent">agent</option>
              <option value="viewer">viewer</option>
            </select>
          </div>
          {mutation.isError && (
            <p className="text-xs text-red-600">
              {(mutation.error as Error).message}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {mutation.isPending ? 'Sending…' : 'Send invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
