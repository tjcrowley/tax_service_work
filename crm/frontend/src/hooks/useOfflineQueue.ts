import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { getQueue, replayQueue } from '../lib/offlineQueue';

export type UseOfflineQueueResult = {
  pendingCount: number;
  refresh: () => Promise<void>;
  replay: () => Promise<void>;
};

export function useOfflineQueue(): UseOfflineQueueResult {
  const [pendingCount, setPendingCount] = useState(0);

  const refresh = useCallback(async () => {
    const items = await getQueue();
    setPendingCount(items.length);
  }, []);

  const replay = useCallback(async () => {
    await replayQueue(api);
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
    const onOnline = () => {
      void replay();
    };
    const onStorage = () => {
      void refresh();
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline-queue-changed', onStorage);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline-queue-changed', onStorage);
    };
  }, [refresh, replay]);

  return { pendingCount, refresh, replay };
}

export function notifyQueueChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('offline-queue-changed'));
  }
}
