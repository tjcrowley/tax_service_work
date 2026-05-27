import { describe, it, expect, beforeEach } from 'vitest';
import { buildTestApp, signTestJwt } from '../test/helpers.js';
import { resetSendgridCacheForTests } from '../services/email.js';

describe('admin user routes', () => {
  beforeEach(() => {
    resetSendgridCacheForTests();
    delete process.env.SENDGRID_API_KEY;
  });

  it('GET /admin/users requires auth', async () => {
    const app = await buildTestApp();
    const resp = await app.inject({ method: 'GET', url: '/admin/users' });
    expect(resp.statusCode).toBe(401);
    await app.close();
  });

  it('GET /admin/users forbids non-admins', async () => {
    const app = await buildTestApp();
    const token = signTestJwt(app, 'agent');
    const resp = await app.inject({
      method: 'GET',
      url: '/admin/users',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(resp.statusCode).toBe(403);
    await app.close();
  });

  it('POST /admin/users/invite validates body', async () => {
    const app = await buildTestApp();
    const token = signTestJwt(app, 'admin');
    const resp = await app.inject({
      method: 'POST',
      url: '/admin/users/invite',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'not-an-email', name: '', role: 'agent' },
    });
    expect(resp.statusCode).toBe(400);
    await app.close();
  });

  it('POST /admin/users/accept-invite validates token + password', async () => {
    const app = await buildTestApp();
    const resp = await app.inject({
      method: 'POST',
      url: '/admin/users/accept-invite',
      payload: { token: 'short', password: 'short' },
    });
    expect(resp.statusCode).toBe(400);
    await app.close();
  });
});
