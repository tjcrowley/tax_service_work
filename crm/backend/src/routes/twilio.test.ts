import { describe, it, expect } from 'vitest';
import { buildTestApp } from '../test/helpers.js';

describe('twilio webhook routes', () => {
  it('POST /twilio/voice-webhook returns TwiML (hangup when invalid contact)', async () => {
    const app = await buildTestApp();
    const resp = await app.inject({
      method: 'POST',
      url: '/twilio/voice-webhook?contactId=not-a-uuid',
      payload: '',
    });
    expect(resp.statusCode).toBe(200);
    expect(resp.headers['content-type']).toMatch(/xml/);
    expect(resp.payload).toContain('<Response>');
    expect(resp.payload).toContain('<Hangup/>');
    await app.close();
  });

  it('POST /twilio/sms-webhook returns empty TwiML for malformed body (no DB)', async () => {
    const app = await buildTestApp();
    const resp = await app.inject({
      method: 'POST',
      url: '/twilio/sms-webhook',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'random=1',
    });
    expect(resp.statusCode).toBe(200);
    expect(resp.headers['content-type']).toMatch(/xml/);
    expect(resp.payload).toContain('<Response/>');
    await app.close();
  });

  it('POST /twilio/recording-webhook validates body', async () => {
    const app = await buildTestApp();
    const resp = await app.inject({
      method: 'POST',
      url: '/twilio/recording-webhook',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'CallSid=&RecordingUrl=not-a-url',
    });
    expect(resp.statusCode).toBe(400);
    await app.close();
  });

  it('POST /twilio/dispositions/:callSid requires auth', async () => {
    const app = await buildTestApp();
    const resp = await app.inject({
      method: 'POST',
      url: '/twilio/dispositions/CA1234567890',
      payload: { disposition: 'answered' },
    });
    expect(resp.statusCode).toBe(401);
    await app.close();
  });
});
