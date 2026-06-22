import { NextResponse } from "next/server";

/** Non-streaming liveness probe — use for uptime checks instead of HTML pages. */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() });
}
