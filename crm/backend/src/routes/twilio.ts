import type { FastifyInstance } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { activities } from '../db/schema/activities.js';
import { contacts } from '../db/schema/contacts.js';
import { buildDialTwiml, buildHangupTwiml } from '../services/twilio.js';

const voiceQuerySchema = z.object({ contactId: z.string().uuid() });

const recordingBodySchema = z.object({
  CallSid: z.string().min(1),
  RecordingUrl: z.string().url(),
  RecordingDuration: z.string().optional(),
});

const statusBodySchema = z.object({
  CallSid: z.string().min(1),
  CallStatus: z.string().optional(),
  CallDuration: z.string().optional(),
});

const smsBodySchema = z.object({
  MessageSid: z.string().min(1),
  From: z.string().min(1),
  To: z.string().min(1),
  Body: z.string().default(''),
});

export default async function twilioRoutes(app: FastifyInstance) {
  app.post('/twilio/voice-webhook', async (req, reply) => {
    const parsed = voiceQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      reply.header('content-type', 'text/xml');
      return reply.send(buildHangupTwiml());
    }
    const contact = await db.query.contacts.findFirst({
      where: eq(contacts.id, parsed.data.contactId),
      columns: { phone: true, doNotCall: true },
    });
    reply.header('content-type', 'text/xml');
    if (!contact || contact.doNotCall) {
      return reply.send(buildHangupTwiml());
    }
    return reply.send(buildDialTwiml(contact.phone));
  });

  app.post('/twilio/recording-webhook', async (req, reply) => {
    const parsed = recordingBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send();
    }
    const duration = parsed.data.RecordingDuration
      ? Number.parseInt(parsed.data.RecordingDuration, 10)
      : null;

    await db
      .update(activities)
      .set({
        recordingUrl: parsed.data.RecordingUrl,
        durationSeconds: Number.isFinite(duration) ? duration : null,
      })
      .where(eq(activities.twilioCallSid, parsed.data.CallSid));
    return reply.code(204).send();
  });

  app.post('/twilio/status-webhook', async (req, reply) => {
    const parsed = statusBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send();
    }
    if (parsed.data.CallDuration) {
      const duration = Number.parseInt(parsed.data.CallDuration, 10);
      if (Number.isFinite(duration)) {
        await db
          .update(activities)
          .set({ durationSeconds: duration })
          .where(eq(activities.twilioCallSid, parsed.data.CallSid));
      }
    }
    return reply.code(204).send();
  });

  app.post('/twilio/sms-webhook', async (req, reply) => {
    const parsed = smsBodySchema.safeParse(req.body);
    if (!parsed.success) {
      reply.header('content-type', 'text/xml');
      return reply.send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
    }

    const fromNumber = parsed.data.From.trim();
    const body = parsed.data.Body.trim();

    const contact = await db.query.contacts.findFirst({
      where: eq(contacts.phone, fromNumber),
      orderBy: [desc(contacts.updatedAt)],
    });

    if (body.toUpperCase() === 'STOP' && contact) {
      await db
        .update(contacts)
        .set({ doNotSms: true, updatedAt: new Date() })
        .where(eq(contacts.id, contact.id));
    }

    if (contact) {
      await db.insert(activities).values({
        contactId: contact.id,
        userId: null,
        type: 'sms',
        direction: 'inbound',
        body,
        twilioMessageSid: parsed.data.MessageSid,
      });
    }

    reply.header('content-type', 'text/xml');
    return reply.send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
  });

  app.post('/twilio/dispositions/:callSid', { preHandler: [app.authenticate] }, async (req, reply) => {
    const params = z.object({ callSid: z.string().min(1) }).safeParse(req.params);
    if (!params.success) {
      return reply
        .code(400)
        .send({ error: { message: 'Invalid call sid', code: 'VALIDATION' } });
    }
    const body = z
      .object({
        disposition: z.enum(['answered', 'voicemail', 'no_answer', 'busy', 'failed']),
        notes: z.string().optional(),
      })
      .safeParse(req.body);
    if (!body.success) {
      return reply
        .code(400)
        .send({ error: { message: body.error.message, code: 'VALIDATION' } });
    }

    const existing = await db.query.activities.findFirst({
      where: and(
        eq(activities.twilioCallSid, params.data.callSid),
        eq(activities.type, 'call'),
      ),
    });
    if (!existing) {
      return reply
        .code(404)
        .send({ error: { message: 'Call activity not found', code: 'NOT_FOUND' } });
    }

    const noteSegments = [`Disposition: ${body.data.disposition}`];
    if (body.data.notes && body.data.notes.trim()) {
      noteSegments.push(body.data.notes.trim());
    }
    const newBody = noteSegments.join('\n');

    const [updated] = await db
      .update(activities)
      .set({ body: newBody })
      .where(eq(activities.id, existing.id))
      .returning();

    return reply.send({ data: updated });
  });
}
