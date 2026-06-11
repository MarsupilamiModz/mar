import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  initiateMultipartUpload,
  computePartCount,
  PART_SIZE,
} from "@/lib/r2-multipart";
import { storageKey } from "@/lib/storage";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limits";
import { fileSizeBigInt } from "@/lib/file-size";

const initiateSchema = z.object({
  purpose: z.enum([
    "mod-version",
    "mod-screenshot",
    "creator-portfolio",
    "creator-banner",
    "creator-avatar",
    "collection-cover",
  ]),
  fileName: z.string().min(1),
  fileSize: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  contentType: z.string().min(1),
  modId: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = initiateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { purpose, fileName, fileSize, contentType, modId, metadata } = parsed.data;
  const safeName = fileName.replace(/[^\w.-]/g, "_");
  const relativePath = `${user.id}/${Date.now()}-${safeName}`;
  const fileKey = storageKey(`uploads/${purpose}/${relativePath}`);

  const { uploadId, key } = await initiateMultipartUpload(fileKey, contentType);
  const partCount = computePartCount(fileSize);

  const session = await prisma.storageUploadSession.create({
    data: {
      userId: user.id,
      purpose,
      fileKey: key,
      uploadId,
      fileName: safeName,
      fileSize: fileSizeBigInt(fileSize),
      contentType,
      modId,
      metadata: metadata ?? {},
      completedParts: [],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return NextResponse.json({
    sessionId: session.id,
    uploadId,
    key,
    partSize: PART_SIZE,
    partCount,
  });
}
