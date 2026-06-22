import { NextResponse } from "next/server";
import { checkDbHealth } from "@/lib/db";

/** Non-streaming liveness probe — use for uptime checks instead of HTML pages. */
export const dynamic = "force-dynamic";

export async function GET() {
  const db = await checkDbHealth();
  return NextResponse.json(
    { ok: db.ok, db: db.ok ? "connected" : db.detail, ts: Date.now() },
    { status: db.ok ? 200 : 503 }
  );
}
