import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createNote } from '../lib/activities';

type Props = {
  contactId: string;
};

export default function LogNotePanel({ contactId }: Props) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');

  const mutation = useMutation({
    mutationFn: (text: string) => createNote(contactId, text),
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: ['activities', contactId] });
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
