import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { leadImports } from '../db/schema/lead_imports.js';
import {
  buildErrorReportCsv,
  CANONICAL_FIELD_LIST,
  guessMapping,
  parseCsv,
  processImport,
  type CanonicalField,
  type ImportMapping,
  type ImportRowError,
} from '../services/imports.js';

const idParam = z.object({ id: z.string().uuid() });
const previewSchema = z.object({ csv: z.string().min(1) });

const errorReports = new Map<string, ImportRowError[]>();

export default async function importRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.post('/imports/preview', async (req, reply) => {
    const parsed = previewSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { message: parsed.error.message, code: 'VALIDATION' } });
    }
    const result = parseCsv(parsed.data.csv);
    const headers = result.meta?.fields ?? [];
    const rows = result.data ?? [];
    return reply.send({
      data: {
        headers,
        sampleRows: rows.slice(0, 10),
        totalRows: rows.length,
        suggestedMapping: guessMapping(headers),
        fields: CANONICAL_FIELD_LIST,
      },
    });
  });

  app.post('/imports', async (req, reply) => {
    const body = z
      .object({
        filename: z.string().min(1),
        csv: z.string().min(1),
        mapping: z.record(z.string()),
      })
      .safeParse(req.body);
    if (!body.success) {
      return reply
        .code(400)
        .send({ error: { message: body.error.message, code: 'VALIDATION' } });
    }

    const mapping: ImportMapping = {};
    for (const [k, v] of Object.entries(body.data.mapping)) {
      if (CANONICAL_FIELD_LIST.includes(k as CanonicalField) && typeof v === 'string' && v) {
        mapping[k as CanonicalField] = v;
      }
    }
    if (!mapping.firstName || !mapping.lastName || !mapping.phone) {
      return reply
        .code(400)
        .send({
          error: {
            message: 'Mapping must include firstName, lastName, phone',
            code: 'VALIDATION',
          },
        });
    }

    const [row] = await db
      .insert(leadImports)
      .values({
        uploadedBy: req.user.sub,
        filename: body.data.filename,
        status: 'processing',
      })
      .returning();

    if (!row) {
      return reply
        .code(500)
        .send({ error: { message: 'Failed to create import record', code: 'INTERNAL' } });
    }

    const importId = row.id;
    setImmediate(async () => {
      try {
        const result = await processImport(importId, body.data.csv, mapping);
        errorReports.set(importId, result.errors);
      } catch (err) {
        req.log.error({ err }, 'Import processing failed');
        await db
          .update(leadImports)
          .set({ status: 'failed' })
          .where(eq(leadImports.id, importId));
      }
    });

    return reply.code(202).send({ data: row });
  });

  app.get('/imports', async (_req, reply) => {
    const rows = await db.select().from(leadImports).orderBy(leadImports.uploadedAt);
    return reply.send({ data: rows.reverse() });
  });

  app.get('/imports/:id', async (req, reply) => {
    const params = idParam.safeParse(req.params);
    if (!params.success) {
      return reply
        .code(400)
        .send({ error: { message: 'Invalid import id', code: 'VALIDATION' } });
    }
    const row = await db.query.leadImports.findFirst({
      where: eq(leadImports.id, params.data.id),
    });
    if (!row) {
      return reply
        .code(404)
        .send({ error: { message: 'Import not found', code: 'NOT_FOUND' } });
    }
    return reply.send({ data: row });
  });

  app.get('/imports/:id/errors.csv', async (req, reply) => {
    const params = idParam.safeParse(req.params);
    if (!params.success) {
      return reply
        .code(400)
        .send({ error: { message: 'Invalid import id', code: 'VALIDATION' } });
    }
    const errors = errorReports.get(params.data.id) ?? [];
    reply.header('content-type', 'text/csv');
    reply.header('content-disposition', `attachment; filename="import-${params.data.id}-errors.csv"`);
    return reply.send(buildErrorReportCsv(errors));
  });
}
