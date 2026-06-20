import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runSystemHealthMonitor } from "@/lib/system-health-monitor";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") {
    return NextResponse.json({ error: "Owner access only" }, { status: 403 });
  }

  try {
    const snapshot = await runSystemHealthMonitor();
    return NextResponse.json(snapshot);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Health check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
