import type { FastifyInstance } from 'fastify';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { cannedResponses, leadSources } from '../db/schema/settings.js';

const idParam = z.object({ id: z.string().uuid() });

const cannedSchema = z.object({
  label: z.string().min(1).max(120),
  body: z.string().min(1).max(1600),
});
const leadSourceSchema = z.object({ label: z.string().min(1).max(120) });

function requireAdmin(req: { user: { role: string } }, reply: { code: (n: number) => { send: (b: unknown) => unknown } }): boolean {
  if (req.user.role !== 'admin') {
    reply.code(403).send({ error: { message: 'Admin only', code: 'FORBIDDEN' } });
    return false;
  }
  return true;
}

export default async function settingsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/settings/canned-responses', async (_req, reply) => {
    const rows = await db
      .select()
      .from(cannedResponses)
      .orderBy(asc(cannedResponses.label));
    return reply.send({ data: rows });
  });

  app.post('/settings/canned-responses', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const parsed = cannedSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { message: parsed.error.message, code: 'VALIDATION' } });
    }
    const [row] = await db.insert(cannedResponses).values(parsed.data).returning();
    return reply.code(201).send({ data: row });
  });

  app.patch('/settings/canned-responses/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const params = idParam.safeParse(req.params);
    if (!params.success) {
      return reply
        .code(400)
        .send({ error: { message: 'Invalid id', code: 'VALIDATION' } });
    }
    const body = cannedSchema.partial().safeParse(req.body);
    if (!body.success) {
      return reply
        .code(400)
        .send({ error: { message: body.error.message, code: 'VALIDATION' } });
    }
    const [row] = await db
      .update(cannedResponses)
      .set({ ...body.data, updatedAt: new Date() })
      .where(eq(cannedResponses.id, params.data.id))
      .returning();
    if (!row) {
      return reply
        .code(404)
        .send({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    }
    return reply.send({ data: row });
  });

  app.delete('/settings/canned-responses/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const params = idParam.safeParse(req.params);
    if (!params.success) {
      return reply
        .code(400)
        .send({ error: { message: 'Invalid id', code: 'VALIDATION' } });
    }
    const [deleted] = await db
      .delete(cannedResponses)
      .where(eq(cannedResponses.id, params.data.id))
      .returning({ id: cannedResponses.id });
    if (!deleted) {
      return reply
        .code(404)
        .send({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    }
    return reply.send({ data: { id: deleted.id } });
  });

  app.get('/settings/lead-sources', async (_req, reply) => {
    const rows = await db.select().from(leadSources).orderBy(asc(leadSources.label));
    return reply.send({ data: rows });
  });

  app.post('/settings/lead-sources', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const parsed = leadSourceSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { message: parsed.error.message, code: 'VALIDATION' } });
    }
    try {
      const [row] = await db
        .insert(leadSources)
        .values({ label: parsed.data.label })
        .returning();
      return reply.code(201).send({ data: row });
    } catch (err) {
      return reply
        .code(409)
        .send({ error: { message: 'Lead source already exists', code: 'CONFLICT' } });
    }
  });

  app.delete('/settings/lead-sources/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const params = idParam.safeParse(req.params);
    if (!params.success) {
      return reply
        .code(400)
        .send({ error: { message: 'Invalid id', code: 'VALIDATION' } });
    }
    const [deleted] = await db
      .delete(leadSources)
      .where(eq(leadSources.id, params.data.id))
      .returning({ id: leadSources.id });
    if (!deleted) {
      return reply
        .code(404)
        .send({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    }
    return reply.send({ data: { id: deleted.id } });
  });
}
