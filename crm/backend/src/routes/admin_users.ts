import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { asc, eq, gt } from 'drizzle-orm';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { db } from '../db/index.js';
import { users } from '../db/schema/users.js';
import { userInvites } from '../db/schema/settings.js';
import { isSendgridConfigured, sendInviteEmail } from '../services/email.js';

const role = z.enum(['admin', 'agent', 'viewer']);
const idParam = z.object({ id: z.string().uuid() });
const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role,
});
const acceptSchema = z.object({
  token: z.string().min(16),
  password: z.string().min(8),
});

function requireAdmin(req: { user: { role: string } }, reply: { code: (n: number) => { send: (b: unknown) => unknown } }): boolean {
  if (req.user.role !== 'admin') {
    reply.code(403).send({ error: { message: 'Admin only', code: 'FORBIDDEN' } });
    return false;
  }
  return true;
}

export default async function adminUserRoutes(app: FastifyInstance) {
  app.get('/admin/users', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        phone: users.phone,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.name));
    return reply.send({ data: rows });
  });

  app.post('/admin/users/invite', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const parsed = inviteSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { message: parsed.error.message, code: 'VALIDATION' } });
    }

    const email = parsed.data.email.toLowerCase();
    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) {
      return reply
        .code(409)
        .send({ error: { message: 'Email already in use', code: 'CONFLICT' } });
    }

    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const [row] = await db
      .insert(userInvites)
      .values({
        email,
        name: parsed.data.name,
        role: parsed.data.role,
        token,
        invitedBy: req.user.sub,
        expiresAt,
      })
      .returning();

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const inviteUrl = `${frontendUrl}/accept-invite?token=${token}`;

    let emailSent = false;
    if (isSendgridConfigured()) {
      try {
        await sendInviteEmail({
          to: email,
          inviteUrl,
          inviterName: req.user.name,
        });
        emailSent = true;
      } catch (err) {
        req.log.warn({ err }, 'Failed to send invite email');
      }
    }

    return reply.code(201).send({
      data: { invite: row, inviteUrl, emailSent },
    });
  });

  app.post('/admin/users/accept-invite', async (req, reply) => {
    const parsed = acceptSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { message: parsed.error.message, code: 'VALIDATION' } });
    }
    const invite = await db.query.userInvites.findFirst({
      where: eq(userInvites.token, parsed.data.token),
    });
    if (!invite) {
      return reply
        .code(404)
        .send({ error: { message: 'Invite not found', code: 'NOT_FOUND' } });
    }
    if (invite.acceptedAt) {
      return reply
        .code(409)
        .send({ error: { message: 'Invite already accepted', code: 'CONFLICT' } });
    }
    if (invite.expiresAt < new Date()) {
      return reply
        .code(410)
        .send({ error: { message: 'Invite expired', code: 'EXPIRED' } });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const [user] = await db
      .insert(users)
      .values({
        email: invite.email,
        name: invite.name,
        role: invite.role,
        passwordHash,
        isActive: true,
      })
      .returning();

    await db
      .update(userInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(userInvites.id, invite.id));

    if (!user) {
      return reply
        .code(500)
        .send({ error: { message: 'Failed to create user', code: 'INTERNAL' } });
    }

    return reply.send({
      data: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  });

  app.patch('/admin/users/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const params = idParam.safeParse(req.params);
    if (!params.success) {
      return reply
        .code(400)
        .send({ error: { message: 'Invalid user id', code: 'VALIDATION' } });
    }
    const body = z
      .object({
        role: role.optional(),
        isActive: z.boolean().optional(),
        name: z.string().min(1).optional(),
        phone: z.string().nullable().optional(),
      })
      .safeParse(req.body);
    if (!body.success) {
      return reply
        .code(400)
        .send({ error: { message: body.error.message, code: 'VALIDATION' } });
    }

    const [updated] = await db
      .update(users)
      .set(body.data)
      .where(eq(users.id, params.data.id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        phone: users.phone,
        isActive: users.isActive,
      });
    if (!updated) {
      return reply
        .code(404)
        .send({ error: { message: 'User not found', code: 'NOT_FOUND' } });
    }
    return reply.send({ data: updated });
  });

  app.get('/admin/invites', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const rows = await db
      .select()
      .from(userInvites)
      .where(gt(userInvites.expiresAt, new Date()))
      .orderBy(asc(userInvites.createdAt));
    return reply.send({ data: rows });
  });
}
