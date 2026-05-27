import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CONTACT_STATUS_LABELS,
  fetchContact,
  fetchUsers,
  PIPELINE_LABELS,
} from '../lib/contacts';
import { formatCurrency, formatPhone, initials } from '../lib/format';
import ContactForm from '../components/ContactForm';
import ActivityTimeline from '../components/ActivityTimeline';
import LogNotePanel from '../components/LogNotePanel';
import TasksSidebar from '../components/TasksSidebar';
import CallButton from '../components/CallButton';
import SmsPanel from '../components/SmsPanel';
import DocumentsPanel from '../components/DocumentsPanel';

type TabKey = 'timeline' | 'sms' | 'tasks' | 'documents';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'timeline', label: 'Timeline' },
  { key: 'sms', label: 'SMS' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'documents', label: 'Documents' },
];

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<TabKey>('timeline');
  const [editOpen, setEditOpen] = useState(false);

  const contactQuery = useQuery({
    queryKey: ['contact', id],
    queryFn: () => (id ? fetchContact(id) : Promise.reject(new Error('Missing id'))),
    enabled: Boolean(id),
  });

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: fetchUsers });

  if (contactQuery.isLoading) {
    return <div className="p-6 text-sm text-slate-500">Loading…</div>;
  }
  if (contactQuery.isError || !contactQuery.data) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">Could not load contact.</p>
        <Link to="/contacts" className="text-sm text-brand-700 hover:underline">
          ← Back to contacts
        </Link>
      </div>
    );
  }

  const contact = contactQuery.data;
  const agent = contact.assignedTo
    ? usersQuery.data?.find((u) => u.id === contact.assignedTo)?.name ?? null
    : null;

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4">
        <Link to="/contacts" className="text-sm text-brand-700 hover:underline">
          ← Contacts
        </Link>
      </div>

      <header className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {contact.firstName} {contact.lastName}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <a href={`tel:${contact.phone}`} className="text-brand-700 hover:underline">
                {formatPhone(contact.phone)}
              </a>
              <CallButton
                contactId={contact.id}
                phone={contact.phone}
                disabled={contact.doNotCall}
              />
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="text-brand-700 hover:underline">
                  {contact.email}
                </a>
              )}
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                {CONTACT_STATUS_LABELS[contact.status]}
              </span>
              {contact.pipelineStage && (
                <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-800">
                  {PIPELINE_LABELS[contact.pipelineStage]}
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-3 text-sm text-slate-600">
              <span className="tabular-nums">
                Debt: <strong>{formatCurrency(contact.taxDebtAmount)}</strong>
              </span>
              {agent && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-6 w-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">
                    {initials(agent)}
                  </span>
                  {agent}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Edit
          </button>
        </div>
      </header>

      <div className="bg-white rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 px-2">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm border-b-2 -mb-px ${
                  tab === t.key
                    ? 'border-brand-600 text-brand-700 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {tab === 'timeline' && (
            <div>
              <ActivityTimeline contactId={contact.id} />
              <LogNotePanel contactId={contact.id} />
            </div>
          )}
          {tab === 'sms' && (
            <SmsPanel contactId={contact.id} disabled={contact.doNotSms} />
          )}
          {tab === 'tasks' && <TasksSidebar contactId={contact.id} />}
          {tab === 'documents' && <DocumentsPanel contactId={contact.id} />}
        </div>
      </div>

      <ContactForm open={editOpen} onClose={() => setEditOpen(false)} contact={contact} />
    </div>
  );
}
