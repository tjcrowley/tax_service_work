import { api } from './api';

export type ContactStatus = 'lead' | 'prospect' | 'client' | 'resolved' | 'lost';
export type PipelineStage =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'proposal'
  | 'negotiating'
  | 'resolution'
  | 'closed';
export type IrsIssueType =
  | 'wage_garnishment'
  | 'bank_levy'
  | 'lien'
  | 'back_taxes'
  | 'unfiled_returns'
  | 'other';
export type ContactSource =
  | 'website'
  | 'purchased_list'
  | 'referral'
  | 'social'
  | 'other';

export type Contact = {
  id: string;
  createdAt: string;
  updatedAt: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  taxDebtAmount: string | null;
  taxYears: string[] | null;
  irsIssueType: IrsIssueType | null;
  status: ContactStatus;
  pipelineStage: PipelineStage | null;
  assignedTo: string | null;
  source: ContactSource | null;
  sourceDetail: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  isDuplicate: boolean;
  doNotCall: boolean;
  doNotSms: boolean;
};

export type ContactListResponse = {
  data: {
    data: Contact[];
    total: number;
    page: number;
    limit: number;
  };
};

export type ListContactsParams = {
  status?: ContactStatus;
  stage?: PipelineStage;
  assigned_to?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export async function fetchContacts(params: ListContactsParams) {
  const resp = await api.get<ContactListResponse>('/contacts', { params });
  return resp.data.data;
}

export async function fetchContact(id: string): Promise<Contact> {
  const resp = await api.get<{ data: Contact }>(`/contacts/${id}`);
  return resp.data.data;
}

export type ContactInput = Partial<Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'isDuplicate'>> & {
  firstName: string;
  lastName: string;
  phone: string;
};

export async function createContact(input: ContactInput): Promise<Contact> {
  const resp = await api.post<{ data: Contact }>('/contacts', input);
  return resp.data.data;
}

export async function updateContact(id: string, patch: Partial<ContactInput>): Promise<Contact> {
  const resp = await api.patch<{ data: Contact }>(`/contacts/${id}`, patch);
  return resp.data.data;
}

export async function deleteContact(id: string): Promise<Contact> {
  const resp = await api.delete<{ data: Contact }>(`/contacts/${id}`);
  return resp.data.data;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  'new',
  'contacted',
  'qualified',
  'proposal',
  'negotiating',
  'resolution',
  'closed',
];

export const PIPELINE_LABELS: Record<PipelineStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiating: 'Negotiating',
  resolution: 'Resolution',
  closed: 'Closed',
};

export const CONTACT_STATUSES: ContactStatus[] = ['lead', 'prospect', 'client', 'resolved', 'lost'];

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  lead: 'Lead',
  prospect: 'Prospect',
  client: 'Client',
  resolved: 'Resolved',
  lost: 'Lost',
};

export const IRS_ISSUE_LABELS: Record<IrsIssueType, string> = {
  wage_garnishment: 'Wage Garnishment',
  bank_levy: 'Bank Levy',
  lien: 'Lien',
  back_taxes: 'Back Taxes',
  unfiled_returns: 'Unfiled Returns',
  other: 'Other',
};

export const CONTACT_SOURCE_LABELS: Record<ContactSource, string> = {
  website: 'Website',
  purchased_list: 'Purchased List',
  referral: 'Referral',
  social: 'Social',
  other: 'Other',
};

export type UserOption = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'agent' | 'viewer';
  isActive: boolean;
};

export async function fetchUsers(): Promise<UserOption[]> {
  const resp = await api.get<{ data: UserOption[] }>('/users');
  return resp.data.data;
}
