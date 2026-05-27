import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import {
  CATEGORY_BADGE_CLASSES,
  CATEGORY_LABELS,
  fetchDocuments,
  formatFileSize,
  getDownloadUrl,
  uploadDocument,
  type DocumentCategory,
  type DocumentRecord,
} from '../lib/documents';
import { absoluteDate } from '../lib/format';

type Props = { contactId: string };

const CATEGORIES: DocumentCategory[] = [
  'irs_notice',
  'poa',
  'tax_return',
  'correspondence',
  'other',
];

export default function DocumentsPanel({ contactId }: Props) {
  const qc = useQueryClient();
  const [category, setCategory] = useState<DocumentCategory>('other');
  const [progress, setProgress] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lastNotesRef = useRef<HTMLInputElement>(null);

  const query = useQuery({
    queryKey: ['documents', contactId],
    queryFn: () => fetchDocuments(contactId),
  });

  const mutation = useMutation({
    mutationFn: (file: File) =>
      uploadDocument(
        contactId,
        file,
        category,
        lastNotesRef.current?.value?.trim() || undefined,
        (pct) => setProgress(pct),
      ),
    onSuccess: () => {
      setProgress(null);
      setErrorMessage(null);
      if (lastNotesRef.current) lastNotesRef.current.value = '';
      qc.invalidateQueries({ queryKey: ['documents', contactId] });
      qc.invalidateQueries({ queryKey: ['activities', contactId] });
    },
    onError: (err: unknown) => {
      setProgress(null);
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setErrorMessage(msg);
    },
  });

  const onDrop = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (file) mutation.mutate(file);
    },
    [mutation],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    maxSize: 25 * 1024 * 1024,
  });

  const onDownload = async (doc: DocumentRecord) => {
    try {
      const { url } = await getDownloadUrl(contactId, doc.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to get download URL');
    }
  };

  const items = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as DocumentCategory)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Notes (optional)
          </label>
          <input
            ref={lastNotesRef}
            type="text"
            placeholder="Anything to remember about this file…"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      <div
        {...getRootProps()}
        className={`rounded-md border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-brand-500 bg-brand-50'
            : 'border-slate-300 hover:border-slate-400 bg-slate-50'
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-sm text-slate-600">
          {isDragActive ? 'Drop the file here…' : 'Drag and drop a file here, or click to choose'}
        </p>
        <p className="mt-1 text-xs text-slate-400">Max 25MB</p>
      </div>

      {progress !== null && (
        <div className="w-full">
          <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-brand-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">{progress}% uploaded</p>
        </div>
      )}

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-3">File</th>
              <th className="py-2 pr-3">Category</th>
              <th className="py-2 pr-3">Size</th>
              <th className="py-2 pr-3">Uploaded</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-xs text-slate-400">
                  Loading documents…
                </td>
              </tr>
            )}
            {!query.isLoading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-xs text-slate-400">
                  No documents yet.
                </td>
              </tr>
            )}
            {items.map((doc) => (
              <tr key={doc.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-medium text-slate-800">{doc.filename}</td>
                <td className="py-2 pr-3">
                  {doc.category ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${CATEGORY_BADGE_CLASSES[doc.category]}`}
                    >
                      {CATEGORY_LABELS[doc.category]}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-slate-600 tabular-nums">
                  {formatFileSize(doc.sizeBytes)}
                </td>
                <td
                  className="py-2 pr-3 text-slate-600"
                  title={absoluteDate(doc.uploadedAt)}
                >
                  {new Date(doc.uploadedAt).toLocaleDateString()}
                </td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onDownload(doc)}
                    className="text-brand-700 hover:underline text-xs"
                  >
                    Download
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
