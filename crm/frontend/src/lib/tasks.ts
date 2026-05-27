import { api } from './api';

export type TaskPriority = 'high' | 'normal' | 'low';

export type Task = {
  id: string;
  contactId: string;
  assignedTo: string | null;
  createdBy: string | null;
  createdAt: string;
  dueAt: string | null;
  completedAt: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
};

export type TaskWithContext = Task & {
  contactFirstName: string | null;
  contactLastName: string | null;
  assigneeName: string | null;
};

export type TaskBuckets = {
  overdue: TaskWithContext[];
  today: TaskWithContext[];
  upcoming: TaskWithContext[];
};

export type TaskInput = {
  title: string;
  description?: string | null;
  dueAt?: string | null;
  assignedTo?: string | null;
  priority?: TaskPriority;
};

export async function fetchContactTasks(contactId: string): Promise<Task[]> {
  const resp = await api.get<{ data: Task[] }>(`/contacts/${contactId}/tasks`);
  return resp.data.data;
}

export async function createTask(contactId: string, input: TaskInput): Promise<Task> {
  const resp = await api.post<{ data: Task }>(`/contacts/${contactId}/tasks`, input);
  return resp.data.data;
}

export async function updateTask(
  id: string,
  patch: Partial<TaskInput> & { completedAt?: string | null },
): Promise<Task> {
  const resp = await api.patch<{ data: Task }>(`/tasks/${id}`, patch);
  return resp.data.data;
}

export async function deleteTask(id: string): Promise<{ id: string }> {
  const resp = await api.delete<{ data: { id: string } }>(`/tasks/${id}`);
  return resp.data.data;
}

export async function fetchMyTasks(all = false): Promise<TaskBuckets> {
  const resp = await api.get<{ data: TaskBuckets }>('/tasks', {
    params: all ? { all: 'true' } : undefined,
  });
  return resp.data.data;
}

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: 'High',
  normal: 'Normal',
  low: 'Low',
};

export const PRIORITY_CLASSES: Record<TaskPriority, string> = {
  high: 'bg-red-100 text-red-700',
  normal: 'bg-slate-100 text-slate-700',
  low: 'bg-slate-50 text-slate-500',
};
