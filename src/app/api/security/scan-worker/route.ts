import { NextResponse } from "next/server";
import { processScanQueue, scheduleRescanStaleFiles } from "@/lib/security/scan-worker";

function authorize(req: Request) {
  const secret = process.env.CRON_SECRET ?? process.env.SECURITY_WORKER_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [scanResult, rescheduled] = await Promise.all([
      processScanQueue(5),
      scheduleRescanStaleFiles(30, 10),
    ]);
    return NextResponse.json({ ok: true, scanResult, rescheduled });
  } catch (err) {
    console.error("[scan-worker]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Worker failed" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return POST(req);
}
