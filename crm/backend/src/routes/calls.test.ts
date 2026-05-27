import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildTestApp, signTestJwt } from '../test/helpers.js';
import { resetTwilioCacheForTests } from '../services/twilio.js';

describe('calls routes', () => {
  beforeEach(() => {
    resetTwilioCacheForTests();
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
  });

  afterEach(() => {
    resetTwilioCacheForTests();
  });

  it('POST /calls/outbound returns 401 without token', async () => {
    const app = await buildTestApp();
    const resp = await app.inject({
      method: 'POST',
      url: '/calls/outbound',
      payload: { contactId: '00000000-0000-0000-0000-000000000123' },
    });
    expect(resp.statusCode).toBe(401);
    await app.close();
  });

  it('POST /calls/outbound rejects invalid body', async () => {
    const app = await buildTestApp();
    const token = signTestJwt(app, 'agent');
    const resp = await app.inject({
      method: 'POST',
      url: '/calls/outbound',
      headers: { authorization: `Bearer ${token}` },
      payload: { notARealField: true },
    });
    expect(resp.statusCode).toBe(400);
    await app.close();
  });

  it('POST /calls/outbound returns 503 when Twilio not configured', async () => {
    const app = await buildTestApp();
    const token = signTestJwt(app, 'agent');
    const resp = await app.inject({
      method: 'POST',
      url: '/calls/outbound',
      headers: { authorization: `Bearer ${token}` },
      payload: { contactId: '00000000-0000-0000-0000-000000000123' },
    });
    expect(resp.statusCode).toBe(503);
    expect(JSON.parse(resp.payload).error.code).toBe('TWILIO_UNAVAILABLE');
    await app.close();
  });
});
