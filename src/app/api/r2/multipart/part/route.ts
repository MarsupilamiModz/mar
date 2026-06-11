import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPresignedPartUrl } from "@/lib/r2-multipart";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  const partNumber = Number(url.searchParams.get("partNumber"));

  if (!sessionId || !Number.isInteger(partNumber) || partNumber < 1) {
    return NextResponse.json({ error: "sessionId and partNumber required" }, { status: 400 });
  }

  const session = await prisma.storageUploadSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== user.id || session.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  const presignedUrl = await getPresignedPartUrl(session.fileKey, session.uploadId, partNumber);
  return NextResponse.json({ partNumber, url: presignedUrl });
}
