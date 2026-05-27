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

export async function GET(
  _req: Request,
  { params }: { params: { path: string[] } }
) {
  const key = params.path.map(decodeURIComponent).join("/");
  if (!key || key.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const normalizedKey = key.startsWith(STORAGE.prefix) ? key : storageKey(key);

  if (!isStorageConfigured() || !r2) {
    return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  }

  try {
    const object = await r2.send(
      new GetObjectCommand({ Bucket: STORAGE.bucket, Key: normalizedKey })
    );

    const body = object.Body;
    if (!body) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const bytes = await body.transformToByteArray();
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": object.ContentType ?? "application/octet-stream",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }
}
