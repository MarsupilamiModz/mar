import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuthApi } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { formatZodError } from "@/lib/action-utils";

const schema = z.object({ key: z.string().min(8).max(64) });

export async function POST(req: Request) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = rateLimit(`redeem:${user.id}`, 5, 300_000);
  if (!limit.success) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  try {
    const { key } = parsed.data;
    const license = await prisma.licenseKey.findUnique({ where: { key: key.toUpperCase() } });

    if (!license || license.status !== "ACTIVE") {
      return NextResponse.json({ error: "Invalid or expired key" }, { status: 400 });
    }

    if (license.expiresAt && license.expiresAt < new Date()) {
      await prisma.licenseKey.update({
        where: { id: license.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json({ error: "Key expired" }, { status: 400 });
    }

    await prisma.licenseKey.update({
      where: { id: license.id },
      data: {
        status: "REDEEMED",
        redeemedAt: new Date(),
        redeemedById: user.id,
      },
    });

    if (license.productType === "premium") {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: "PREMIUM" },
      });
    }

    return NextResponse.json({ success: true, productType: license.productType });
  } catch (err) {
    console.error("[api/licenses/redeem]", err);
    return NextResponse.json({ error: "Redemption failed" }, { status: 500 });
  }
}
