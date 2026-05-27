import { describe, it, expect } from 'vitest';
import { buildTestApp, signTestJwt } from '../test/helpers.js';

describe('dashboard routes', () => {
  it('GET /dashboard/summary requires auth', async () => {
    const app = await buildTestApp();
    const resp = await app.inject({ method: 'GET', url: '/dashboard/summary' });
    expect(resp.statusCode).toBe(401);
    await app.close();
  });

  it('GET /dashboard/funnel requires auth', async () => {
    const app = await buildTestApp();
    const resp = await app.inject({ method: 'GET', url: '/dashboard/funnel' });
    expect(resp.statusCode).toBe(401);
    await app.close();
  });

  it('GET /dashboard/agents requires auth', async () => {
    const app = await buildTestApp();
    const resp = await app.inject({ method: 'GET', url: '/dashboard/agents' });
    expect(resp.statusCode).toBe(401);
    await app.close();
  });

  it('GET /dashboard/summary rejects malformed date', async () => {
    const app = await buildTestApp();
    const token = signTestJwt(app);
    const resp = await app.inject({
      method: 'GET',
      url: '/dashboard/summary?from=not-a-date',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(resp.statusCode).toBe(400);
    await app.close();
  });
});
