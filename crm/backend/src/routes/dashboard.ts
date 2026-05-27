import type { FastifyInstance } from 'fastify';
import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { activities } from '../db/schema/activities.js';
import { contacts } from '../db/schema/contacts.js';
import { tasks } from '../db/schema/tasks.js';
import { users } from '../db/schema/users.js';

const rangeQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

function defaultRange(from?: Date, to?: Date): { from: Date; to: Date } {
  const now = new Date();
  const end = to ?? endOfDay(now);
  const start = from ?? startOfDay(now);
  return { from: start, to: end };
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export default async function dashboardRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/dashboard/summary', async (req, reply) => {
    const parsed = rangeQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { message: 'Invalid query', code: 'VALIDATION' } });
    }
    const range = defaultRange(parsed.data.from, parsed.data.to);

    const dateWindow = and(
      gte(activities.createdAt, range.from),
      lte(activities.createdAt, range.to),
    );

    const [[callsRow], [smsRow], [leadsRow], [tasksDueRow]] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(activities)
        .where(and(dateWindow, eq(activities.type, 'call'))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(activities)
        .where(and(dateWindow, eq(activities.type, 'sms'))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(contacts)
        .where(
          and(
            gte(contacts.createdAt, range.from),
            lte(contacts.createdAt, range.to),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(
          and(
            isNull(tasks.completedAt),
            gte(tasks.dueAt, range.from),
            lte(tasks.dueAt, range.to),
          ),
        ),
    ]);

    return reply.send({
      data: {
        range: { from: range.from.toISOString(), to: range.to.toISOString() },
        calls: callsRow?.count ?? 0,
        sms: smsRow?.count ?? 0,
        newLeads: leadsRow?.count ?? 0,
        tasksDue: tasksDueRow?.count ?? 0,
      },
    });
  });

  app.get('/dashboard/funnel', async (_req, reply) => {
    const stageRows = await db
      .select({
        stage: contacts.pipelineStage,
        count: sql<number>`count(*)::int`,
        totalDebt: sql<string>`coalesce(sum(${contacts.taxDebtAmount}), 0)::text`,
      })
      .from(contacts)
      .groupBy(contacts.pipelineStage);

    const sourceRows = await db
      .select({
        source: contacts.source,
        count: sql<number>`count(*)::int`,
      })
      .from(contacts)
      .groupBy(contacts.source);

    return reply.send({
      data: {
        byStage: stageRows.map((r) => ({
          stage: r.stage,
          count: r.count,
          totalDebt: r.totalDebt,
        })),
        bySource: sourceRows.map((r) => ({ source: r.source, count: r.count })),
      },
    });
  });

  app.get('/dashboard/agents', async (req, reply) => {
    const parsed = rangeQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { message: 'Invalid query', code: 'VALIDATION' } });
    }
    const range = defaultRange(parsed.data.from, parsed.data.to);

    const callsByAgent = await db
      .select({
        userId: activities.userId,
        count: sql<number>`count(*)::int`,
      })
      .from(activities)
      .where(
        and(
          eq(activities.type, 'call'),
          gte(activities.createdAt, range.from),
          lte(activities.createdAt, range.to),
        ),
      )
      .groupBy(activities.userId);

    const smsByAgent = await db
      .select({
        userId: activities.userId,
        count: sql<number>`count(*)::int`,
      })
      .from(activities)
      .where(
        and(
          eq(activities.type, 'sms'),
          gte(activities.createdAt, range.from),
          lte(activities.createdAt, range.to),
        ),
      )
      .groupBy(activities.userId);

    const contactsByAgent = await db
      .select({
        userId: contacts.assignedTo,
        count: sql<number>`count(*)::int`,
      })
      .from(contacts)
      .groupBy(contacts.assignedTo);

    const allUsers = await db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(eq(users.isActive, true));

    const callsMap = new Map<string | null, number>();
    callsByAgent.forEach((r) => callsMap.set(r.userId, r.count));
    const smsMap = new Map<string | null, number>();
    smsByAgent.forEach((r) => smsMap.set(r.userId, r.count));
    const contactsMap = new Map<string | null, number>();
    contactsByAgent.forEach((r) => contactsMap.set(r.userId, r.count));

    const rows = allUsers.map((u) => ({
      userId: u.id,
      name: u.name,
      role: u.role,
      calls: callsMap.get(u.id) ?? 0,
      sms: smsMap.get(u.id) ?? 0,
      contacts: contactsMap.get(u.id) ?? 0,
    }));

    return reply.send({
      data: {
        range: { from: range.from.toISOString(), to: range.to.toISOString() },
        agents: rows,
      },
    });
  });
}
