import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { saveDisposition, type Disposition } from '../lib/twilio';

type Props = {
  callSid: string;
  contactId: string;
  onClose: () => void;
};

const DISPOSITIONS: { value: Disposition; label: string }[] = [
  { value: 'answered', label: 'Answered' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'busy', label: 'Busy' },
  { value: 'failed', label: 'Failed' },
];

export default function PostCallModal({ callSid, contactId, onClose }: Props) {
  const qc = useQueryClient();
  const [disposition, setDisposition] = useState<Disposition>('answered');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () => saveDisposition(callSid, disposition, notes.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activities', contactId] });
      onClose();
    },
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
          <h2 className="text-base font-semibold text-slate-900">Log Call Outcome</h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="p-4 space-y-3"
        >
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Disposition
          </label>
          <select
            value={disposition}
            onChange={(e) => setDisposition(e.target.value as Disposition)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {DISPOSITIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>

          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="What happened on the call…"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />

          {mutation.isError && (
            <p className="text-xs text-red-600">{(mutation.error as Error).message}</p>
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
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
