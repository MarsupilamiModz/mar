"use server";

import { ok, requireActionOwner } from "@/lib/action-utils";
import { runSystemHealthMonitor } from "@/lib/system-health-monitor";

export async function getOwnerHealthMonitor() {
  const { error } = await requireActionOwner();
  if (error) return error;
  return ok(await runSystemHealthMonitor());
}
