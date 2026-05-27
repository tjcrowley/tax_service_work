import { useQuery } from '@tanstack/react-query';
import { absoluteDate, initials, relativeTime } from '../lib/format';
import { fetchActivities, type Activity } from '../lib/activities';

type Props = {
  contactId: string;
};

export default function ActivityTimeline({ contactId }: Props) {
  const query = useQuery({
    queryKey: ['activities', contactId],
    queryFn: () => fetchActivities(contactId),
  });

  if (query.isLoading) {
    return <div className="text-sm text-slate-500 py-4 text-center">Loading timeline…</div>;
  }

  if (query.isError) {
    return (
      <div className="text-sm text-red-600 py-4 text-center">
        Could not load activities.
      </div>
    );
  }

  const items = query.data ?? [];

  if (items.length === 0) {
    return (
      <div className="text-sm text-slate-500 py-6 text-center">
        No activity yet. Log a note below to get started.
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.id}>
          <ActivityItem activity={item} />
        </li>
      ))}
    </ol>
  );
}

function ActivityItem({ activity }: { activity: Activity }) {
  switch (activity.type) {
    case 'note':
      return <NoteItem activity={activity} />;
    case 'stage_change':
      return <StageChangeItem activity={activity} />;
    case 'call':
      return <CallItem activity={activity} />;
    case 'sms':
      return <SmsItem activity={activity} />;
    case 'document':
      return <DocumentItem activity={activity} />;
    case 'task_complete':
      return <TaskCompleteItem activity={activity} />;
    case 'email':
      return <DefaultItem activity={activity} label="Email" />;
    default:
      return <DefaultItem activity={activity} label={activity.type} />;
  }
}

function Meta({ activity }: { activity: Activity }) {
  return (
    <span
      className="text-xs text-slate-500"
      title={absoluteDate(activity.createdAt)}
    >
      {activity.userName ?? 'System'} · {relativeTime(activity.createdAt)}
    </span>
  );
}

function NoteItem({ activity }: { activity: Activity }) {
  return (
    <div className="flex gap-3">
      <span className="h-8 w-8 flex-shrink-0 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold">
        {initials(activity.userName)}
      </span>
      <div className="flex-1">
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-slate-800 whitespace-pre-wrap">
          {activity.body}
        </div>
        <div className="mt-1">
          <Meta activity={activity} />
        </div>
      </div>
    </div>
  );
}

function StageChangeItem({ activity }: { activity: Activity }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
        Stage: {activity.body}
      </span>
      <Meta activity={activity} />
    </div>
  );
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function DirectionBadge({ direction }: { direction: 'inbound' | 'outbound' | null }) {
  if (!direction) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        direction === 'inbound'
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-sky-50 text-sky-700'
      }`}
    >
      {direction}
    </span>
  );
}

function CallItem({ activity }: { activity: Activity }) {
  return (
    <div className="flex gap-3">
      <span className="h-8 w-8 flex-shrink-0 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs">
        ☎
      </span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-800">Call</span>
          <DirectionBadge direction={activity.direction} />
          <span className="text-xs text-slate-500 tabular-nums">
            {formatDuration(activity.durationSeconds)}
          </span>
        </div>
        {activity.body && (
          <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{activity.body}</p>
        )}
        <div className="mt-1">
          <Meta activity={activity} />
        </div>
      </div>
    </div>
  );
}

function SmsItem({ activity }: { activity: Activity }) {
  return (
    <div className="flex gap-3">
      <span className="h-8 w-8 flex-shrink-0 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs">
        💬
      </span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-800">SMS</span>
          <DirectionBadge direction={activity.direction} />
        </div>
        {activity.body && (
          <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{activity.body}</p>
        )}
        <div className="mt-1">
          <Meta activity={activity} />
        </div>
      </div>
    </div>
  );
}

function DocumentItem({ activity }: { activity: Activity }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500">📎</span>
      <span className="text-sm text-slate-700">{activity.body ?? 'Document'}</span>
      <Meta activity={activity} />
    </div>
  );
}

function TaskCompleteItem({ activity }: { activity: Activity }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-emerald-600">✓</span>
      <span className="text-sm text-slate-700">{activity.body ?? 'Task complete'}</span>
      <Meta activity={activity} />
    </div>
  );
}

function DefaultItem({ activity, label }: { activity: Activity; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase text-slate-500">{label}</span>
      <span className="text-sm text-slate-700">{activity.body}</span>
      <Meta activity={activity} />
    </div>
  );
}
