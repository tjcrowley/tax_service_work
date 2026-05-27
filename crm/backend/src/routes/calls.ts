import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { contacts } from '../db/schema/contacts.js';
import { activities } from '../db/schema/activities.js';
import { users } from '../db/schema/users.js';
import {
  createOutboundCall,
  isTwilioConfigured,
} from '../services/twilio.js';

const bodySchema = z.object({
  contactId: z.string().uuid(),
});

function backendBaseUrl(req: { protocol: string; hostname: string }): string {
  const envUrl = process.env.BACKEND_PUBLIC_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  return `${req.protocol}://${req.hostname}`;
}

export default async function callRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.post('/calls/outbound', async (req, reply) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { message: parsed.error.message, code: 'VALIDATION' } });
    }

    if (!isTwilioConfigured()) {
      return reply
        .code(503)
        .send({ error: { message: 'Twilio is not configured', code: 'TWILIO_UNAVAILABLE' } });
    }

    const contact = await db.query.contacts.findFirst({
      where: eq(contacts.id, parsed.data.contactId),
    });
    if (!contact) {
      return reply
        .code(404)
        .send({ error: { message: 'Contact not found', code: 'NOT_FOUND' } });
    }
    if (contact.doNotCall) {
      return reply
        .code(409)
        .send({ error: { message: 'Contact is marked do-not-call', code: 'DO_NOT_CALL' } });
    }

    const agent = await db.query.users.findFirst({ where: eq(users.id, req.user.sub) });
    const agentPhone = agent?.phone ?? null;

    const baseUrl = backendBaseUrl(req);
    const voiceWebhookUrl = `${baseUrl}/twilio/voice-webhook?contactId=${contact.id}`;
    const recordingWebhookUrl = `${baseUrl}/twilio/recording-webhook`;
    const statusCallbackUrl = `${baseUrl}/twilio/status-webhook`;

    let result: { sid: string };
    try {
      result = await createOutboundCall({
        to: contact.phone,
        agentPhone,
        voiceWebhookUrl,
        recordingWebhookUrl,
        statusCallbackUrl,
      });
    } catch (err) {
      req.log.error({ err }, 'Twilio call create failed');
      return reply
        .code(502)
        .send({ error: { message: 'Failed to create call', code: 'TWILIO_ERROR' } });
    }

    const [activity] = await db
      .insert(activities)
      .values({
        contactId: contact.id,
        userId: req.user.sub,
        type: 'call',
        direction: 'outbound',
        twilioCallSid: result.sid,
      })
      .returning();

    return reply.code(201).send({ data: { callSid: result.sid, activity } });
  });
}
