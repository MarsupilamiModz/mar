import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { S3Client } from "@aws-sdk/client-s3";
import { STORAGE, storageKey } from "@/lib/storage";
import { isStorageConfigured } from "@/lib/asset-storage";

const r2 =
  process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID
    ? new S3Client({
        region: "auto",
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
      })
    : null;

async function fetchObject(key: string) {
  if (!r2) return null;
  try {
    const object = await r2.send(
      new GetObjectCommand({ Bucket: STORAGE.bucket, Key: key })
    );
    const body = object.Body;
    if (!body) return null;
    const bytes = await body.transformToByteArray();
    return {
      bytes: Buffer.from(bytes),
      contentType: object.ContentType ?? "application/octet-stream",
    };
  } catch {
    return null;
  }
}

function candidateKeys(rawKey: string): string[] {
  const normalized = rawKey.startsWith(STORAGE.prefix) ? rawKey : storageKey(rawKey);
  const candidates = new Set<string>([normalized, rawKey]);
  if (rawKey.startsWith(`${STORAGE.prefix}/`)) {
    candidates.add(rawKey);
  }
  if (!rawKey.startsWith(STORAGE.prefix)) {
    candidates.add(storageKey(rawKey));
  }
  return Array.from(candidates);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;

  const key = path.map(decodeURIComponent).join("/");
  if (!key || key.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  if (!isStorageConfigured() || !r2) {
    return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  }

  for (const candidate of candidateKeys(key)) {
    const result = await fetchObject(candidate);
    if (result) {
      return new NextResponse(result.bytes, {
        status: 200,
        headers: {
          "Content-Type": result.contentType,
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.warn("[api/assets] not found", { key, candidates: candidateKeys(key) });
  }

  return NextResponse.json({ error: "Asset not found" }, { status: 404 });
}
