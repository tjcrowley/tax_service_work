import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import formbody from '@fastify/formbody';
import authPlugin from '../plugins/auth.js';
import callRoutes from '../routes/calls.js';
import twilioRoutes from '../routes/twilio.js';
import smsRoutes from '../routes/sms.js';

export async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: 'http://localhost:5173', credentials: true });
  await app.register(formbody);
  await app.register(multipart, {
    limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  });
  await app.register(authPlugin);
  await app.register(callRoutes);
  await app.register(twilioRoutes);
  await app.register(smsRoutes);
  await app.ready();
  return app;
}

export function signTestJwt(
  app: FastifyInstance,
  role: 'admin' | 'agent' | 'viewer' = 'admin',
): string {
  return app.jwt.sign({
    sub: '00000000-0000-0000-0000-000000000001',
    email: 'test@example.com',
    name: 'Test User',
    role,
  });
}
