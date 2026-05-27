import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CONTACT_SOURCE_LABELS,
  CONTACT_STATUSES,
  CONTACT_STATUS_LABELS,
  IRS_ISSUE_LABELS,
  PIPELINE_LABELS,
  PIPELINE_STAGES,
  createContact,
  fetchUsers,
  updateContact,
  type Contact,
  type ContactInput,
} from '../lib/contacts';

const formSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  phone: z
    .string()
    .min(1, 'Required')
    .regex(/^\+[1-9]\d{1,14}$/, 'E.164 format (e.g. +15551234567)'),
  email: z.string().email().or(z.literal('')).optional(),
  taxDebtAmount: z.string().optional(),
  irsIssueType: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(['lead', 'prospect', 'client', 'resolved', 'lost']),
  pipelineStage: z.string().optional(),
  assignedTo: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type Props = {
  open: boolean;
  onClose: () => void;
  contact?: Contact | null;
};

function emptyDefaults(contact?: Contact | null): FormValues {
  return {
    firstName: contact?.firstName ?? '',
    lastName: contact?.lastName ?? '',
    phone: contact?.phone ?? '',
    email: contact?.email ?? '',
    taxDebtAmount: contact?.taxDebtAmount ?? '',
    irsIssueType: contact?.irsIssueType ?? '',
    source: contact?.source ?? '',
    status: contact?.status ?? 'lead',
    pipelineStage: contact?.pipelineStage ?? 'new',
    assignedTo: contact?.assignedTo ?? '',
  };
}

export default function ContactForm({ open, onClose, contact }: Props) {
  const qc = useQueryClient();
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: fetchUsers });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyDefaults(contact),
  });

  useEffect(() => {
    if (open) reset(emptyDefaults(contact));
  }, [open, contact, reset]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: ContactInput = {
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
        email: values.email ? values.email : null,
        taxDebtAmount: values.taxDebtAmount ? values.taxDebtAmount : null,
        irsIssueType: values.irsIssueType ? (values.irsIssueType as ContactInput['irsIssueType']) : null,
        source: values.source ? (values.source as ContactInput['source']) : null,
        status: values.status,
        pipelineStage: values.pipelineStage ? (values.pipelineStage as ContactInput['pipelineStage']) : null,
        assignedTo: values.assignedTo ? values.assignedTo : null,
      };
      if (contact) return updateContact(contact.id, payload);
      return createContact(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['contact'] });
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label="Close form"
        onClick={onClose}
        className="flex-1 bg-slate-900/40"
      />
      <form
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
        className="w-full max-w-md bg-white shadow-xl flex flex-col"
      >
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {contact ? 'Edit contact' : 'New contact'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" error={errors.firstName?.message}>
              <input
                {...register('firstName')}
                className="form-input w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Last name" error={errors.lastName?.message}>
              <input
                {...register('lastName')}
                className="form-input w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <Field label="Phone (E.164)" error={errors.phone?.message}>
            <input
              {...register('phone')}
              placeholder="+15551234567"
              className="form-input w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Email" error={errors.email?.message}>
            <input
              type="email"
              {...register('email')}
              className="form-input w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Tax debt amount (USD)">
            <input
              {...register('taxDebtAmount')}
              placeholder="0.00"
              className="form-input w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="IRS issue">
              <select
                {...register('irsIssueType')}
                className="form-select w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="">—</option>
                {Object.entries(IRS_ISSUE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Source">
              <select
                {...register('source')}
                className="form-select w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="">—</option>
                {Object.entries(CONTACT_SOURCE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select
                {...register('status')}
                className="form-select w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                {CONTACT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CONTACT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pipeline stage">
              <select
                {...register('pipelineStage')}
                className="form-select w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="">—</option>
                {PIPELINE_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {PIPELINE_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Assigned to">
            <select
              {...register('assignedTo')}
              className="form-select w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">— Unassigned —</option>
              {usersQuery.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>

          {mutation.isError && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {(mutation.error as Error).message}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 p-3 flex justify-end gap-2 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || mutation.isPending}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {contact ? 'Save changes' : 'Create contact'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-700 mb-1">{label}</span>
      {children}
      {error && <span className="block text-xs text-red-600 mt-1">{error}</span>}
    </label>
  );
}
