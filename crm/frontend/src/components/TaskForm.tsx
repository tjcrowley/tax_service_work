import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchUsers } from '../lib/contacts';
import { createTask, PRIORITY_LABELS, type TaskPriority } from '../lib/tasks';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  dueAt: z.string().optional(),
  assignedTo: z.string().optional(),
  priority: z.enum(['high', 'normal', 'low']),
});

type FormValues = z.infer<typeof formSchema>;

type Props = {
  open: boolean;
  onClose: () => void;
  contactId: string;
};

export default function TaskForm({ open, onClose, contactId }: Props) {
  const qc = useQueryClient();
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: fetchUsers });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: '', description: '', dueAt: '', assignedTo: '', priority: 'normal' },
  });

  useEffect(() => {
    if (open) reset({ title: '', description: '', dueAt: '', assignedTo: '', priority: 'normal' });
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (v: FormValues) =>
      createTask(contactId, {
        title: v.title,
        description: v.description || null,
        dueAt: v.dueAt ? new Date(v.dueAt).toISOString() : null,
        assignedTo: v.assignedTo || null,
        priority: v.priority as TaskPriority,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact-tasks', contactId] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <form
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
        className="w-full max-w-md bg-white rounded-lg shadow-lg flex flex-col"
      >
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">New task</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-4 space-y-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-700 mb-1">Title</span>
            <input
              {...register('title')}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            {errors.title && (
              <span className="block text-xs text-red-600 mt-1">{errors.title.message}</span>
            )}
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-700 mb-1">Description</span>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-700 mb-1">Due</span>
              <input
                type="datetime-local"
                {...register('dueAt')}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-700 mb-1">Priority</span>
              <select
                {...register('priority')}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="block text-xs font-medium text-slate-700 mb-1">Assignee</span>
            <select
              {...register('assignedTo')}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">— Me —</option>
              {usersQuery.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          {mutation.isError && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {(mutation.error as Error).message}
            </div>
          )}
        </div>
        <div className="border-t border-slate-200 p-3 flex justify-end gap-2 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || mutation.isPending}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Create task
          </button>
        </div>
      </form>
    </div>
  );
}
