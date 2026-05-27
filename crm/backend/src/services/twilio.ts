import twilio, { type Twilio } from 'twilio';

type TwilioConfig = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
};

let cachedClient: Twilio | null = null;
let cachedConfig: TwilioConfig | null = null;

function loadConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !fromNumber) return null;
  return { accountSid, authToken, fromNumber };
}

export function getTwilioConfig(): TwilioConfig | null {
  if (cachedConfig) return cachedConfig;
  cachedConfig = loadConfig();
  return cachedConfig;
}

export function getTwilioClient(): Twilio | null {
  if (cachedClient) return cachedClient;
  const config = getTwilioConfig();
  if (!config) return null;
  cachedClient = twilio(config.accountSid, config.authToken);
  return cachedClient;
}

export function isTwilioConfigured(): boolean {
  return getTwilioConfig() !== null;
}

export function validateTwilioCredentials(logger: {
  warn: (msg: string) => void;
  info: (msg: string) => void;
}): void {
  const config = getTwilioConfig();
  if (!config) {
    logger.warn(
      'Twilio credentials missing — TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER. Calls and SMS will return 503.',
    );
    return;
  }
  logger.info(`Twilio configured (account ${config.accountSid.slice(0, 8)}…, from ${config.fromNumber})`);
}

export type CreateOutboundCallParams = {
  to: string;
  agentPhone: string | null;
  voiceWebhookUrl: string;
  recordingWebhookUrl: string;
  statusCallbackUrl: string;
};

export async function createOutboundCall(
  params: CreateOutboundCallParams,
): Promise<{ sid: string }> {
  const client = getTwilioClient();
  const config = getTwilioConfig();
  if (!client || !config) throw new Error('Twilio not configured');

  const dialTo = params.agentPhone ?? params.to;

  const call = await client.calls.create({
    to: dialTo,
    from: config.fromNumber,
    url: params.voiceWebhookUrl,
    statusCallback: params.statusCallbackUrl,
    statusCallbackEvent: ['completed'],
    statusCallbackMethod: 'POST',
    record: true,
    recordingStatusCallback: params.recordingWebhookUrl,
    recordingStatusCallbackEvent: ['completed'],
  });
  return { sid: call.sid };
}

export type SendSmsParams = { to: string; body: string };

export async function sendSms(params: SendSmsParams): Promise<{ sid: string }> {
  const client = getTwilioClient();
  const config = getTwilioConfig();
  if (!client || !config) throw new Error('Twilio not configured');
  const message = await client.messages.create({
    to: params.to,
    from: config.fromNumber,
    body: params.body,
  });
  return { sid: message.sid };
}

export function buildDialTwiml(toNumber: string): string {
  const safe = escapeXml(toNumber);
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial record="record-from-answer" timeout="30"><Number>${safe}</Number></Dial></Response>`;
}

export function buildHangupTwiml(): string {
  return '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>';
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function resetTwilioCacheForTests(): void {
  cachedClient = null;
  cachedConfig = null;
}
