import type { FastifyInstance } from 'fastify';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { tasks, type NewTaskRow, type TaskRow } from '../db/schema/tasks.js';
import { contacts } from '../db/schema/contacts.js';
import { activities } from '../db/schema/activities.js';
import { users } from '../db/schema/users.js';

const priority = z.enum(['high', 'normal', 'low']);

const createSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  dueAt: z.coerce.date().optional(),
  assignedTo: z.string().uuid().optional(),
  priority: priority.default('normal'),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  priority: priority.optional(),
  completedAt: z.coerce.date().nullable().optional(),
});

const myTasksQuery = z.object({
  all: z
    .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
    .optional(),
});

const idParam = z.object({ id: z.string().uuid() });

type TaskWithContext = TaskRow & {
  contactFirstName: string | null;
  contactLastName: string | null;
  assigneeName: string | null;
};

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

function bucketTasks(rows: TaskWithContext[]): {
  overdue: TaskWithContext[];
  today: TaskWithContext[];
  upcoming: TaskWithContext[];
} {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const overdue: TaskWithContext[] = [];
  const today: TaskWithContext[] = [];
  const upcoming: TaskWithContext[] = [];
  for (const t of rows) {
    if (!t.dueAt) {
      upcoming.push(t);
      continue;
    }
    const due = new Date(t.dueAt);
    if (due < todayStart) overdue.push(t);
    else if (due <= todayEnd) today.push(t);
    else upcoming.push(t);
  }
  return { overdue, today, upcoming };
}

export default async function taskRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/contacts/:id/tasks', async (req, reply) => {
    const params = idParam.safeParse(req.params);
    if (!params.success) {
      return reply
        .code(400)
        .send({ error: { message: 'Invalid contact id', code: 'VALIDATION' } });
    }
    const rows = await db
      .select()
      .from(tasks)
      .where(eq(tasks.contactId, params.data.id))
      .orderBy(asc(tasks.dueAt));
    return reply.send({ data: rows });
  });

  app.post('/contacts/:id/tasks', async (req, reply) => {
    const params = idParam.safeParse(req.params);
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

    const insert: NewTaskRow = {
      contactId: params.data.id,
      createdBy: req.user.sub,
      assignedTo: body.data.assignedTo ?? req.user.sub,
      title: body.data.title,
      description: body.data.description ?? null,
      dueAt: body.data.dueAt ?? null,
      priority: body.data.priority,
    };

    const [row] = await db.insert(tasks).values(insert).returning();
    return reply.code(201).send({ data: row });
  });

  app.get('/tasks', async (req, reply) => {
    const parsed = myTasksQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { message: 'Invalid query', code: 'VALIDATION' } });
    }
    const wantAll = parsed.data.all === 'true' || parsed.data.all === '1';
    const isAdmin = req.user.role === 'admin';
    const all = wantAll && isAdmin;

    const whereOpen = all
      ? isNull(tasks.completedAt)
      : and(isNull(tasks.completedAt), eq(tasks.assignedTo, req.user.sub));

    const rows = await db
      .select({
        id: tasks.id,
        contactId: tasks.contactId,
        assignedTo: tasks.assignedTo,
        createdBy: tasks.createdBy,
        createdAt: tasks.createdAt,
        dueAt: tasks.dueAt,
        completedAt: tasks.completedAt,
        title: tasks.title,
        description: tasks.description,
        priority: tasks.priority,
        contactFirstName: contacts.firstName,
        contactLastName: contacts.lastName,
        assigneeName: users.name,
      })
      .from(tasks)
      .leftJoin(contacts, eq(tasks.contactId, contacts.id))
      .leftJoin(users, eq(tasks.assignedTo, users.id))
      .where(whereOpen)
      .orderBy(asc(tasks.dueAt));

    const buckets = bucketTasks(rows);
    return reply.send({ data: buckets });
  });

  app.patch('/tasks/:id', async (req, reply) => {
    const params = idParam.safeParse(req.params);
    if (!params.success) {
      return reply
        .code(400)
        .send({ error: { message: 'Invalid task id', code: 'VALIDATION' } });
    }
    const body = updateSchema.safeParse(req.body);
    if (!body.success) {
      return reply
        .code(400)
        .send({ error: { message: body.error.message, code: 'VALIDATION' } });
    }

    const existing = await db.query.tasks.findFirst({ where: eq(tasks.id, params.data.id) });
    if (!existing) {
      return reply
        .code(404)
        .send({ error: { message: 'Task not found', code: 'NOT_FOUND' } });
    }

    const patch: Partial<NewTaskRow> = {};
    if (body.data.title !== undefined) patch.title = body.data.title;
    if (body.data.description !== undefined) patch.description = body.data.description;
    if (body.data.dueAt !== undefined) patch.dueAt = body.data.dueAt;
    if (body.data.assignedTo !== undefined) patch.assignedTo = body.data.assignedTo;
    if (body.data.priority !== undefined) patch.priority = body.data.priority;
    if (body.data.completedAt !== undefined) patch.completedAt = body.data.completedAt;

    const [updated] = await db
      .update(tasks)
      .set(patch)
      .where(eq(tasks.id, params.data.id))
      .returning();

    if (!updated) {
      return reply
        .code(404)
        .send({ error: { message: 'Task not found', code: 'NOT_FOUND' } });
    }

    const wasCompleted = existing.completedAt !== null;
    const nowCompleted = updated.completedAt !== null;
    if (!wasCompleted && nowCompleted) {
      await db.insert(activities).values({
        contactId: updated.contactId,
        userId: req.user.sub,
        type: 'task_complete',
        body: updated.title,
      });
    }

    return reply.send({ data: updated });
  });

  app.delete('/tasks/:id', async (req, reply) => {
    const params = idParam.safeParse(req.params);
    if (!params.success) {
      return reply
        .code(400)
        .send({ error: { message: 'Invalid task id', code: 'VALIDATION' } });
    }
    const [deleted] = await db
      .delete(tasks)
      .where(eq(tasks.id, params.data.id))
      .returning({ id: tasks.id });
    if (!deleted) {
      return reply
        .code(404)
        .send({ error: { message: 'Task not found', code: 'NOT_FOUND' } });
    }
    return reply.send({ data: { id: deleted.id } });
  });
}
