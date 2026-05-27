import { api } from './api';

export type DocumentCategory =
  | 'irs_notice'
  | 'poa'
  | 'tax_return'
  | 'correspondence'
  | 'other';

export type DocumentRecord = {
  id: string;
  contactId: string;
  uploadedBy: string | null;
  uploadedAt: string;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  category: DocumentCategory | null;
  notes: string | null;
  uploaderName: string | null;
};

export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  irs_notice: 'IRS Notice',
  poa: 'POA',
  tax_return: 'Tax Return',
  correspondence: 'Correspondence',
  other: 'Other',
};

export const CATEGORY_BADGE_CLASSES: Record<DocumentCategory, string> = {
  irs_notice: 'bg-red-100 text-red-700',
  poa: 'bg-amber-100 text-amber-700',
  tax_return: 'bg-emerald-100 text-emerald-700',
  correspondence: 'bg-sky-100 text-sky-700',
  other: 'bg-slate-100 text-slate-700',
};

export async function fetchDocuments(contactId: string): Promise<DocumentRecord[]> {
  const resp = await api.get<{ data: DocumentRecord[] }>(
    `/contacts/${contactId}/documents`,
  );
  return resp.data.data;
}

export async function uploadDocument(
  contactId: string,
  file: File,
  category: DocumentCategory,
  notes: string | undefined,
  onProgress?: (pct: number) => void,
): Promise<DocumentRecord> {
  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('category', category);
  if (notes) formData.append('notes', notes);
  const resp = await api.post<{ data: DocumentRecord }>(
    `/contacts/${contactId}/documents`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (!onProgress) return;
        if (event.total) onProgress(Math.round((event.loaded * 100) / event.total));
      },
    },
  );
  return resp.data.data;
}

export async function getDownloadUrl(
  contactId: string,
  docId: string,
): Promise<{ url: string; filename: string }> {
  const resp = await api.get<{ data: { url: string; filename: string; expiresIn: number } }>(
    `/contacts/${contactId}/documents/${docId}/download`,
  );
  return resp.data.data;
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
