import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertR2Configured, getR2Endpoint, logUploadServer } from "@/lib/r2-config";
import { STORAGE, storageKey } from "@/lib/storage";
import { MULTIPART_PART_SIZE } from "@/lib/upload-limits";

function createR2Client() {
  assertR2Configured();
  return new S3Client({
    region: "auto",
    endpoint: getR2Endpoint(),
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

let r2Client: S3Client | null = null;
function getR2Client() {
  if (!r2Client) r2Client = createR2Client();
  return r2Client;
}

const BUCKET = STORAGE.bucket;
const PART_SIZE = MULTIPART_PART_SIZE;

export { PART_SIZE };

export function normalizeStorageKey(key: string) {
  return key.startsWith(STORAGE.prefix) ? key : storageKey(key);
}

export async function initiateMultipartUpload(
  key: string,
  contentType: string
) {
  const normalizedKey = normalizeStorageKey(key);
  logUploadServer("multipart_initiate", { key: normalizedKey, contentType });
  const res = await getR2Client().send(
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
  expiresIn = 7200
) {
  const command = new UploadPartCommand({
    Bucket: BUCKET,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  return getSignedUrl(getR2Client(), command, { expiresIn });
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: { PartNumber: number; ETag: string }[]
) {
  logUploadServer("multipart_complete", { key, uploadId, parts: parts.length });
  await getR2Client().send(
    new CompleteMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber) },
    })
  );
}

export async function abortMultipartUpload(key: string, uploadId: string) {
  await getR2Client().send(
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
