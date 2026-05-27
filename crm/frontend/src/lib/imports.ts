import { api } from './api';

export type ImportStatus = 'processing' | 'complete' | 'failed';

export type LeadImport = {
  id: string;
  uploadedBy: string | null;
  uploadedAt: string;
  filename: string | null;
  rowCount: number | null;
  importedCount: number | null;
  duplicateCount: number | null;
  errorCount: number | null;
  status: ImportStatus;
};

export type CanonicalField =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'taxDebtAmount'
  | 'city'
  | 'state'
  | 'zip'
  | 'sourceDetail';

export const CANONICAL_FIELD_LABELS: Record<CanonicalField, string> = {
  firstName: 'First Name *',
  lastName: 'Last Name *',
  email: 'Email',
  phone: 'Phone *',
  taxDebtAmount: 'Tax Debt Amount',
  city: 'City',
  state: 'State',
  zip: 'ZIP',
  sourceDetail: 'Source Detail',
};

export const CANONICAL_FIELDS: CanonicalField[] = [
  'firstName',
  'lastName',
  'phone',
  'email',
  'taxDebtAmount',
  'city',
  'state',
  'zip',
  'sourceDetail',
];

export type ImportPreview = {
  headers: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
  suggestedMapping: Partial<Record<CanonicalField, string>>;
  fields: CanonicalField[];
};

export async function previewImport(csv: string): Promise<ImportPreview> {
  const resp = await api.post<{ data: ImportPreview }>('/imports/preview', { csv });
  return resp.data.data;
}

export async function startImport(
  filename: string,
  csv: string,
  mapping: Partial<Record<CanonicalField, string>>,
): Promise<LeadImport> {
  const resp = await api.post<{ data: LeadImport }>('/imports', {
    filename,
    csv,
    mapping,
  });
  return resp.data.data;
}

export async function fetchImport(id: string): Promise<LeadImport> {
  const resp = await api.get<{ data: LeadImport }>(`/imports/${id}`);
  return resp.data.data;
}

export async function fetchImports(): Promise<LeadImport[]> {
  const resp = await api.get<{ data: LeadImport[] }>('/imports');
  return resp.data.data;
}

export function errorReportUrl(id: string): string {
  const base = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
  return `${base}/imports/${id}/errors.csv`;
}
