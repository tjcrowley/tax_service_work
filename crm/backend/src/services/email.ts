import sgMail from '@sendgrid/mail';

let configured = false;
let cachedApiKey: string | null = null;

function loadKey(): string | null {
  return process.env.SENDGRID_API_KEY ?? null;
}

function ensureConfigured(): boolean {
  const key = loadKey();
  if (!key) return false;
  if (configured && cachedApiKey === key) return true;
  sgMail.setApiKey(key);
  cachedApiKey = key;
  configured = true;
  return true;
}

export function isSendgridConfigured(): boolean {
  return loadKey() !== null;
}

export function validateSendgridCredentials(logger: {
  warn: (msg: string) => void;
  info: (msg: string) => void;
}): void {
  if (!loadKey()) {
    logger.warn(
      'SendGrid not configured — SENDGRID_API_KEY missing. User-invite emails will not be sent.',
    );
    return;
  }
  ensureConfigured();
  logger.info('SendGrid configured');
}

export type SendInviteEmailParams = {
  to: string;
  inviteUrl: string;
  inviterName: string;
};

export async function sendInviteEmail(params: SendInviteEmailParams): Promise<void> {
  if (!ensureConfigured()) throw new Error('SendGrid not configured');
  const from = process.env.SENDGRID_FROM_EMAIL ?? 'no-reply@example.com';
  await sgMail.send({
    to: params.to,
    from,
    subject: `You've been invited to the Tax CRM`,
    text: `${params.inviterName} invited you to join the Tax CRM.\n\nSet your password here:\n${params.inviteUrl}\n\nThis link expires in 48 hours.`,
    html: `<p>${escapeHtml(params.inviterName)} invited you to join the Tax CRM.</p><p><a href="${params.inviteUrl}">Set your password</a></p><p>This link expires in 48 hours.</p>`,
  });
}

export function resetSendgridCacheForTests(): void {
  configured = false;
  cachedApiKey = null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
