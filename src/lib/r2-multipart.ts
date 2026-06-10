import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3Client } from "@aws-sdk/client-s3";
import { STORAGE, storageKey } from "@/lib/storage";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = STORAGE.bucket;
const PART_SIZE = 10 * 1024 * 1024; // 10MB chunks

export { PART_SIZE };

export function normalizeStorageKey(key: string) {
  return key.startsWith(STORAGE.prefix) ? key : storageKey(key);
}

export async function initiateMultipartUpload(
  key: string,
  contentType: string
) {
  const normalizedKey = normalizeStorageKey(key);
  const res = await r2.send(
    new CreateMultipartUploadCommand({
      Bucket: BUCKET,
      Key: normalizedKey,
      ContentType: contentType,
    })
  );
  if (!res.UploadId) throw new Error("Failed to initiate multipart upload");
  return { uploadId: res.UploadId, key: normalizedKey };
}

export async function getPresignedPartUrl(
  key: string,
  uploadId: string,
  partNumber: number,
  expiresIn = 3600
) {
  const command = new UploadPartCommand({
    Bucket: BUCKET,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  return getSignedUrl(r2, command, { expiresIn });
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: { PartNumber: number; ETag: string }[]
) {
  await r2.send(
    new CompleteMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber) },
    })
  );
}

export async function abortMultipartUpload(key: string, uploadId: string) {
  await r2.send(
    new AbortMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
    })
  );
}

export function computePartCount(fileSize: number) {
  return Math.max(1, Math.ceil(fileSize / PART_SIZE));
}
