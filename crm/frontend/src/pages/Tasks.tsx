import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { absoluteDate, relativeTime } from '../lib/format';
import {
  PRIORITY_CLASSES,
  PRIORITY_LABELS,
  fetchMyTasks,
  updateTask,
  type TaskWithContext,
} from '../lib/tasks';

export default function TasksPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [all, setAll] = useState(false);

  const tasksQuery = useQuery({
    queryKey: ['my-tasks', { all }],
    queryFn: () => fetchMyTasks(all),
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => updateTask(id, { completedAt: new Date().toISOString() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      qc.invalidateQueries({ queryKey: ['contact-tasks'] });
      qc.invalidateQueries({ queryKey: ['activities'] });
    },
  });

  const buckets = tasksQuery.data ?? { overdue: [], today: [], upcoming: [] };
  const isAdmin = user?.role === 'admin';

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">My Tasks</h1>
          <p className="text-sm text-slate-500">
            {(buckets.overdue.length + buckets.today.length + buckets.upcoming.length)} open
          </p>
        </div>
        {isAdmin && (
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={all}
              onChange={(e) => setAll(e.target.checked)}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Show all agents
          </label>
        )}
      </div>

      {tasksQuery.isLoading && (
        <p className="text-sm text-slate-500 text-center py-8">Loading…</p>
      )}

      {!tasksQuery.isLoading && (
        <div className="space-y-6">
          <Section
            title="Overdue"
            accent="text-red-600"
            items={buckets.overdue}
            onComplete={(id) => completeMutation.mutate(id)}
            isOverdue
          />
          <Section
            title="Today"
            accent="text-slate-800"
            items={buckets.today}
            onComplete={(id) => completeMutation.mutate(id)}
          />
          <Section
            title="Upcoming"
            accent="text-slate-800"
            items={buckets.upcoming}
            onComplete={(id) => completeMutation.mutate(id)}
          />
          {buckets.overdue.length === 0 &&
            buckets.today.length === 0 &&
            buckets.upcoming.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">
                No open tasks. Nice work.
              </p>
            )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  accent,
  items,
  onComplete,
  isOverdue,
}: {
  title: string;
  accent: string;
  items: TaskWithContext[];
  onComplete: (id: string) => void;
  isOverdue?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className={`text-sm font-semibold uppercase tracking-wide mb-2 ${accent}`}>
        {title} ({items.length})
      </h2>
      <ul className="space-y-2">
        {items.map((t) => (
          <li
            key={t.id}
            className={`rounded-md border p-3 bg-white ${
              isOverdue ? 'border-red-200' : 'border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{t.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {t.dueAt && (
                    <span
                      title={absoluteDate(t.dueAt)}
                      className={isOverdue ? 'text-red-600 font-medium' : ''}
                    >
                      {relativeTime(t.dueAt)}
                    </span>
                  )}
                  {t.assigneeName && <span>· {t.assigneeName}</span>}
                  {t.contactFirstName && (
                    <Link
                      to={`/contacts/${t.contactId}`}
                      className="text-brand-700 hover:underline"
                    >
                      {t.contactFirstName} {t.contactLastName}
                    </Link>
                  )}
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${
                      PRIORITY_CLASSES[t.priority]
                    }`}
                  >
                    {PRIORITY_LABELS[t.priority]}
                  </span>
                </div>
                {t.description && (
                  <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{t.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onComplete(t.id)}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
              >
                Complete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
