import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { getSoundStreamInfo, recordSoundPlay } from "@/actions/sounds";

export async function POST(
  req: Request,
  { params }: { params: { modId: string } }
) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 16);

  const result = await getSoundStreamInfo(params.modId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  void recordSoundPlay(params.modId, ipHash);

  return NextResponse.json(result.data);
}
