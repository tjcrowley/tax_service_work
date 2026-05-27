import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCannedResponse,
  deleteCannedResponse,
  fetchCannedResponses,
  updateCannedResponse,
  type CannedResponse,
} from '../lib/admin';
import { useAuth } from '../hooks/useAuth';

export default function SettingsCannedResponses() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [editing, setEditing] = useState<CannedResponse | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newBody, setNewBody] = useState('');

  const query = useQuery({
    queryKey: ['canned-responses'],
    queryFn: fetchCannedResponses,
  });

  const createMutation = useMutation({
    mutationFn: () => createCannedResponse({ label: newLabel, body: newBody }),
    onSuccess: () => {
      setNewLabel('');
      setNewBody('');
      qc.invalidateQueries({ queryKey: ['canned-responses'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; label: string; body: string }) =>
      updateCannedResponse(input.id, { label: input.label, body: input.body }),
    onSuccess: () => {
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['canned-responses'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCannedResponse(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['canned-responses'] }),
  });

  if (user && user.role !== 'admin') {
    return <div className="p-6 text-sm text-slate-500">Admin only.</div>;
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">Canned SMS responses</h1>
      <p className="text-sm text-slate-500 mb-4">
        Reusable templates for agents to send via SMS.
      </p>

      <section className="bg-white border border-slate-200 rounded-md p-4 mb-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">New response</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="space-y-2"
        >
          <input
            required
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label (e.g. After hours)"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <textarea
            required
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            rows={3}
            placeholder="Message body…"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!newLabel.trim() || !newBody.trim() || createMutation.isPending}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {createMutation.isPending ? 'Saving…' : 'Add response'}
            </button>
          </div>
        </form>
      </section>

      <div className="space-y-3">
        {query.data?.map((r) => (
          <div
            key={r.id}
            className="bg-white border border-slate-200 rounded-md p-4"
          >
            {editing?.id === r.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  updateMutation.mutate({
                    id: r.id,
                    label: editing.label,
                    body: editing.body,
                  });
                }}
                className="space-y-2"
              >
                <input
                  required
                  value={editing.label}
                  onChange={(e) =>
                    setEditing({ ...editing, label: e.target.value })
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <textarea
                  required
                  value={editing.body}
                  onChange={(e) =>
                    setEditing({ ...editing, body: e.target.value })
                  }
                  rows={3}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white"
                  >
                    Save
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">{r.label}</h3>
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setEditing(r)}
                      className="text-slate-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(r.id)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{r.body}</p>
              </div>
            )}
          </div>
        ))}
        {query.data?.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-6">No canned responses yet.</p>
        )}
      </div>
    </div>
  );
}
