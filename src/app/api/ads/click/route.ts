import { NextResponse } from "next/server";
import { trackAdClick } from "@/lib/ads";

export async function POST(req: Request) {
  try {
    const { adId } = (await req.json()) as { adId?: string };
    if (!adId) return NextResponse.json({ error: "Missing adId" }, { status: 400 });
    await trackAdClick(adId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
