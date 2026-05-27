import { z } from 'zod';

export const activityType = z.enum([
  'call',
  'sms',
  'email',
  'note',
  'stage_change',
  'document',
  'task_complete',
]);
export type ActivityType = z.infer<typeof activityType>;

export const activityDirection = z.enum(['inbound', 'outbound']);
export type ActivityDirection = z.infer<typeof activityDirection>;

export const activitySchema = z.object({
  id: z.string().uuid(),
  contactId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  createdAt: z.coerce.date(),
  type: activityType,
  direction: activityDirection.nullable(),
  durationSeconds: z.number().int().nonnegative().nullable(),
  body: z.string().nullable(),
  twilioCallSid: z.string().nullable(),
  twilioMessageSid: z.string().nullable(),
  recordingUrl: z.string().url().nullable(),
});
export type Activity = z.infer<typeof activitySchema>;

export const createActivitySchema = activitySchema
  .omit({ id: true, createdAt: true })
  .partial({
    userId: true,
    direction: true,
    durationSeconds: true,
    body: true,
    twilioCallSid: true,
    twilioMessageSid: true,
    recordingUrl: true,
  });
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
