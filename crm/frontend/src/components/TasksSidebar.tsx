import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { absoluteDate, relativeTime } from '../lib/format';
import { fetchUsers } from '../lib/contacts';
import {
  PRIORITY_CLASSES,
  PRIORITY_LABELS,
  fetchContactTasks,
  updateTask,
  type Task,
} from '../lib/tasks';
import TaskForm from './TaskForm';

type Props = {
  contactId: string;
};

type Bucket = { key: 'overdue' | 'today' | 'upcoming'; label: string; accent: string };

const BUCKETS: Bucket[] = [
  { key: 'overdue', label: 'Overdue', accent: 'text-red-600' },
  { key: 'today', label: 'Today', accent: 'text-slate-700' },
  { key: 'upcoming', label: 'Upcoming', accent: 'text-slate-700' },
];

function bucket(task: Task): Bucket['key'] {
  if (!task.dueAt) return 'upcoming';
  const due = new Date(task.dueAt).getTime();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  if (due < todayStart.getTime()) return 'overdue';
  if (due <= todayEnd.getTime()) return 'today';
  return 'upcoming';
}

export default function TasksSidebar({ contactId }: Props) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);

  const tasksQuery = useQuery({
    queryKey: ['contact-tasks', contactId],
    queryFn: () => fetchContactTasks(contactId),
  });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: fetchUsers });

  const userMap = useMemo(() => {
    const m = new Map<string, string>();
    usersQuery.data?.forEach((u) => m.set(u.id, u.name));
    return m;
  }, [usersQuery.data]);

  const completeMutation = useMutation({
    mutationFn: (id: string) => updateTask(id, { completedAt: new Date().toISOString() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact-tasks', contactId] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      qc.invalidateQueries({ queryKey: ['activities', contactId] });
    },
  });

  const open = (tasksQuery.data ?? []).filter((t) => !t.completedAt);
  const grouped: Record<Bucket['key'], Task[]> = { overdue: [], today: [], upcoming: [] };
  open.forEach((t) => grouped[bucket(t)].push(t));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Open tasks
        </h2>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="rounded-md bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700"
        >
          + New task
        </button>
      </div>

      {tasksQuery.isLoading && (
        <p className="text-sm text-slate-500 text-center py-4">Loading tasks…</p>
      )}

      {!tasksQuery.isLoading && open.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-6">No open tasks for this contact.</p>
      )}

      <div className="space-y-4">
        {BUCKETS.map((b) => {
          const items = grouped[b.key];
          if (items.length === 0) return null;
          return (
            <section key={b.key}>
              <h3 className={`text-xs font-semibold mb-2 ${b.accent}`}>
                {b.label} ({items.length})
              </h3>
              <ul className="space-y-2">
                {items.map((t) => (
                  <li
                    key={t.id}
                    className={`rounded-md border p-3 bg-white ${
                      b.key === 'overdue' ? 'border-red-200' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{t.title}</p>
                        {t.description && (
                          <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-wrap">
                            {t.description}
                          </p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          {t.dueAt && (
                            <span
                              title={absoluteDate(t.dueAt)}
                              className={b.key === 'overdue' ? 'text-red-600 font-medium' : ''}
                            >
                              {relativeTime(t.dueAt)}
                            </span>
                          )}
                          {t.assignedTo && (
                            <span>
                              · {userMap.get(t.assignedTo) ?? 'Unknown'}
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${
                              PRIORITY_CLASSES[t.priority]
                            }`}
                          >
                            {PRIORITY_LABELS[t.priority]}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => completeMutation.mutate(t.id)}
                        disabled={completeMutation.isPending}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Complete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <TaskForm open={formOpen} onClose={() => setFormOpen(false)} contactId={contactId} />
    </div>
  );
}
