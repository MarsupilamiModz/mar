import "server-only";

import { prisma } from "@/lib/db";
import { prismaModelExists } from "@/lib/prisma-schema";

/** Read visitor metrics for Owner analytics. */
export async function getVisitorMetrics(since: Date) {
  if (!prismaModelExists("PlatformDailyMetric")) {
    return { pageViews: 0, uniqueVisitors: 0, daily: [] as { day: string; pageViews: number; uniqueVisitors: number }[] };
  }

  const rows = await prisma.platformDailyMetric.findMany({
    where: { day: { gte: since } },
    orderBy: { day: "asc" },
  });

  return {
    pageViews: rows.reduce((s, r) => s + r.pageViews, 0),
    uniqueVisitors: rows.reduce((s, r) => s + r.uniqueVisitors, 0),
    daily: rows.map((r) => ({
      day: r.day.toISOString().slice(0, 10),
      pageViews: r.pageViews,
      uniqueVisitors: r.uniqueVisitors,
    })),
  };
}
