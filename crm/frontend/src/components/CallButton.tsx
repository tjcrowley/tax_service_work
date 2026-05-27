import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { startOutboundCall } from '../lib/twilio';
import PostCallModal from './PostCallModal';

type Props = {
  contactId: string;
  phone: string;
  disabled?: boolean;
};

export default function CallButton({ contactId, phone, disabled }: Props) {
  const qc = useQueryClient();
  const [activeCallSid, setActiveCallSid] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => startOutboundCall(contactId),
    onSuccess: (data) => {
      setActiveCallSid(data.callSid);
      setErrorMessage(null);
      qc.invalidateQueries({ queryKey: ['activities', contactId] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to start call';
      setErrorMessage(msg);
    },
  });

  if (disabled) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-400"
        title="Do-not-call"
      >
        ☎ DNC
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        title={`Call ${phone}`}
      >
        ☎ {mutation.isPending ? 'Calling…' : 'Call'}
      </button>
      {errorMessage && (
        <p className="ml-2 inline text-xs text-red-600">{errorMessage}</p>
      )}
      {activeCallSid && (
        <PostCallModal
          callSid={activeCallSid}
          contactId={contactId}
          onClose={() => setActiveCallSid(null)}
        />
      )}
    </>
  );
}
