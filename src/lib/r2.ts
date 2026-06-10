import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { STORAGE, storageKey } from "@/lib/storage";
import { buildAssetPublicUrl } from "@/lib/assets";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = STORAGE.bucket;

export function quarantineKey(modSlug: string, version: string, fileName: string) {
  return storageKey(`quarantine/mods/${modSlug}/${version}/${fileName}`);
}

export function modFileKey(modSlug: string, version: string, fileName: string) {
  return storageKey(`mods/${modSlug}/${version}/${fileName}`);
}

export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
  cacheControl = "public, max-age=31536000, immutable"
) {
  const normalizedKey = key.startsWith(STORAGE.prefix) ? key : storageKey(key);
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: normalizedKey,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    })
  );
  return normalizedKey;
}

export async function deleteFromR2(key: string) {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export async function getObjectBufferFromR2(key: string): Promise<Buffer> {
  const normalizedKey = key.startsWith(STORAGE.prefix) ? key : storageKey(key);
  const res = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: normalizedKey }));
  const stream = res.Body;
  if (!stream) throw new Error("Empty object");
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function copyObjectInR2(
  sourceKey: string,
  destKey: string,
  contentType?: string,
  cacheControl = "public, max-age=31536000, immutable"
) {
  const src = sourceKey.startsWith(STORAGE.prefix) ? sourceKey : storageKey(sourceKey);
  const dest = destKey.startsWith(STORAGE.prefix) ? destKey : storageKey(destKey);
  await r2.send(
    new CopyObjectCommand({
      Bucket: BUCKET,
      CopySource: `${BUCKET}/${src}`,
      Key: dest,
      ContentType: contentType,
      CacheControl: cacheControl,
    })
  );
  return dest;
}

export async function getSignedDownloadUrl(key: string, expiresIn = 300) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(r2, command, { expiresIn });
}

export function getPublicAssetUrl(key: string) {
  return buildAssetPublicUrl(key.startsWith(STORAGE.prefix) ? key : storageKey(key));
}

export const ALLOWED_UPLOAD_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
  "application/pdf",
  "text/plain",
];

export const MAX_UPLOAD_SIZE = 500 * 1024 * 1024;

export { STORAGE };
