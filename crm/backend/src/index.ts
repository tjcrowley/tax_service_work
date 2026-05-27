import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import authPlugin from './plugins/auth.js';
import authRoutes from './routes/auth.js';
import contactRoutes from './routes/contacts.js';
import userRoutes from './routes/users.js';

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: FRONTEND_URL,
    credentials: true,
  });

  await app.register(authPlugin);

  app.get('/health', async () => ({ ok: true }));

  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(contactRoutes);

  return app;
}

async function start() {
  const app = await buildServer();
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`API listening on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
