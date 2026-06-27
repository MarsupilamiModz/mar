import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveHostingPartner, recordHostingClick } from "@/lib/hosting/resolve";
import { provisionHostingServer } from "@/lib/hosting/provision";
import { prisma } from "@/lib/db";
import { z } from "zod";

const bodySchema = z.object({
  modId: z.string().optional(),
  collectionId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    let partner = null;
    let gameSlug: string | undefined;
    let modpackTitle: string | undefined;

    if (parsed.data.modId) {
      const mod = await prisma.mod.findUnique({
        where: { id: parsed.data.modId },
        include: { game: { select: { id: true, slug: true } } },
      });
      if (!mod) return NextResponse.json({ error: "Mod not found" }, { status: 404 });
      gameSlug = mod.game.slug;
      modpackTitle = mod.title;
      partner = await resolveHostingPartner({
        mod: {
          id: mod.id,
          gameId: mod.gameId,
          serverPartnerEnabled: mod.serverPartnerEnabled,
          serverPartnerId: mod.serverPartnerId,
          serverPartnerLink: mod.serverPartnerLink,
          serverPartnerBanner: mod.serverPartnerBanner,
          authorId: mod.authorId,
        },
        gameId: mod.gameId,
      });
    } else if (parsed.data.collectionId) {
      const collection = await prisma.modCollection.findUnique({
        where: { id: parsed.data.collectionId },
      });
      if (!collection) return NextResponse.json({ error: "Collection not found" }, { status: 404 });
      modpackTitle = collection.title;
      partner = await resolveHostingPartner({
        collection: {
          id: collection.id,
          ownerId: collection.ownerId,
          creatorId: collection.creatorId,
          serverPartnerEnabled: collection.serverPartnerEnabled,
          serverPartnerId: collection.serverPartnerId,
          serverPartnerLink: collection.serverPartnerLink,
          serverPartnerBanner: collection.serverPartnerBanner,
        },
      });
    }

    if (!partner) {
      return NextResponse.json({ error: "No hosting partner configured" }, { status: 404 });
    }

    await recordHostingClick({
      partnerId: partner.partnerId,
      userId: user?.id,
      modId: parsed.data.modId,
      collectionId: parsed.data.collectionId,
      gameId: parsed.data.modId ? undefined : undefined,
      context: "CTA",
    });

    const result = await provisionHostingServer({
      partner,
      modId: parsed.data.modId,
      collectionId: parsed.data.collectionId,
      gameSlug,
      modpackTitle,
    });

    return NextResponse.json({
      redirectUrl: result.ok ? result.redirectUrl : result.fallbackUrl,
      provisioned: result.ok ? result.provisioned : false,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Provision failed" },
      { status: 500 }
    );
  }
}
