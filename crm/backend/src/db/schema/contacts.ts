import {
  boolean,
  char,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone').notNull(),

  taxDebtAmount: numeric('tax_debt_amount', { precision: 12, scale: 2 }),
  taxYears: text('tax_years').array(),
  irsIssueType: text('irs_issue_type', {
    enum: [
      'wage_garnishment',
      'bank_levy',
      'lien',
      'back_taxes',
      'unfiled_returns',
      'other',
    ],
  }),

  status: text('status', {
    enum: ['lead', 'prospect', 'client', 'resolved', 'lost'],
  }).notNull(),
  pipelineStage: text('pipeline_stage', {
    enum: [
      'new',
      'contacted',
      'qualified',
      'proposal',
      'negotiating',
      'resolution',
      'closed',
    ],
  }),
  assignedTo: uuid('assigned_to').references(() => users.id, {
    onDelete: 'set null',
  }),
  source: text('source', {
    enum: ['website', 'purchased_list', 'referral', 'social', 'other'],
  }),
  sourceDetail: text('source_detail'),

  city: text('city'),
  state: char('state', { length: 2 }),
  zip: text('zip'),

  isDuplicate: boolean('is_duplicate').notNull().default(false),
  doNotCall: boolean('do_not_call').notNull().default(false),
  doNotSms: boolean('do_not_sms').notNull().default(false),
});

export type ContactRow = typeof contacts.$inferSelect;
export type NewContactRow = typeof contacts.$inferInsert;
