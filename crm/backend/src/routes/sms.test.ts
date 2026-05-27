import { describe, it, expect, beforeEach } from 'vitest';
import { buildTestApp, signTestJwt } from '../test/helpers.js';
import { resetTwilioCacheForTests } from '../services/twilio.js';

describe('sms routes', () => {
  beforeEach(() => {
    resetTwilioCacheForTests();
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
  });

  it('POST /contacts/:id/sms returns 401 without auth', async () => {
    const app = await buildTestApp();
    const resp = await app.inject({
      method: 'POST',
      url: '/contacts/00000000-0000-0000-0000-000000000123/sms',
      payload: { body: 'hello' },
    });
    expect(resp.statusCode).toBe(401);
    await app.close();
  });

  it('POST /contacts/:id/sms rejects invalid contact id', async () => {
    const app = await buildTestApp();
    const token = signTestJwt(app, 'agent');
    const resp = await app.inject({
      method: 'POST',
      url: '/contacts/not-a-uuid/sms',
      headers: { authorization: `Bearer ${token}` },
      payload: { body: 'hello' },
    });
    expect(resp.statusCode).toBe(400);
    await app.close();
  });

  it('POST /contacts/:id/sms rejects empty body', async () => {
    const app = await buildTestApp();
    const token = signTestJwt(app, 'agent');
    const resp = await app.inject({
      method: 'POST',
      url: '/contacts/00000000-0000-0000-0000-000000000123/sms',
      headers: { authorization: `Bearer ${token}` },
      payload: { body: '' },
    });
    expect(resp.statusCode).toBe(400);
    await app.close();
  });
});
