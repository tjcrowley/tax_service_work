import { useEffect, useState } from 'react';
import { useOfflineQueue } from '../hooks/useOfflineQueue';
import { clearQueue, enqueue, getQueue, type QueueItem } from '../lib/offlineQueue';

function readServiceWorkerStatus(): string {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return 'Unsupported';
  }
  return navigator.serviceWorker.controller ? 'Active' : 'Not active';
}

export default function PwaTest() {
  const { pendingCount, refresh, replay } = useOfflineQueue();
  const [swStatus, setSwStatus] = useState(readServiceWorkerStatus);
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [items, setItems] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const appendLog = (msg: string) => {
    setLog((prev) => [`${new Date().toLocaleTimeString()} — ${msg}`, ...prev].slice(0, 8));
  };

  const reload = async () => {
    const next = await getQueue();
    setItems(next);
    await refresh();
  };

  useEffect(() => {
    setSwStatus(readServiceWorkerStatus());
    void reload();
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const simulateNote = async () => {
    setBusy(true);
    try {
      const id = await enqueue({
        url: '/contacts/test-contact/activities',
        method: 'POST',
        body: { type: 'note', body: `Simulated note @ ${new Date().toISOString()}` },
        contactId: 'test-contact',
        type: 'note',
      });
      appendLog(`Enqueued fake note (id ${id})`);
      window.dispatchEvent(new Event('offline-queue-changed'));
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const wipe = async () => {
    setBusy(true);
    try {
      await clearQueue();
      appendLog('Cleared queue');
      window.dispatchEvent(new Event('offline-queue-changed'));
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const manualReplay = async () => {
    setBusy(true);
    try {
      await replay();
      appendLog('Replayed queue');
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">PWA Debug</h1>
        <p className="text-sm text-slate-500">
          Inspect service worker status, network state, and the offline write queue.
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card label="Service worker" value={swStatus} />
        <Card label="Network" value={online ? 'Online' : 'Offline'} tone={online ? 'ok' : 'warn'} />
        <Card label="Queued writes" value={String(pendingCount)} tone={pendingCount > 0 ? 'warn' : 'ok'} />
      </section>

      <section className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={simulateNote}
          disabled={busy}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          Simulate Offline Note
        </button>
        <button
          type="button"
          onClick={wipe}
          disabled={busy}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Clear Queue
        </button>
        <button
          type="button"
          onClick={manualReplay}
          disabled={busy}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Replay Queue
        </button>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Pending items</h2>
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">Queue is empty.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li
                key={it.id}
                className="border border-slate-200 rounded-md px-3 py-2 text-xs bg-white font-mono"
              >
                <div className="font-semibold text-slate-800">
                  #{it.id} · {it.method} {it.url}
                </div>
                <div className="text-slate-500">
                  type={it.type} · contact={it.contactId} · at={new Date(it.createdAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {log.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Activity log</h2>
          <ul className="text-xs text-slate-600 space-y-1 font-mono">
            {log.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type CardProps = { label: string; value: string; tone?: 'ok' | 'warn' };
function Card({ label, value, tone }: CardProps) {
  const valueClass =
    tone === 'warn'
      ? 'text-yellow-700'
      : tone === 'ok'
        ? 'text-emerald-700'
        : 'text-slate-900';
  return (
    <div className="border border-slate-200 bg-white rounded-md px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-base font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}
