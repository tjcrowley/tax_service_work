import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  contactSource,
  contactStatus,
  irsIssueType,
  pipelineStage,
} from '@tax/shared/types/contact';
import {
  createContact,
  getContact,
  listContacts,
  softDeleteContact,
  updateContact,
  type UpdateContactPatch,
} from '../services/contacts.js';
import type { NewContactRow } from '../db/schema/contacts.js';

const e164 = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, 'Phone must be E.164 format (e.g. +15551234567)');

const listQuerySchema = z.object({
  status: contactStatus.optional(),
  stage: pipelineStage.optional(),
  assigned_to: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const createSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: e164,
  email: z.string().email().nullable().optional(),
  taxDebtAmount: z.union([z.number().nonnegative(), z.string()]).nullable().optional(),
  taxYears: z.array(z.string()).nullable().optional(),
  irsIssueType: irsIssueType.nullable().optional(),
  status: contactStatus.default('lead'),
  pipelineStage: pipelineStage.nullable().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  source: contactSource.nullable().optional(),
  sourceDetail: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().length(2).nullable().optional(),
  zip: z.string().nullable().optional(),
  doNotCall: z.boolean().optional(),
  doNotSms: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

function toRow(input: z.infer<typeof createSchema>): NewContactRow {
  const { taxDebtAmount, ...rest } = input;
  return {
    ...rest,
    taxDebtAmount:
      taxDebtAmount === undefined || taxDebtAmount === null
        ? null
        : typeof taxDebtAmount === 'number'
          ? taxDebtAmount.toFixed(2)
          : taxDebtAmount,
  } as NewContactRow;
}

function toPatch(input: z.infer<typeof updateSchema>): UpdateContactPatch {
  const { taxDebtAmount, ...rest } = input;
  const patch: UpdateContactPatch = { ...(rest as UpdateContactPatch) };
  if (taxDebtAmount !== undefined) {
    patch.taxDebtAmount =
      taxDebtAmount === null
        ? null
        : typeof taxDebtAmount === 'number'
          ? taxDebtAmount.toFixed(2)
          : taxDebtAmount;
  }
  return patch;
}

export default async function contactRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/contacts', async (req, reply) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { message: 'Invalid query params', code: 'VALIDATION' } });
    }
    const result = await listContacts({
      status: parsed.data.status,
      stage: parsed.data.stage,
      assignedTo: parsed.data.assigned_to,
      search: parsed.data.search,
      page: parsed.data.page,
      limit: parsed.data.limit,
    });
    return reply.send({ data: result });
  });

  app.post('/contacts', async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { message: parsed.error.message, code: 'VALIDATION' } });
    }
    const row = await createContact(toRow(parsed.data));
    return reply.code(201).send({ data: row });
  });

  app.get('/contacts/:id', async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(req.params);
    if (!params.success) {
      return reply
        .code(400)
        .send({ error: { message: 'Invalid contact id', code: 'VALIDATION' } });
    }
    const row = await getContact(params.data.id);
    if (!row) {
      return reply
        .code(404)
        .send({ error: { message: 'Contact not found', code: 'NOT_FOUND' } });
    }
    return reply.send({ data: row });
  });

  app.patch('/contacts/:id', async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(req.params);
    if (!params.success) {
      return reply
        .code(400)
        .send({ error: { message: 'Invalid contact id', code: 'VALIDATION' } });
    }
    const body = updateSchema.safeParse(req.body);
    if (!body.success) {
      return reply
        .code(400)
        .send({ error: { message: body.error.message, code: 'VALIDATION' } });
    }
    const updated = await updateContact(params.data.id, toPatch(body.data), req.user.sub);
    if (!updated) {
      return reply
        .code(404)
        .send({ error: { message: 'Contact not found', code: 'NOT_FOUND' } });
    }
    return reply.send({ data: updated });
  });

  app.delete('/contacts/:id', async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(req.params);
    if (!params.success) {
      return reply
        .code(400)
        .send({ error: { message: 'Invalid contact id', code: 'VALIDATION' } });
    }
    const updated = await softDeleteContact(params.data.id);
    if (!updated) {
      return reply
        .code(404)
        .send({ error: { message: 'Contact not found', code: 'NOT_FOUND' } });
    }
    return reply.send({ data: updated });
  });
}
