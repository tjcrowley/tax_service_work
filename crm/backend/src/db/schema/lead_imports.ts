import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const leadImports = pgTable('lead_imports', {
  id: uuid('id').primaryKey().defaultRandom(),
  uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  filename: text('filename'),
  rowCount: integer('row_count'),
  importedCount: integer('imported_count'),
  duplicateCount: integer('duplicate_count'),
  errorCount: integer('error_count'),
  status: text('status', { enum: ['processing', 'complete', 'failed'] }).notNull(),
});

export type LeadImportRow = typeof leadImports.$inferSelect;
export type NewLeadImportRow = typeof leadImports.$inferInsert;
