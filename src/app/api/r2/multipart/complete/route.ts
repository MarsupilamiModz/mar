import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { completeMultipartUpload, abortMultipartUpload } from "@/lib/r2-multipart";
import { finalizeUploadSession } from "@/lib/upload-complete";

const completeSchema = z.object({
  sessionId: z.string(),
  parts: z.array(z.object({ PartNumber: z.number().int(), ETag: z.string() })),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = completeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const session = await prisma.storageUploadSession.findUnique({
    where: { id: parsed.data.sessionId },
  });
  if (!session || session.userId !== user.id || session.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  try {
    await completeMultipartUpload(session.fileKey, session.uploadId, parsed.data.parts);

    if (session.purpose === "mod-version") {
      return NextResponse.json({
        ok: true,
        sessionId: session.id,
        key: session.fileKey,
        purpose: session.purpose,
        needsFinalize: true,
      });
    }

    const result = await finalizeUploadSession(session.id, user.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Complete failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  const session = await prisma.storageUploadSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await abortMultipartUpload(session.fileKey, session.uploadId).catch(() => undefined);
  await prisma.storageUploadSession.update({
    where: { id: sessionId },
    data: { status: "ABORTED" },
  });

  return NextResponse.json({ ok: true });
}
