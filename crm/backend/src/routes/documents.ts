import type { FastifyInstance } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { db } from '../db/index.js';
import { documents } from '../db/schema/documents.js';
import { contacts } from '../db/schema/contacts.js';
import { activities } from '../db/schema/activities.js';
import { users } from '../db/schema/users.js';
import {
  getSignedDownloadUrl,
  isSpacesConfigured,
  uploadObject,
} from '../services/spaces.js';

const idParam = z.object({ id: z.string().uuid() });
const docParam = z.object({ id: z.string().uuid(), docId: z.string().uuid() });

const category = z.enum(['irs_notice', 'poa', 'tax_return', 'correspondence', 'other']);

const MAX_BYTES = 25 * 1024 * 1024;

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 200);
}

export default async function documentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/contacts/:id/documents', async (req, reply) => {
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
        id: documents.id,
        contactId: documents.contactId,
        uploadedBy: documents.uploadedBy,
        uploadedAt: documents.uploadedAt,
        filename: documents.filename,
        mimeType: documents.mimeType,
        sizeBytes: documents.sizeBytes,
        category: documents.category,
        notes: documents.notes,
        uploaderName: users.name,
      })
      .from(documents)
      .leftJoin(users, eq(documents.uploadedBy, users.id))
      .where(eq(documents.contactId, params.data.id))
      .orderBy(desc(documents.uploadedAt));
    return reply.send({ data: rows });
  });

  app.post('/contacts/:id/documents', async (req, reply) => {
    const params = idParam.safeParse(req.params);
    if (!params.success) {
      return reply
        .code(400)
        .send({ error: { message: 'Invalid contact id', code: 'VALIDATION' } });
    }

    if (!req.isMultipart()) {
      return reply
        .code(400)
        .send({ error: { message: 'Expected multipart/form-data', code: 'VALIDATION' } });
    }

    if (!isSpacesConfigured()) {
      return reply
        .code(503)
        .send({ error: { message: 'Document storage is not configured', code: 'SPACES_UNAVAILABLE' } });
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

    const file = await req.file();
    if (!file) {
      return reply
        .code(400)
        .send({ error: { message: 'No file uploaded', code: 'VALIDATION' } });
    }

    const fieldCategory = file.fields?.category;
    let categoryValue: z.infer<typeof category> | null = null;
    if (fieldCategory && 'value' in fieldCategory && typeof fieldCategory.value === 'string') {
      const parsed = category.safeParse(fieldCategory.value);
      if (parsed.success) categoryValue = parsed.data;
    }

    let notesValue: string | null = null;
    const fieldNotes = file.fields?.notes;
    if (fieldNotes && 'value' in fieldNotes && typeof fieldNotes.value === 'string') {
      notesValue = fieldNotes.value.slice(0, 1000);
    }

    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of file.file) {
      total += chunk.length;
      if (total > MAX_BYTES) {
        return reply
          .code(413)
          .send({ error: { message: 'File exceeds 25MB limit', code: 'TOO_LARGE' } });
      }
      chunks.push(Buffer.from(chunk));
    }
    if (file.file.truncated) {
      return reply
        .code(413)
        .send({ error: { message: 'File exceeds 25MB limit', code: 'TOO_LARGE' } });
    }

    const buffer = Buffer.concat(chunks);
    const safeName = safeFilename(file.filename || 'upload');
    const key = `contacts/${params.data.id}/${randomUUID()}-${safeName}`;
    const mimeType = file.mimetype || 'application/octet-stream';

    try {
      await uploadObject({ key, body: buffer, contentType: mimeType });
    } catch (err) {
      req.log.error({ err }, 'Spaces upload failed');
      return reply
        .code(502)
        .send({ error: { message: 'Failed to upload document', code: 'SPACES_ERROR' } });
    }

    const [row] = await db
      .insert(documents)
      .values({
        contactId: params.data.id,
        uploadedBy: req.user.sub,
        filename: file.filename || safeName,
        mimeType,
        sizeBytes: buffer.length,
        spacesKey: key,
        category: categoryValue,
        notes: notesValue,
      })
      .returning();

    await db.insert(activities).values({
      contactId: params.data.id,
      userId: req.user.sub,
      type: 'document',
      body: file.filename || safeName,
    });

    return reply.code(201).send({ data: row });
  });

  app.get('/contacts/:id/documents/:docId/download', async (req, reply) => {
    const params = docParam.safeParse(req.params);
    if (!params.success) {
      return reply
        .code(400)
        .send({ error: { message: 'Invalid id', code: 'VALIDATION' } });
    }
    const row = await db.query.documents.findFirst({
      where: and(
        eq(documents.id, params.data.docId),
        eq(documents.contactId, params.data.id),
      ),
    });
    if (!row) {
      return reply
        .code(404)
        .send({ error: { message: 'Document not found', code: 'NOT_FOUND' } });
    }
    if (!isSpacesConfigured()) {
      return reply
        .code(503)
        .send({ error: { message: 'Document storage is not configured', code: 'SPACES_UNAVAILABLE' } });
    }
    try {
      const url = await getSignedDownloadUrl(row.spacesKey, 900);
      return reply.send({ data: { url, expiresIn: 900, filename: row.filename } });
    } catch (err) {
      req.log.error({ err }, 'Spaces sign failed');
      return reply
        .code(502)
        .send({ error: { message: 'Failed to sign URL', code: 'SPACES_ERROR' } });
    }
  });
}
