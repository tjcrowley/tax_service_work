import { z } from 'zod';

export const taskPriority = z.enum(['high', 'normal', 'low']);
export type TaskPriority = z.infer<typeof taskPriority>;

export const taskSchema = z.object({
  id: z.string().uuid(),
  contactId: z.string().uuid(),
  assignedTo: z.string().uuid().nullable(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.coerce.date(),
  dueAt: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
  title: z.string().min(1),
  description: z.string().nullable(),
  priority: taskPriority,
});
export type Task = z.infer<typeof taskSchema>;

export const createTaskSchema = taskSchema
  .omit({ id: true, createdAt: true, completedAt: true })
  .partial({
    assignedTo: true,
    createdBy: true,
    dueAt: true,
    description: true,
    priority: true,
  });
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = createTaskSchema.partial().extend({
  completedAt: z.coerce.date().nullable().optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
