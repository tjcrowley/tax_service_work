import { api } from './api';

export type ActivityType =
  | 'note'
  | 'call'
  | 'sms'
  | 'email'
  | 'stage_change'
  | 'document'
  | 'task_complete';

export type ActivityDirection = 'inbound' | 'outbound';

export type Activity = {
  id: string;
  contactId: string;
  userId: string | null;
  userName: string | null;
  createdAt: string;
  type: ActivityType;
  direction: ActivityDirection | null;
  durationSeconds: number | null;
  body: string | null;
  twilioCallSid: string | null;
  twilioMessageSid: string | null;
  recordingUrl: string | null;
};

export type ActivityListResponse = {
  data: {
    data: Activity[];
    total: number;
    page: number;
    limit: number;
  };
};

export async function fetchActivities(contactId: string): Promise<Activity[]> {
  const resp = await api.get<ActivityListResponse>(`/contacts/${contactId}/activities`);
  return resp.data.data.data;
}

export async function createNote(contactId: string, body: string): Promise<Activity> {
  const resp = await api.post<{ data: Activity }>(`/contacts/${contactId}/activities`, {
    type: 'note',
    body,
  });
  return resp.data.data;
}
