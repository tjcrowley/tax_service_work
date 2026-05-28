import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createNote } from '../lib/activities';
import { enqueue } from '../lib/offlineQueue';
import { notifyQueueChanged } from '../hooks/useOfflineQueue';

type Props = {
  contactId: string;
};

type Submission = { kind: 'online'; text: string } | { kind: 'queued'; text: string };

export default function LogNotePanel({ contactId }: Props) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (text: string): Promise<Submission> => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        await enqueue({
          url: `/contacts/${contactId}/activities`,
          method: 'POST',
          body: { type: 'note', body: text },
          contactId,
          type: 'note',
        });
        notifyQueueChanged();
        return { kind: 'queued', text };
      }
      await createNote(contactId, text);
      return { kind: 'online', text };
    },
    onSuccess: (result) => {
      setBody('');
      if (result.kind === 'queued') {
        setToast('Note saved — will sync when back online');
      } else {
        setToast('Note logged');
        qc.invalidateQueries({ queryKey: ['activities', contactId] });
      }
      window.setTimeout(() => setToast(null), 3500);
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    mutation.mutate(trimmed);
  };

  return (
    <form onSubmit={onSubmit} className="mt-4 border-t border-slate-200 pt-4 space-y-2">
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
        Log a note
      </label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Spoke with the client about…"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      {mutation.isError && (
        <p className="text-xs text-red-600">{(mutation.error as Error).message}</p>
      )}
      {toast && (
        <p
          role="status"
          className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1"
        >
          {toast}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!body.trim() || mutation.isPending}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {mutation.isPending ? 'Saving…' : 'Log Note'}
        </button>
      </div>
    </form>
  );
}
