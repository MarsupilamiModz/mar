import { NextResponse } from "next/server";
import { getSoundStreamInfo } from "@/actions/sounds";
import { mimeFromFileName } from "@/lib/sound-storage";

/** Same-origin audio proxy — avoids CORS issues with presigned R2 URLs. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ modId: string }> }
) {
  const { modId } = await params;
  const range = _req.headers.get("range");
  const result = await getSoundStreamInfo(modId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  const upstream = await fetch(result.data.streamUrl, {
    headers: range ? { Range: range } : undefined,
  });

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json({ error: "Audio unavailable" }, { status: 502 });
  }

  const headers = new Headers();
  const contentType =
    result.data.contentType ??
    (result.data.previewFileName ? mimeFromFileName(result.data.previewFileName) : "audio/mpeg");
  headers.set("Content-Type", contentType.startsWith("audio/") ? contentType : "audio/mpeg");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, max-age=300");

  const contentLength = upstream.headers.get("content-length");
  const contentRange = upstream.headers.get("content-range");
  if (contentLength) headers.set("Content-Length", contentLength);
  if (contentRange) headers.set("Content-Range", contentRange);

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}
