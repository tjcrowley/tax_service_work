import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  fetchAgents,
  fetchFunnel,
  fetchSummary,
  rangeForKey,
  type DateRangeKey,
} from '../lib/dashboard';
import { PIPELINE_LABELS, type PipelineStage, CONTACT_SOURCE_LABELS } from '../lib/contacts';
import { formatCurrency } from '../lib/format';

const RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
];

const SOURCE_COLORS = [
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#a855f7',
  '#ef4444',
  '#64748b',
];

const PIPELINE_STAGES_ORDER: (PipelineStage | null)[] = [
  'new',
  'contacted',
  'qualified',
  'proposal',
  'negotiating',
  'resolution',
  'closed',
];

export default function Dashboard() {
  const [rangeKey, setRangeKey] = useState<DateRangeKey>('today');
  const range = useMemo(() => rangeForKey(rangeKey), [rangeKey]);

  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary', rangeKey],
    queryFn: () => fetchSummary(range.from, range.to),
  });

  const funnelQuery = useQuery({
    queryKey: ['dashboard-funnel'],
    queryFn: fetchFunnel,
  });

  const agentsQuery = useQuery({
    queryKey: ['dashboard-agents', rangeKey],
    queryFn: () => fetchAgents(range.from, range.to),
  });

  const sortedFunnel = useMemo(() => {
    const map = new Map<string | null, { count: number; debt: number }>();
    (funnelQuery.data?.byStage ?? []).forEach((s) => {
      map.set(s.stage, { count: s.count, debt: Number.parseFloat(s.totalDebt) || 0 });
    });
    return PIPELINE_STAGES_ORDER.map((stage) => ({
      stage,
      label: stage ? PIPELINE_LABELS[stage] : 'Unassigned',
      count: map.get(stage)?.count ?? 0,
      debt: map.get(stage)?.debt ?? 0,
    }));
  }, [funnelQuery.data]);

  const sourceData = useMemo(() => {
    return (funnelQuery.data?.bySource ?? [])
      .filter((s) => s.count > 0)
      .map((s) => ({
        name: s.source
          ? CONTACT_SOURCE_LABELS[s.source as keyof typeof CONTACT_SOURCE_LABELS] ?? s.source
          : 'Unknown',
        value: s.count,
      }));
  }, [funnelQuery.data]);

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            {range.from.toLocaleDateString()} — {range.to.toLocaleDateString()}
          </p>
        </div>
        <div className="inline-flex rounded-md border border-slate-300 overflow-hidden">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setRangeKey(opt.key)}
              className={`px-3 py-1.5 text-sm ${
                rangeKey === opt.key
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Calls"
          value={summaryQuery.data?.calls ?? 0}
          loading={summaryQuery.isLoading}
        />
        <KpiCard
          label="SMS"
          value={summaryQuery.data?.sms ?? 0}
          loading={summaryQuery.isLoading}
        />
        <KpiCard
          label="New Leads"
          value={summaryQuery.data?.newLeads ?? 0}
          loading={summaryQuery.isLoading}
        />
        <KpiCard
          label="Tasks Due"
          value={summaryQuery.data?.tasksDue ?? 0}
          loading={summaryQuery.isLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="lg:col-span-2 bg-white border border-slate-200 rounded-md p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Pipeline funnel</h2>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={sortedFunnel} margin={{ left: 4, right: 8 }}>
                <XAxis dataKey="label" fontSize={11} stroke="#64748b" />
                <YAxis fontSize={11} stroke="#64748b" allowDecimals={false} />
                <Tooltip
                  formatter={(value, _name, item) => {
                    const debt =
                      (item as unknown as { payload?: { debt?: number } }).payload?.debt ?? 0;
                    return [`${value} contacts (${formatCurrency(debt)})`, 'Stage'];
                  }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-md p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Lead sources</h2>
          {sourceData.length === 0 ? (
            <p className="text-xs text-slate-400 py-12 text-center">No data yet.</p>
          ) : (
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={sourceData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    innerRadius={48}
                    paddingAngle={2}
                  >
                    {sourceData.map((_entry, i) => (
                      <Cell
                        key={i}
                        fill={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <section className="bg-white border border-slate-200 rounded-md p-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Agent activity</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3">Agent</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3 text-right">Calls</th>
                <th className="py-2 pr-3 text-right">SMS</th>
                <th className="py-2 text-right">Contacts</th>
              </tr>
            </thead>
            <tbody>
              {agentsQuery.isLoading && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-xs text-slate-400">
                    Loading…
                  </td>
                </tr>
              )}
              {agentsQuery.data?.agents.map((a) => (
                <tr key={a.userId} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-medium text-slate-800">{a.name}</td>
                  <td className="py-2 pr-3 text-slate-600 capitalize">{a.role}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{a.calls}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{a.sms}</td>
                  <td className="py-2 text-right tabular-nums">{a.contacts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: number;
  loading: boolean;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-3xl font-semibold text-slate-900 mt-1 tabular-nums">
        {loading ? '—' : value.toLocaleString()}
      </div>
    </div>
  );
}
