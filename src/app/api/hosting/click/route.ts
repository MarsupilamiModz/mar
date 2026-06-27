import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { recordHostingClick } from "@/lib/hosting/resolve";
import type { HostingClickContext } from "@prisma/client";
import { z } from "zod";

const bodySchema = z.object({
  partnerId: z.string().min(1),
  modId: z.string().optional(),
  collectionId: z.string().optional(),
  gameId: z.string().optional(),
  context: z.enum(["MOD", "COLLECTION", "BANNER", "SIDEBAR", "CTA"]).default("CTA"),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const user = await getCurrentUser();
    const h = headers();
    const country = h.get("cf-ipcountry") ?? h.get("x-vercel-ip-country") ?? null;
    const referrer = req.headers.get("referer");

    await recordHostingClick({
      partnerId: parsed.data.partnerId,
      userId: user?.id,
      modId: parsed.data.modId,
      collectionId: parsed.data.collectionId,
      gameId: parsed.data.gameId,
      context: parsed.data.context as HostingClickContext,
      countryCode: country,
      referrer,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Tracking failed" }, { status: 500 });
  }
}
