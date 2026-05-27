import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSmsThread, sendSmsMessage, type SmsMessage } from '../lib/twilio';
import { absoluteDate, relativeTime } from '../lib/format';

type Props = {
  contactId: string;
  disabled?: boolean;
};

export default function SmsPanel({ contactId, disabled }: Props) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const scrollerRef = useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryKey: ['sms', contactId],
    queryFn: () => fetchSmsThread(contactId),
    refetchInterval: 10000,
  });

  const mutation = useMutation({
    mutationFn: (text: string) => sendSmsMessage(contactId, text),
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: ['sms', contactId] });
      qc.invalidateQueries({ queryKey: ['activities', contactId] });
    },
  });

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [query.data?.length]);

  if (disabled) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
        Contact has opted out of SMS.
      </div>
    );
  }

  const items = query.data ?? [];

  return (
    <div className="flex flex-col h-[400px] border border-slate-200 rounded-md">
      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50"
      >
        {query.isLoading && (
          <div className="text-center text-xs text-slate-400 py-4">Loading…</div>
        )}
        {!query.isLoading && items.length === 0 && (
          <div className="text-center text-xs text-slate-400 py-4">
            No messages yet. Send one below.
          </div>
        )}
        {items.map((msg) => (
          <Bubble key={msg.id} msg={msg} />
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = body.trim();
          if (!trimmed) return;
          mutation.mutate(trimmed);
        }}
        className="border-t border-slate-200 p-2 flex gap-2"
      >
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type a message…"
          maxLength={1600}
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="submit"
          disabled={!body.trim() || mutation.isPending}
          className="rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {mutation.isPending ? 'Sending…' : 'Send'}
        </button>
      </form>
      {mutation.isError && (
        <div className="px-3 pb-2 text-xs text-red-600">
          {(mutation.error as Error).message}
        </div>
      )}
    </div>
  );
}

function Bubble({ msg }: { msg: SmsMessage }) {
  const outbound = msg.direction === 'outbound';
  return (
    <div className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
          outbound
            ? 'bg-brand-600 text-white rounded-br-sm'
            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
        }`}
      >
        <div>{msg.body}</div>
        <div
          className={`mt-1 text-[10px] ${
            outbound ? 'text-brand-100' : 'text-slate-400'
          }`}
          title={absoluteDate(msg.createdAt)}
        >
          {relativeTime(msg.createdAt)}
        </div>
      </div>
    </div>
  );
}
