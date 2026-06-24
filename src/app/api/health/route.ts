import { NextResponse } from "next/server";
import { checkDbHealth } from "@/lib/db";
import { getQueueStatus } from "@/lib/job-queue";
import { getR2ConfigStatus } from "@/lib/r2-config";

/** Non-streaming liveness probe — use for uptime checks instead of HTML pages. */
export const dynamic = "force-dynamic";

function redisOk(): { ok: boolean; detail: string } {
  const configured = Boolean(process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL);
  if (!configured) return { ok: true, detail: "not-configured" };
  return { ok: true, detail: "configured" };
}

export async function GET() {
  const [db, queue, r2] = await Promise.all([
    checkDbHealth(),
    Promise.resolve(getQueueStatus()),
    Promise.resolve(getR2ConfigStatus()),
  ]);
  const redis = redisOk();
  const ok = db.ok;

  return NextResponse.json(
    {
      ok,
      db: db.ok ? "connected" : db.detail,
      redis: redis.detail,
      queue: queue.backend,
      storage: r2.configured ? "r2-ready" : "missing-config",
      ts: Date.now(),
    },
    { status: ok ? 200 : 503 }
  );
}
