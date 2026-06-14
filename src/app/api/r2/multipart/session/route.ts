import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Missing authentication token", code: "AUTH" }, { status: 401 });
  }

  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const session = await prisma.storageUploadSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== user.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 404 });
  }

  const { computePartCount, PART_SIZE } = await import("@/lib/r2-multipart");
  const { fileSizeNumber } = await import("@/lib/file-size");

  return NextResponse.json({
    sessionId: session.id,
    status: session.status,
    purpose: session.purpose,
    fileName: session.fileName,
    fileSize: fileSizeNumber(session.fileSize),
    partSize: PART_SIZE,
    partCount: computePartCount(fileSizeNumber(session.fileSize)),
    completedParts: (session.completedParts ?? []) as { PartNumber: number; ETag: string }[],
    modId: session.modId,
    metadata: session.metadata,
  });
}
