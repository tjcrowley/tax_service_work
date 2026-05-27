import type { FastifyInstance } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { activities } from '../db/schema/activities.js';
import { contacts } from '../db/schema/contacts.js';
import { users } from '../db/schema/users.js';
import { isTwilioConfigured, sendSms } from '../services/twilio.js';

const idParam = z.object({ id: z.string().uuid() });
const sendSchema = z.object({ body: z.string().min(1).max(1600) });

export default async function smsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/contacts/:id/sms', async (req, reply) => {
    const params = idParam.safeParse(req.params);
    if (!params.success) {
      return reply
        .code(400)
        .send({ error: { message: 'Invalid contact id', code: 'VALIDATION' } });
    }
    const contact = await db.query.contacts.findFirst({
      where: eq(contacts.id, params.data.id),
      columns: { id: true },
    });
    if (!contact) {
      return reply
        .code(404)
        .send({ error: { message: 'Contact not found', code: 'NOT_FOUND' } });
    }

    const rows = await db
      .select({
        id: activities.id,
        contactId: activities.contactId,
        userId: activities.userId,
        createdAt: activities.createdAt,
        direction: activities.direction,
        body: activities.body,
        twilioMessageSid: activities.twilioMessageSid,
        userName: users.name,
      })
      .from(activities)
      .leftJoin(users, eq(activities.userId, users.id))
      .where(
        and(
          eq(activities.contactId, params.data.id),
          eq(activities.type, 'sms'),
        ),
      )
      .orderBy(desc(activities.createdAt))
      .limit(200);

    return reply.send({ data: rows.reverse() });
  });

  app.post('/contacts/:id/sms', async (req, reply) => {
    const params = idParam.safeParse(req.params);
    if (!params.success) {
      return reply
        .code(400)
        .send({ error: { message: 'Invalid contact id', code: 'VALIDATION' } });
    }
    const body = sendSchema.safeParse(req.body);
    if (!body.success) {
      return reply
        .code(400)
        .send({ error: { message: body.error.message, code: 'VALIDATION' } });
    }

    const contact = await db.query.contacts.findFirst({
      where: eq(contacts.id, params.data.id),
    });
    if (!contact) {
      return reply
        .code(404)
        .send({ error: { message: 'Contact not found', code: 'NOT_FOUND' } });
    }
    if (contact.doNotSms) {
      return reply
        .code(409)
        .send({ error: { message: 'Contact opted out of SMS', code: 'DO_NOT_SMS' } });
    }

    if (!isTwilioConfigured()) {
      return reply
        .code(503)
        .send({ error: { message: 'Twilio is not configured', code: 'TWILIO_UNAVAILABLE' } });
    }

    let result: { sid: string };
    try {
      result = await sendSms({ to: contact.phone, body: body.data.body });
    } catch (err) {
      req.log.error({ err }, 'Twilio SMS send failed');
      return reply
        .code(502)
        .send({ error: { message: 'Failed to send SMS', code: 'TWILIO_ERROR' } });
    }

    const [activity] = await db
      .insert(activities)
      .values({
        contactId: contact.id,
        userId: req.user.sub,
        type: 'sms',
        direction: 'outbound',
        body: body.data.body,
        twilioMessageSid: result.sid,
      })
      .returning();

    return reply.code(201).send({ data: activity });
  });
}

