import { NextResponse } from "next/server";
import { hasScope, recordApiKeyUsage, validateApiKeyFromRequest, getClientIpFromRequest } from "@/lib/api-auth";
import { processApiUpload } from "@/lib/api-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await validateApiKeyFromRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!hasScope(auth.auth.scopes, "upload:write")) {
    await recordApiKeyUsage(auth.auth.keyId, {
      error: true,
      action: "upload.denied",
      ip: getClientIpFromRequest(req),
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    return NextResponse.json({ error: "Missing upload:write scope" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    await recordApiKeyUsage(auth.auth.keyId, {
      error: true,
      action: "upload.invalid_body",
      ip: getClientIpFromRequest(req),
    });
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    await recordApiKeyUsage(auth.auth.keyId, {
      error: true,
      action: "upload.missing_file",
      ip: getClientIpFromRequest(req),
    });
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  try {
    const result = await processApiUpload(file);
    await recordApiKeyUsage(auth.auth.keyId, {
      upload: true,
      bytes: result.size,
      action: "upload.success",
      ip: getClientIpFromRequest(req),
      userAgent: req.headers.get("user-agent") ?? undefined,
      metadata: { fileName: result.fileName, sha256: result.sha256 },
    });

    return NextResponse.json({
      url: result.url,
      fileName: result.fileName,
      size: result.size,
      hash: result.sha256,
      contentType: result.contentType,
      virusTotalStatus: result.virusTotalStatus,
      storageKey: result.storageKey,
    });
  } catch (err) {
    await recordApiKeyUsage(auth.auth.keyId, {
      error: true,
      action: "upload.failed",
      ip: getClientIpFromRequest(req),
      metadata: { message: err instanceof Error ? err.message : "Upload failed" },
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 400 }
    );
  }
}
