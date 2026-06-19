import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { prismaModelExists } from "@/lib/prisma-schema";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function todayUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function POST() {
  if (!prismaModelExists("PlatformDailyMetric")) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const cookieStore = await cookies();
    const dayKey = todayUtc().toISOString().slice(0, 10);
    const seen = cookieStore.get("xumari_pv")?.value === dayKey;
    const day = todayUtc();

    const delegate = prisma.platformDailyMetric as unknown as {
      upsert: (args: Record<string, unknown>) => Promise<unknown>;
    };

    await delegate.upsert({
      where: { day },
      create: {
        id: randomUUID(),
        day,
        pageViews: 1,
        uniqueVisitors: seen ? 0 : 1,
      },
      update: {
        pageViews: { increment: 1 },
        ...(seen ? {} : { uniqueVisitors: { increment: 1 } }),
      },
    });

    const res = NextResponse.json({ ok: true });
    if (!seen) {
      res.cookies.set("xumari_pv", dayKey, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 86400,
        path: "/",
      });
    }
    return res;
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
