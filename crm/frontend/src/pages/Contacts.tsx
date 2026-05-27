import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  CONTACT_STATUSES,
  CONTACT_STATUS_LABELS,
  PIPELINE_LABELS,
  PIPELINE_STAGES,
  fetchContacts,
  fetchUsers,
  type Contact,
  type ContactStatus,
  type PipelineStage,
} from '../lib/contacts';
import { formatCurrency, formatPhone, initials, relativeTime } from '../lib/format';
import ContactForm from '../components/ContactForm';

const columnHelper = createColumnHelper<Contact>();

export default function Contacts() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ContactStatus | ''>('');
  const [stage, setStage] = useState<PipelineStage | ''>('');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const limit = 25;

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: fetchUsers });

  const contactsQuery = useQuery({
    queryKey: ['contacts', { search, status, stage, assignedTo, page, limit }],
    queryFn: () =>
      fetchContacts({
        search: search || undefined,
        status: status || undefined,
        stage: stage || undefined,
        assigned_to: assignedTo || undefined,
        page,
        limit,
      }),
  });

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    usersQuery.data?.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [usersQuery.data]);

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'name',
        header: 'Name',
        cell: (info) => {
          const c = info.row.original;
          return (
            <Link
              to={`/contacts/${c.id}`}
              className="text-brand-700 font-medium hover:underline"
            >
              {c.firstName} {c.lastName}
            </Link>
          );
        },
      }),
      columnHelper.accessor('phone', {
        header: 'Phone',
        cell: (info) => <span className="text-slate-700">{formatPhone(info.getValue())}</span>,
      }),
      columnHelper.accessor('taxDebtAmount', {
        header: 'Debt',
        cell: (info) => (
          <span className="tabular-nums">{formatCurrency(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor('pipelineStage', {
        header: 'Stage',
        cell: (info) => {
          const s = info.getValue();
          if (!s) return <span className="text-slate-400">—</span>;
          return (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
              {PIPELINE_LABELS[s]}
            </span>
          );
        },
      }),
      columnHelper.accessor('assignedTo', {
        header: 'Agent',
        cell: (info) => {
          const id = info.getValue();
          if (!id) return <span className="text-slate-400">—</span>;
          const name = userMap.get(id);
          return (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-6 w-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">
                {initials(name)}
              </span>
              <span className="text-sm text-slate-700">{name ?? '—'}</span>
            </span>
          );
        },
      }),
      columnHelper.accessor('updatedAt', {
        header: 'Last activity',
        cell: (info) => (
          <span className="text-sm text-slate-500">{relativeTime(info.getValue())}</span>
        ),
      }),
    ],
    [userMap],
  );

  const table = useReactTable({
    data: contactsQuery.data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const total = contactsQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Contacts</h1>
          <p className="text-sm text-slate-500">{total} total</p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + New contact
        </button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 mb-4 p-3 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">Search</label>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Name, phone, email…"
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ContactStatus | '');
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-white"
          >
            <option value="">All</option>
            {CONTACT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CONTACT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Stage</label>
          <select
            value={stage}
            onChange={(e) => {
              setStage(e.target.value as PipelineStage | '');
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-white"
          >
            <option value="">All</option>
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>
                {PIPELINE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Agent</label>
          <select
            value={assignedTo}
            onChange={(e) => {
              setAssignedTo(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-white"
          >
            <option value="">All</option>
            {usersQuery.data?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide"
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contactsQuery.isLoading && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {!contactsQuery.isLoading && table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-slate-500">
                  No contacts found.
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2 text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
        <span>
          Page {page} of {pageCount}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-50 bg-white"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-50 bg-white"
          >
            Next
          </button>
        </div>
      </div>

      <ContactForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}
