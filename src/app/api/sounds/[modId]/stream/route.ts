import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { getSoundStreamInfo, recordSoundPlay } from "@/actions/sounds";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ modId: string }> }
) {
  const { modId } = await params;

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 16);

  const result = await getSoundStreamInfo(modId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  void recordSoundPlay(modId, ipHash);

  return NextResponse.json(result.data);
}
