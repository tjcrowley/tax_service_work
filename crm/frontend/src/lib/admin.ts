import { api } from './api';

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'agent' | 'viewer';
  phone: string | null;
  isActive: boolean;
  createdAt: string;
};

export type CannedResponse = {
  id: string;
  label: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type LeadSource = {
  id: string;
  label: string;
  createdAt: string;
};

export type InviteRecord = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'agent' | 'viewer';
  token: string;
  invitedBy: string | null;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
};

export type InviteResponse = {
  invite: InviteRecord;
  inviteUrl: string;
  emailSent: boolean;
};

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const resp = await api.get<{ data: AdminUser[] }>('/admin/users');
  return resp.data.data;
}

export async function inviteUser(input: {
  email: string;
  name: string;
  role: 'admin' | 'agent' | 'viewer';
}): Promise<InviteResponse> {
  const resp = await api.post<{ data: InviteResponse }>('/admin/users/invite', input);
  return resp.data.data;
}

export async function patchAdminUser(
  id: string,
  patch: { isActive?: boolean; role?: AdminUser['role']; name?: string; phone?: string | null },
): Promise<AdminUser> {
  const resp = await api.patch<{ data: AdminUser }>(`/admin/users/${id}`, patch);
  return resp.data.data;
}

export async function acceptInvite(token: string, password: string): Promise<AdminUser> {
  const resp = await api.post<{ data: AdminUser }>('/admin/users/accept-invite', {
    token,
    password,
  });
  return resp.data.data;
}

export async function fetchCannedResponses(): Promise<CannedResponse[]> {
  const resp = await api.get<{ data: CannedResponse[] }>('/settings/canned-responses');
  return resp.data.data;
}

export async function createCannedResponse(input: {
  label: string;
  body: string;
}): Promise<CannedResponse> {
  const resp = await api.post<{ data: CannedResponse }>(
    '/settings/canned-responses',
    input,
  );
  return resp.data.data;
}

export async function updateCannedResponse(
  id: string,
  input: { label?: string; body?: string },
): Promise<CannedResponse> {
  const resp = await api.patch<{ data: CannedResponse }>(
    `/settings/canned-responses/${id}`,
    input,
  );
  return resp.data.data;
}

export async function deleteCannedResponse(id: string): Promise<void> {
  await api.delete(`/settings/canned-responses/${id}`);
}

export async function fetchLeadSources(): Promise<LeadSource[]> {
  const resp = await api.get<{ data: LeadSource[] }>('/settings/lead-sources');
  return resp.data.data;
}

export async function createLeadSource(label: string): Promise<LeadSource> {
  const resp = await api.post<{ data: LeadSource }>('/settings/lead-sources', { label });
  return resp.data.data;
}

export async function deleteLeadSource(id: string): Promise<void> {
  await api.delete(`/settings/lead-sources/${id}`);
}
