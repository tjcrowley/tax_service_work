import type { FastifyInstance } from 'fastify';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema/users.js';

export default async function userRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/users', async (_req, reply) => {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(asc(users.name));
    return reply.send({ data: rows });
  });
}
