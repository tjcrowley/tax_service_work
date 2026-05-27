import { S3Client } from '@aws-sdk/client-s3';
import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

type SpacesConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

let cachedClient: S3Client | null = null;
let cachedConfig: SpacesConfig | null = null;

function loadConfig(): SpacesConfig | null {
  const accessKeyId = process.env.DO_SPACES_KEY;
  const secretAccessKey = process.env.DO_SPACES_SECRET;
  const bucket = process.env.DO_SPACES_BUCKET;
  const region = process.env.DO_SPACES_REGION || 'us-east-1';
  const endpoint =
    process.env.DO_SPACES_ENDPOINT ||
    (region ? `https://${region}.digitaloceanspaces.com` : undefined);
  if (!accessKeyId || !secretAccessKey || !bucket || !endpoint) return null;
  return { endpoint, region, bucket, accessKeyId, secretAccessKey };
}

export function getSpacesConfig(): SpacesConfig | null {
  if (cachedConfig) return cachedConfig;
  cachedConfig = loadConfig();
  return cachedConfig;
}

export function isSpacesConfigured(): boolean {
  return getSpacesConfig() !== null;
}

export function getSpacesClient(): S3Client | null {
  if (cachedClient) return cachedClient;
  const config = getSpacesConfig();
  if (!config) return null;
  cachedClient = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: false,
  });
  return cachedClient;
}

export function validateSpacesCredentials(logger: {
  warn: (msg: string) => void;
  info: (msg: string) => void;
}): void {
  const config = getSpacesConfig();
  if (!config) {
    logger.warn(
      'DO Spaces credentials missing — DO_SPACES_KEY / DO_SPACES_SECRET / DO_SPACES_BUCKET. Document uploads will return 503.',
    );
    return;
  }
  logger.info(`DO Spaces configured (bucket=${config.bucket}, region=${config.region})`);
}

export async function uploadObject(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  const client = getSpacesClient();
  const config = getSpacesConfig();
  if (!client || !config) throw new Error('Spaces not configured');
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      ACL: 'private',
    }),
  );
}

export async function getSignedDownloadUrl(
  key: string,
  expiresInSeconds = 900,
): Promise<string> {
  const client = getSpacesClient();
  const config = getSpacesConfig();
  if (!client || !config) throw new Error('Spaces not configured');
  const command = new GetObjectCommand({ Bucket: config.bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export async function deleteObject(key: string): Promise<void> {
  const client = getSpacesClient();
  const config = getSpacesConfig();
  if (!client || !config) throw new Error('Spaces not configured');
  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}

export function resetSpacesCacheForTests(): void {
  cachedClient = null;
  cachedConfig = null;
}
