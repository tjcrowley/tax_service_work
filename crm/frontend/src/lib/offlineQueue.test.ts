import { beforeEach, describe, expect, it } from 'vitest';
import { _resetDbForTests, clearQueue, dequeue, enqueue, getQueue } from './offlineQueue';

async function resetIdb() {
  await _resetDbForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('tax-crm-offline');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

describe('offlineQueue', () => {
  beforeEach(async () => {
    await resetIdb();
  });

  it('enqueue returns id and getQueue includes the item', async () => {
    const id = await enqueue({
      url: '/contacts/abc/activities',
      method: 'POST',
      body: { type: 'note', body: 'hello' },
      contactId: 'abc',
      type: 'note',
    });
    expect(typeof id).toBe('number');

    const items = await getQueue();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id,
      url: '/contacts/abc/activities',
      method: 'POST',
      contactId: 'abc',
      type: 'note',
    });
    expect(items[0]?.body).toEqual({ type: 'note', body: 'hello' });
    expect(typeof items[0]?.createdAt).toBe('number');
  });

  it('dequeue removes a specific item', async () => {
    const a = await enqueue({
      url: '/a',
      method: 'POST',
      body: { x: 1 },
      contactId: 'a',
      type: 'note',
    });
    const b = await enqueue({
      url: '/b',
      method: 'POST',
      body: { x: 2 },
      contactId: 'b',
      type: 'task',
    });

    await dequeue(a);
    const remaining = await getQueue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe(b);
  });

  it('clearQueue empties the store', async () => {
    await enqueue({
      url: '/x',
      method: 'POST',
      body: null,
      contactId: 'x',
      type: 'note',
    });
    await enqueue({
      url: '/y',
      method: 'POST',
      body: null,
      contactId: 'y',
      type: 'task',
    });
    await clearQueue();
    expect(await getQueue()).toEqual([]);
  });
});
