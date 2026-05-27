import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createLeadSource,
  deleteLeadSource,
  fetchLeadSources,
} from '../lib/admin';
import { useAuth } from '../hooks/useAuth';

export default function SettingsLeadSources() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [label, setLabel] = useState('');

  const query = useQuery({
    queryKey: ['lead-sources'],
    queryFn: fetchLeadSources,
  });

  const createMutation = useMutation({
    mutationFn: () => createLeadSource(label),
    onSuccess: () => {
      setLabel('');
      qc.invalidateQueries({ queryKey: ['lead-sources'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLeadSource(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-sources'] }),
  });

  if (user && user.role !== 'admin') {
    return <div className="p-6 text-sm text-slate-500">Admin only.</div>;
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">Lead sources</h1>
      <p className="text-sm text-slate-500 mb-4">
        Custom lead source labels for tracking purchased lists, partnerships, etc.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (label.trim()) createMutation.mutate();
        }}
        className="flex gap-2 mb-4"
      >
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. TaxLeadsPro Q2 2026"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="submit"
          disabled={!label.trim() || createMutation.isPending}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          Add
        </button>
      </form>

      <ul className="bg-white border border-slate-200 rounded-md divide-y divide-slate-100">
        {query.data?.map((src) => (
          <li
            key={src.id}
            className="flex items-center justify-between px-4 py-2 text-sm"
          >
            <span className="text-slate-800">{src.label}</span>
            <button
              type="button"
              onClick={() => deleteMutation.mutate(src.id)}
              className="text-xs text-red-600 hover:underline"
            >
              Delete
            </button>
          </li>
        ))}
        {query.data?.length === 0 && (
          <li className="px-4 py-6 text-center text-xs text-slate-400">
            No custom sources yet.
          </li>
        )}
      </ul>
    </div>
  );
}
