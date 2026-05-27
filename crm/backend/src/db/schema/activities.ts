import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { contacts } from './contacts.js';
import { users } from './users.js';

export const activities = pgTable('activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  contactId: uuid('contact_id')
    .notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

  type: text('type', {
    enum: ['call', 'sms', 'email', 'note', 'stage_change', 'document', 'task_complete'],
  }).notNull(),
  direction: text('direction', { enum: ['inbound', 'outbound'] }),
  durationSeconds: integer('duration_seconds'),
  body: text('body'),
  twilioCallSid: text('twilio_call_sid'),
  twilioMessageSid: text('twilio_message_sid'),
  recordingUrl: text('recording_url'),
});

export type ActivityRow = typeof activities.$inferSelect;
export type NewActivityRow = typeof activities.$inferInsert;
