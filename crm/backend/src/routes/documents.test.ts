import { describe, it, expect, beforeEach } from 'vitest';
import { buildTestApp, signTestJwt } from '../test/helpers.js';
import { resetSpacesCacheForTests } from '../services/spaces.js';

describe('documents routes', () => {
  beforeEach(() => {
    resetSpacesCacheForTests();
    delete process.env.DO_SPACES_KEY;
    delete process.env.DO_SPACES_SECRET;
    delete process.env.DO_SPACES_BUCKET;
    delete process.env.DO_SPACES_ENDPOINT;
    delete process.env.DO_SPACES_REGION;
  });

  it('GET /contacts/:id/documents requires auth', async () => {
    const app = await buildTestApp();
    const resp = await app.inject({
      method: 'GET',
      url: '/contacts/00000000-0000-0000-0000-000000000123/documents',
    });
    expect(resp.statusCode).toBe(401);
    await app.close();
  });

  it('POST /contacts/:id/documents requires multipart', async () => {
    const app = await buildTestApp();
    const token = signTestJwt(app, 'agent');
    const resp = await app.inject({
      method: 'POST',
      url: '/contacts/00000000-0000-0000-0000-000000000123/documents',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: { hello: 'world' },
    });
    expect(resp.statusCode).toBe(400);
    expect(JSON.parse(resp.payload).error.code).toBe('VALIDATION');
    await app.close();
  });

  it('POST /contacts/:id/documents returns 503 when Spaces not configured', async () => {
    const app = await buildTestApp();
    const token = signTestJwt(app, 'agent');
    const boundary = '----testboundary';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="t.txt"',
      'Content-Type: text/plain',
      '',
      'hello',
      `--${boundary}--`,
      '',
    ].join('\r\n');
    const resp = await app.inject({
      method: 'POST',
      url: '/contacts/00000000-0000-0000-0000-000000000123/documents',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });
    expect(resp.statusCode).toBe(503);
    expect(JSON.parse(resp.payload).error.code).toBe('SPACES_UNAVAILABLE');
    await app.close();
  });

  it('GET /contacts/:id/documents/:docId/download rejects bad ids', async () => {
    const app = await buildTestApp();
    const token = signTestJwt(app, 'agent');
    const resp = await app.inject({
      method: 'GET',
      url: '/contacts/not-a-uuid/documents/also-not/download',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(resp.statusCode).toBe(400);
    await app.close();
  });
});
