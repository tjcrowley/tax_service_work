import type { FastifyInstance } from 'fastify';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { activities } from '../db/schema/activities.js';
import { contacts } from '../db/schema/contacts.js';
import { users } from '../db/schema/users.js';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const createSchema = z.object({
  type: z.literal('note'),
  body: z.string().min(1, 'Note body is required'),
});

const idParamSchema = z.object({ id: z.string().uuid() });

export default async function activityRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/contacts/:id/activities', async (req, reply) => {
    const params = idParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply
        .code(400)
        .send({ error: { message: 'Invalid contact id', code: 'VALIDATION' } });
    }
    const query = listQuerySchema.safeParse(req.query);
    if (!query.success) {
      return reply
        .code(400)
        .send({ error: { message: 'Invalid query', code: 'VALIDATION' } });
    }

    const contactExists = await db.query.contacts.findFirst({
      where: eq(contacts.id, params.data.id),
      columns: { id: true },
    });
    if (!contactExists) {
      return reply
        .code(404)
        .send({ error: { message: 'Contact not found', code: 'NOT_FOUND' } });
    }

    const offset = (query.data.page - 1) * query.data.limit;

    const [rows, totalRow] = await Promise.all([
      db
        .select({
          id: activities.id,
          contactId: activities.contactId,
          userId: activities.userId,
          createdAt: activities.createdAt,
          type: activities.type,
          direction: activities.direction,
          durationSeconds: activities.durationSeconds,
          body: activities.body,
          twilioCallSid: activities.twilioCallSid,
          twilioMessageSid: activities.twilioMessageSid,
          recordingUrl: activities.recordingUrl,
          userName: users.name,
        })
        .from(activities)
        .leftJoin(users, eq(activities.userId, users.id))
        .where(eq(activities.contactId, params.data.id))
        .orderBy(desc(activities.createdAt))
        .limit(query.data.limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(activities)
        .where(eq(activities.contactId, params.data.id)),
    ]);

    return reply.send({
      data: {
        data: rows,
        total: totalRow[0]?.count ?? 0,
        page: query.data.page,
        limit: query.data.limit,
      },
    });
  });

  app.post('/contacts/:id/activities', async (req, reply) => {
    const params = idParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply
        .code(400)
        .send({ error: { message: 'Invalid contact id', code: 'VALIDATION' } });
    }
    const body = createSchema.safeParse(req.body);
    if (!body.success) {
      return reply
        .code(400)
        .send({ error: { message: body.error.message, code: 'VALIDATION' } });
    }

    const contactExists = await db.query.contacts.findFirst({
      where: eq(contacts.id, params.data.id),
      columns: { id: true },
    });
    if (!contactExists) {
      return reply
        .code(404)
        .send({ error: { message: 'Contact not found', code: 'NOT_FOUND' } });
    }

    const [row] = await db
      .insert(activities)
      .values({
        contactId: params.data.id,
        userId: req.user.sub,
        type: 'note',
        body: body.data.body.trim(),
      })
      .returning();

    return reply.code(201).send({ data: row });
  });
}
