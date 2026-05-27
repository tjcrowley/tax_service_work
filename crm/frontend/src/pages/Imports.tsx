import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CANONICAL_FIELDS,
  CANONICAL_FIELD_LABELS,
  errorReportUrl,
  fetchImport,
  previewImport,
  startImport,
  type CanonicalField,
  type ImportPreview,
  type LeadImport,
} from '../lib/imports';

type Step = 'upload' | 'map' | 'preview' | 'processing' | 'done';

const REQUIRED_FIELDS: CanonicalField[] = ['firstName', 'lastName', 'phone'];

export default function Imports() {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('upload');
  const [filename, setFilename] = useState<string>('');
  const [csvText, setCsvText] = useState<string>('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<CanonicalField, string>>>({});
  const [activeImportId, setActiveImportId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const previewMutation = useMutation({
    mutationFn: (csv: string) => previewImport(csv),
    onSuccess: (data) => {
      setPreview(data);
      setMapping(data.suggestedMapping);
      setStep('map');
      setErrorMessage(null);
    },
    onError: (err: unknown) => {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to preview CSV');
    },
  });

  const startMutation = useMutation({
    mutationFn: () => startImport(filename, csvText, mapping),
    onSuccess: (record) => {
      setActiveImportId(record.id);
      setStep('processing');
      qc.invalidateQueries({ queryKey: ['imports'] });
    },
    onError: (err: unknown) => {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to start import');
    },
  });

  const statusQuery = useQuery({
    queryKey: ['import', activeImportId],
    queryFn: () => fetchImport(activeImportId!),
    enabled: Boolean(activeImportId) && step === 'processing',
    refetchInterval: 1500,
  });

  useEffect(() => {
    if (statusQuery.data && statusQuery.data.status !== 'processing') {
      setStep('done');
    }
  }, [statusQuery.data]);

  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    file.text().then((text) => {
      setFilename(file.name);
      setCsvText(text);
      previewMutation.mutate(text);
    });
  }, [previewMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: { 'text/csv': ['.csv'], 'text/plain': ['.csv', '.txt'] },
  });

  const missingRequired = REQUIRED_FIELDS.filter((f) => !mapping[f]);
  const canSubmit = missingRequired.length === 0;

  const reset = () => {
    setStep('upload');
    setFilename('');
    setCsvText('');
    setPreview(null);
    setMapping({});
    setActiveImportId(null);
    setErrorMessage(null);
  };

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">Lead Import</h1>
      <p className="text-sm text-slate-500 mb-6">
        Upload a CSV of leads. We&apos;ll detect headers, deduplicate against existing
        contacts by phone and email, and normalize phone numbers to E.164.
      </p>

      <StepIndicator step={step} />

      {step === 'upload' && (
        <div
          {...getRootProps()}
          className={`rounded-md border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-brand-500 bg-brand-50'
              : 'border-slate-300 hover:border-slate-400 bg-slate-50'
          }`}
        >
          <input {...getInputProps()} />
          <p className="text-sm text-slate-600">
            {isDragActive ? 'Drop the CSV here…' : 'Drag and drop a CSV here, or click to choose'}
          </p>
          <p className="mt-1 text-xs text-slate-400">First row must be headers</p>
        </div>
      )}

      {(step === 'map' || step === 'preview') && preview && (
        <div className="space-y-6 mt-4">
          <section className="bg-white border border-slate-200 rounded-md p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              Map CSV columns to contact fields
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {CANONICAL_FIELDS.map((field) => (
                <div key={field}>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    {CANONICAL_FIELD_LABELS[field]}
                  </label>
                  <select
                    value={mapping[field] ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setMapping((prev) => {
                        const next = { ...prev };
                        if (!value) delete next[field];
                        else next[field] = value;
                        return next;
                      });
                    }}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="">— ignore —</option>
                    {preview.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {missingRequired.length > 0 && (
              <p className="mt-3 text-xs text-red-600">
                Required mappings missing: {missingRequired.join(', ')}
              </p>
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-md p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              Preview (first 10 rows of {preview.totalRows.toLocaleString()})
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-200">
                    {preview.headers.map((h) => (
                      <th key={h} className="py-2 pr-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sampleRows.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-100">
                      {preview.headers.map((h) => (
                        <td key={h} className="py-1.5 pr-3 text-slate-700">
                          {row[h] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => startMutation.mutate()}
              disabled={!canSubmit || startMutation.isPending}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {startMutation.isPending ? 'Starting…' : `Import ${preview.totalRows} rows`}
            </button>
          </div>
        </div>
      )}

      {step === 'processing' && (
        <div className="mt-6 rounded-md border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-600">Import in progress…</p>
          <p className="mt-2 text-xs text-slate-400">
            Status:{' '}
            <strong>{statusQuery.data?.status ?? 'unknown'}</strong>
          </p>
        </div>
      )}

      {step === 'done' && statusQuery.data && (
        <ResultSummary record={statusQuery.data} onReset={reset} />
      )}
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const ORDER: Step[] = ['upload', 'map', 'preview', 'processing', 'done'];
  const idx = ORDER.indexOf(step);
  return (
    <ol className="flex gap-2 mb-4 text-xs uppercase tracking-wide">
      {ORDER.map((s, i) => (
        <li
          key={s}
          className={`px-2 py-1 rounded-full border ${
            i <= idx
              ? 'border-brand-500 text-brand-700 bg-brand-50'
              : 'border-slate-200 text-slate-400'
          }`}
        >
          {s}
        </li>
      ))}
    </ol>
  );
}

function ResultSummary({
  record,
  onReset,
}: {
  record: LeadImport;
  onReset: () => void;
}) {
  return (
    <div className="mt-6 rounded-md border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold text-slate-900 mb-3">
        Import {record.status}
      </h2>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <Metric label="Total rows" value={record.rowCount ?? 0} />
        <Metric label="Imported" value={record.importedCount ?? 0} />
        <Metric label="Duplicates" value={record.duplicateCount ?? 0} />
        <Metric label="Errors" value={record.errorCount ?? 0} />
      </dl>
      <div className="mt-4 flex gap-2">
        {(record.errorCount ?? 0) > 0 && (
          <a
            href={errorReportUrl(record.id)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Download error report
          </a>
        )}
        <button
          type="button"
          onClick={onReset}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Import another
        </button>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-2xl font-semibold text-slate-900 tabular-nums">{value}</dd>
    </div>
  );
}
