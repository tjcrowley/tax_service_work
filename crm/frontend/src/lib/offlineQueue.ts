import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type { AxiosInstance } from 'axios';

export type QueueItemType = 'note' | 'task';

export type QueueItemInput = {
  url: string;
  method: string;
  body: unknown;
  contactId: string;
  type: QueueItemType;
};

export type QueueItem = QueueItemInput & {
  id: number;
  createdAt: number;
};

interface OfflineDB extends DBSchema {
  'pending-writes': {
    key: number;
    value: Omit<QueueItem, 'id'>;
  };
}

const DB_NAME = 'tax-crm-offline';
const STORE = 'pending-writes';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;

function getDb(): Promise<IDBPDatabase<OfflineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

export async function _resetDbForTests(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } catch {
      // ignore
    }
  }
  dbPromise = null;
}

export async function enqueue(item: QueueItemInput): Promise<number> {
  const db = await getDb();
  const id = await db.add(STORE, { ...item, createdAt: Date.now() });
  return id as number;
}

export async function getQueue(): Promise<QueueItem[]> {
  const db = await getDb();
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  const all = await store.getAll();
  const keys = await store.getAllKeys();
  await tx.done;
  return all.map((value, idx) => ({ ...(value as Omit<QueueItem, 'id'>), id: keys[idx] as number }));
}

export async function dequeue(id: number): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, id);
}

export async function clearQueue(): Promise<void> {
  const db = await getDb();
  await db.clear(STORE);
}

export type ReplayResult = {
  succeeded: number;
  failed: number;
};

export async function replayQueue(apiClient: AxiosInstance): Promise<ReplayResult> {
  const items = await getQueue();
  let succeeded = 0;
  let failed = 0;
  for (const item of items) {
    try {
      await apiClient.request({
        url: item.url,
        method: item.method,
        data: item.body,
      });
      await dequeue(item.id);
      succeeded += 1;
    } catch {
      failed += 1;
    }
  }
  return { succeeded, failed };
}
