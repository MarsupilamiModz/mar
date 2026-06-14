import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertR2Configured, logUploadServer } from "@/lib/r2-config";
import { getPresignedPartUrl } from "@/lib/r2-multipart";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Missing authentication token", code: "AUTH" }, { status: 401 });
  }

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  const partNumber = url.searchParams.get("partNumber");

  if (!sessionId || !partNumber) {
    return NextResponse.json({ error: "sessionId and partNumber required" }, { status: 400 });
  }

  const partNum = Number(partNumber);
  if (!Number.isInteger(partNum) || partNum < 1) {
    return NextResponse.json({ error: "Invalid partNumber" }, { status: 400 });
  }

  try {
    assertR2Configured();
    const session = await prisma.storageUploadSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== user.id || session.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "Invalid or expired upload session" }, { status: 400 });
    }

    const presignedUrl = await getPresignedPartUrl(session.fileKey, session.uploadId, partNum);
    logUploadServer("part_url_issued", { sessionId, partNumber: partNum });
    return NextResponse.json({ partNumber: partNum, url: presignedUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create part URL";
    logUploadServer("part_url_failed", { sessionId, partNumber: partNum, message });
    return NextResponse.json(
      { error: `Cloudflare R2 presigned URL error: ${message}`, code: "STORAGE" },
      { status: 503 }
    );
  }
}
