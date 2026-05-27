import { describe, it, expect } from 'vitest';
import { buildTestApp, signTestJwt } from '../test/helpers.js';

describe('settings routes', () => {
  it('GET /settings/canned-responses requires auth', async () => {
    const app = await buildTestApp();
    const resp = await app.inject({ method: 'GET', url: '/settings/canned-responses' });
    expect(resp.statusCode).toBe(401);
    await app.close();
  });

  it('POST /settings/canned-responses forbids non-admin', async () => {
    const app = await buildTestApp();
    const token = signTestJwt(app, 'agent');
    const resp = await app.inject({
      method: 'POST',
      url: '/settings/canned-responses',
      headers: { authorization: `Bearer ${token}` },
      payload: { label: 'Hi', body: 'Hello' },
    });
    expect(resp.statusCode).toBe(403);
    await app.close();
  });

  it('POST /settings/lead-sources rejects empty label', async () => {
    const app = await buildTestApp();
    const token = signTestJwt(app, 'admin');
    const resp = await app.inject({
      method: 'POST',
      url: '/settings/lead-sources',
      headers: { authorization: `Bearer ${token}` },
      payload: { label: '' },
    });
    expect(resp.statusCode).toBe(400);
    await app.close();
  });

  it('GET /settings/lead-sources requires auth', async () => {
    const app = await buildTestApp();
    const resp = await app.inject({ method: 'GET', url: '/settings/lead-sources' });
    expect(resp.statusCode).toBe(401);
    await app.close();
  });
});
