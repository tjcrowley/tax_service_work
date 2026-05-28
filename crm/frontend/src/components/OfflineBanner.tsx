import { useEffect, useState } from 'react';
import { useOfflineQueue } from '../hooks/useOfflineQueue';

function readInitialOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

export default function OfflineBanner() {
  const [online, setOnline] = useState<boolean>(readInitialOnline);
  const { pendingCount } = useOfflineQueue();

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="alert"
      className="bg-yellow-100 border-b border-yellow-300 text-yellow-900 text-sm px-4 py-2 flex items-center gap-2"
    >
      <span className="font-semibold">You&apos;re offline</span>
      <span>
        — notes and tasks will sync when you reconnect.
        {pendingCount > 0 && ` (${pendingCount} ${pendingCount === 1 ? 'item' : 'items'} queued)`}
      </span>
    </div>
  );
}
