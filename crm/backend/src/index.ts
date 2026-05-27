import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import formbody from '@fastify/formbody';
import authPlugin from './plugins/auth.js';
import authRoutes from './routes/auth.js';
import contactRoutes from './routes/contacts.js';
import userRoutes from './routes/users.js';
import activityRoutes from './routes/activities.js';
import taskRoutes from './routes/tasks.js';
import callRoutes from './routes/calls.js';
import twilioRoutes from './routes/twilio.js';
import smsRoutes from './routes/sms.js';
import documentRoutes from './routes/documents.js';
import importRoutes from './routes/imports.js';
import { validateTwilioCredentials } from './services/twilio.js';
import { validateSpacesCredentials } from './services/spaces.js';

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: FRONTEND_URL,
    credentials: true,
  });

  await app.register(formbody);

  await app.register(multipart, {
    limits: {
      fileSize: 25 * 1024 * 1024,
      files: 1,
    },
  });

  await app.register(authPlugin);

  app.get('/health', async () => ({ ok: true }));

  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(contactRoutes);
  await app.register(activityRoutes);
  await app.register(taskRoutes);
  await app.register(callRoutes);
  await app.register(twilioRoutes);
  await app.register(smsRoutes);
  await app.register(documentRoutes);
  await app.register(importRoutes);

  return app;
}

async function start() {
  const app = await buildServer();
  validateTwilioCredentials(app.log);
  validateSpacesCredentials(app.log);
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`API listening on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
