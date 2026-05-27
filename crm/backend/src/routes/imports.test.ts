import { describe, it, expect } from 'vitest';
import { buildTestApp, signTestJwt } from '../test/helpers.js';
import {
  buildErrorReportCsv,
  guessMapping,
  normalizePhone,
} from '../services/imports.js';

describe('imports routes', () => {
  it('POST /imports requires auth', async () => {
    const app = await buildTestApp();
    const resp = await app.inject({
      method: 'POST',
      url: '/imports',
      payload: { filename: 'x.csv', csv: 'a,b\n1,2', mapping: {} },
    });
    expect(resp.statusCode).toBe(401);
    await app.close();
  });

  it('POST /imports/preview rejects missing csv', async () => {
    const app = await buildTestApp();
    const token = signTestJwt(app, 'agent');
    const resp = await app.inject({
      method: 'POST',
      url: '/imports/preview',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(resp.statusCode).toBe(400);
    await app.close();
  });

  it('POST /imports/preview detects headers and suggests mapping', async () => {
    const app = await buildTestApp();
    const token = signTestJwt(app, 'agent');
    const csv = 'First Name,Last Name,Phone,Email\nJane,Doe,5125550101,jane@example.com\n';
    const resp = await app.inject({
      method: 'POST',
      url: '/imports/preview',
      headers: { authorization: `Bearer ${token}` },
      payload: { csv },
    });
    expect(resp.statusCode).toBe(200);
    const body = JSON.parse(resp.payload).data;
    expect(body.headers).toContain('First Name');
    expect(body.suggestedMapping.firstName).toBe('First Name');
    expect(body.suggestedMapping.phone).toBe('Phone');
    expect(body.totalRows).toBe(1);
    await app.close();
  });

  it('POST /imports rejects mapping missing required fields', async () => {
    const app = await buildTestApp();
    const token = signTestJwt(app, 'agent');
    const resp = await app.inject({
      method: 'POST',
      url: '/imports',
      headers: { authorization: `Bearer ${token}` },
      payload: { filename: 'x.csv', csv: 'a\n1', mapping: { city: 'a' } },
    });
    expect(resp.statusCode).toBe(400);
    await app.close();
  });

  it('GET /imports/:id rejects bad uuid', async () => {
    const app = await buildTestApp();
    const token = signTestJwt(app, 'agent');
    const resp = await app.inject({
      method: 'GET',
      url: '/imports/not-a-uuid',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(resp.statusCode).toBe(400);
    await app.close();
  });

  it('GET /imports/:id/errors.csv returns CSV content type', async () => {
    const app = await buildTestApp();
    const token = signTestJwt(app, 'agent');
    const resp = await app.inject({
      method: 'GET',
      url: '/imports/00000000-0000-0000-0000-000000000111/errors.csv',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(resp.statusCode).toBe(200);
    expect(resp.headers['content-type']).toMatch(/csv/);
    expect(resp.payload).toMatch(/^row,reason/);
    await app.close();
  });
});

describe('imports service helpers', () => {
  it('normalizePhone returns E.164 for US 10-digit', () => {
    expect(normalizePhone('5125550101')).toBe('+15125550101');
  });

  it('normalizePhone rejects garbage', () => {
    expect(normalizePhone('abc')).toBeNull();
  });

  it('guessMapping handles common headers', () => {
    const m = guessMapping(['First Name', 'Last Name', 'Phone', 'Email', 'Zip Code']);
    expect(m.firstName).toBe('First Name');
    expect(m.zip).toBe('Zip Code');
  });

  it('buildErrorReportCsv emits header even for empty errors', () => {
    expect(buildErrorReportCsv([])).toBe('row,reason\n');
  });
});
