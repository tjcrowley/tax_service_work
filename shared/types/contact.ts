import { z } from 'zod';

export const contactStatus = z.enum([
  'lead',
  'prospect',
  'client',
  'resolved',
  'lost',
]);
export type ContactStatus = z.infer<typeof contactStatus>;

export const pipelineStage = z.enum([
  'new',
  'contacted',
  'qualified',
  'proposal',
  'negotiating',
  'resolution',
  'closed',
]);
export type PipelineStage = z.infer<typeof pipelineStage>;

export const irsIssueType = z.enum([
  'wage_garnishment',
  'bank_levy',
  'lien',
  'back_taxes',
  'unfiled_returns',
  'other',
]);
export type IrsIssueType = z.infer<typeof irsIssueType>;

export const contactSource = z.enum([
  'website',
  'purchased_list',
  'referral',
  'social',
  'other',
]);
export type ContactSource = z.infer<typeof contactSource>;

const e164 = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, 'Phone must be E.164 format (e.g. +15551234567)');

export const contactSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),

  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().nullable(),
  phone: e164,

  taxDebtAmount: z.number().nonnegative().nullable(),
  taxYears: z.array(z.string()).nullable(),
  irsIssueType: irsIssueType.nullable(),

  status: contactStatus,
  pipelineStage: pipelineStage.nullable(),
  assignedTo: z.string().uuid().nullable(),
  source: contactSource.nullable(),
  sourceDetail: z.string().nullable(),

  city: z.string().nullable(),
  state: z.string().length(2).nullable(),
  zip: z.string().nullable(),

  isDuplicate: z.boolean(),
  doNotCall: z.boolean(),
  doNotSms: z.boolean(),
});
export type Contact = z.infer<typeof contactSchema>;

export const createContactSchema = contactSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isDuplicate: true,
  doNotCall: true,
  doNotSms: true,
}).extend({
  isDuplicate: z.boolean().optional(),
  doNotCall: z.boolean().optional(),
  doNotSms: z.boolean().optional(),
});
export type CreateContactInput = z.infer<typeof createContactSchema>;

export const updateContactSchema = createContactSchema.partial();
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
