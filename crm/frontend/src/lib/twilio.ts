import { api } from './api';

export type CallActivity = {
  id: string;
  contactId: string;
  userId: string | null;
  createdAt: string;
  type: 'call';
  direction: 'inbound' | 'outbound' | null;
  durationSeconds: number | null;
  body: string | null;
  twilioCallSid: string | null;
  recordingUrl: string | null;
};

export type StartCallResponse = {
  callSid: string;
  activity: CallActivity;
};

export async function startOutboundCall(contactId: string): Promise<StartCallResponse> {
  const resp = await api.post<{ data: StartCallResponse }>('/calls/outbound', { contactId });
  return resp.data.data;
}

export type Disposition = 'answered' | 'voicemail' | 'no_answer' | 'busy' | 'failed';

export async function saveDisposition(
  callSid: string,
  disposition: Disposition,
  notes?: string,
): Promise<void> {
  await api.post(`/twilio/dispositions/${callSid}`, { disposition, notes });
}

export type SmsMessage = {
  id: string;
  contactId: string;
  userId: string | null;
  userName: string | null;
  createdAt: string;
  direction: 'inbound' | 'outbound' | null;
  body: string | null;
  twilioMessageSid: string | null;
};

export async function fetchSmsThread(contactId: string): Promise<SmsMessage[]> {
  const resp = await api.get<{ data: SmsMessage[] }>(`/contacts/${contactId}/sms`);
  return resp.data.data;
}

export async function sendSmsMessage(contactId: string, body: string): Promise<SmsMessage> {
  const resp = await api.post<{ data: SmsMessage }>(`/contacts/${contactId}/sms`, { body });
  return resp.data.data;
}
