import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const cannedResponses = pgTable('canned_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  label: text('label').notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
export type CannedResponseRow = typeof cannedResponses.$inferSelect;
export type NewCannedResponseRow = typeof cannedResponses.$inferInsert;

export const leadSources = pgTable('lead_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  label: text('label').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export type LeadSourceRow = typeof leadSources.$inferSelect;
export type NewLeadSourceRow = typeof leadSources.$inferInsert;

export const userInvites = pgTable('user_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  role: text('role', { enum: ['admin', 'agent', 'viewer'] }).notNull(),
  token: text('token').notNull().unique(),
  invitedBy: uuid('invited_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
});
export type UserInviteRow = typeof userInvites.$inferSelect;
export type NewUserInviteRow = typeof userInvites.$inferInsert;
