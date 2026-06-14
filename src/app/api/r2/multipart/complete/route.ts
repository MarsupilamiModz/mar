import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertR2Configured, getR2ConfigStatus, logUploadServer } from "@/lib/r2-config";
import { completeMultipartUpload, abortMultipartUpload } from "@/lib/r2-multipart";
import { finalizeUploadSession } from "@/lib/upload-complete";

const completeSchema = z.object({
  sessionId: z.string(),
  parts: z.array(z.object({ PartNumber: z.number().int(), ETag: z.string() })),
});

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return jsonError("Missing authentication token", 401, "AUTH");
  }

  const body = await req.json().catch(() => null);
  const parsed = completeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.message, 400, "VALIDATION");
  }

  const session = await prisma.storageUploadSession.findUnique({
    where: { id: parsed.data.sessionId },
  });
  if (!session || session.userId !== user.id || session.status !== "IN_PROGRESS") {
    return jsonError("Invalid or expired upload session", 400, "VALIDATION");
  }

  try {
    assertR2Configured();
    logUploadServer("complete_start", {
      sessionId: session.id,
      purpose: session.purpose,
      parts: parsed.data.parts.length,
    });

    await completeMultipartUpload(session.fileKey, session.uploadId, parsed.data.parts);

    await prisma.storageUploadSession.update({
      where: { id: session.id },
      data: { completedParts: parsed.data.parts },
    });

    if (session.purpose === "mod-version") {
      logUploadServer("complete_ok_needs_finalize", { sessionId: session.id });
      return NextResponse.json({
        ok: true,
        sessionId: session.id,
        key: session.fileKey,
        purpose: session.purpose,
        needsFinalize: true,
      });
    }

    const result = await finalizeUploadSession(session.id, user.id);
    logUploadServer("complete_ok", { sessionId: session.id, purpose: session.purpose });
    return NextResponse.json({ ok: true, sessionId: session.id, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Complete failed";
    logUploadServer("complete_failed", { sessionId: session.id, message });
    return jsonError(
      message.toLowerCase().includes("r2") ? message : `Cloudflare R2 upload finalize error: ${message}`,
      500,
      "STORAGE"
    );
  }
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return jsonError("Missing authentication token", 401, "AUTH");
  }

  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) return jsonError("sessionId required", 400, "VALIDATION");

  const session = await prisma.storageUploadSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== user.id) {
    return jsonError("Not found", 404, "VALIDATION");
  }

  try {
    await abortMultipartUpload(session.fileKey, session.uploadId);
  } catch (err) {
    logUploadServer("abort_r2_failed", {
      sessionId,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  await prisma.storageUploadSession.update({
    where: { id: sessionId },
    data: { status: "ABORTED" },
  });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const status = getR2ConfigStatus();
  let connectivity: "ok" | "error" | "skipped" = "skipped";
  let connectivityMessage: string | undefined;

  if (status.configured) {
    try {
      assertR2Configured();
      connectivity = "ok";
      connectivityMessage = "R2 credentials present";
    } catch (err) {
      connectivity = "error";
      connectivityMessage = err instanceof Error ? err.message : "R2 check failed";
    }
  } else {
    connectivity = "error";
    connectivityMessage = `Missing env: ${status.missing.join(", ")}`;
  }

  return NextResponse.json({
    ...status,
    connectivity,
    connectivityMessage,
    maxUploadBytes: 5 * 1024 * 1024 * 1024,
    multipartPartSize: 50 * 1024 * 1024,
    corsNote:
      "Browser uploads require R2 bucket CORS: allow PUT/GET/HEAD from your app origin and expose ETag.",
  });
}
