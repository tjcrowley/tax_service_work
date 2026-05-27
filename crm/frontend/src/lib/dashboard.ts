import { api } from './api';

export type DashboardSummary = {
  range: { from: string; to: string };
  calls: number;
  sms: number;
  newLeads: number;
  tasksDue: number;
};

export type FunnelStage = {
  stage: string | null;
  count: number;
  totalDebt: string;
};

export type FunnelSource = {
  source: string | null;
  count: number;
};

export type DashboardFunnel = {
  byStage: FunnelStage[];
  bySource: FunnelSource[];
};

export type AgentRow = {
  userId: string;
  name: string;
  role: 'admin' | 'agent' | 'viewer';
  calls: number;
  sms: number;
  contacts: number;
};

export type DashboardAgents = {
  range: { from: string; to: string };
  agents: AgentRow[];
};

function toParams(from: Date, to: Date) {
  return { from: from.toISOString(), to: to.toISOString() };
}

export async function fetchSummary(from: Date, to: Date): Promise<DashboardSummary> {
  const resp = await api.get<{ data: DashboardSummary }>('/dashboard/summary', {
    params: toParams(from, to),
  });
  return resp.data.data;
}

export async function fetchFunnel(): Promise<DashboardFunnel> {
  const resp = await api.get<{ data: DashboardFunnel }>('/dashboard/funnel');
  return resp.data.data;
}

export async function fetchAgents(from: Date, to: Date): Promise<DashboardAgents> {
  const resp = await api.get<{ data: DashboardAgents }>('/dashboard/agents', {
    params: toParams(from, to),
  });
  return resp.data.data;
}

export type DateRangeKey = 'today' | '7d' | '30d' | '90d' | 'custom';

export function rangeForKey(key: DateRangeKey, custom?: { from: Date; to: Date }): {
  from: Date;
  to: Date;
} {
  const now = new Date();
  const end = endOfDay(now);
  switch (key) {
    case 'today':
      return { from: startOfDay(now), to: end };
    case '7d':
      return { from: startOfDay(addDays(now, -6)), to: end };
    case '30d':
      return { from: startOfDay(addDays(now, -29)), to: end };
    case '90d':
      return { from: startOfDay(addDays(now, -89)), to: end };
    case 'custom':
      if (!custom) return { from: startOfDay(now), to: end };
      return { from: startOfDay(custom.from), to: endOfDay(custom.to) };
  }
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
