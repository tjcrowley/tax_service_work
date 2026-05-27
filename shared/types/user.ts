import { z } from 'zod';

export const userRole = z.enum(['admin', 'agent', 'viewer']);
export type UserRole = z.infer<typeof userRole>;

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  role: userRole,
  phone: z.string().nullable(),
  twilioWorkerSid: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
});
export type User = z.infer<typeof userSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const inviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: userRole,
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
