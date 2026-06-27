import { prisma } from "@/lib/db";
import { channelNameToGameSlug } from "@/lib/discord-import/parser";

const CATEGORY_SLUG_MAP: Record<string, string[]> = {
  vehicles: ["vehicles", "fahrzeuge", "cars", "vehicle"],
  weapons: ["weapons", "waffen", "weapon"],
  maps: ["maps", "map"],
  scripts: ["scripts", "script"],
  sounds: ["sounds", "audio"],
};

export async function resolveCategoryForImport(input: {
  gameId: string;
  channelName: string;
  tags: string[];
  modeId?: string | null;
}): Promise<string | null> {
  const channelKey = input.channelName.toLowerCase().replace(/^#/, "");
  const haystack = [channelKey, ...input.tags.map((t) => t.toLowerCase())].join(" ");

  for (const [slug, keywords] of Object.entries(CATEGORY_SLUG_MAP)) {
    if (keywords.some((k) => haystack.includes(k))) {
      const cat = await prisma.gameCategory.findFirst({
        where: {
          gameId: input.gameId,
          slug: { contains: slug },
          ...(input.modeId ? { OR: [{ modeId: input.modeId }, { modeId: null }] } : {}),
        },
        select: { id: true },
      });
      if (cat) return cat.id;
    }
  }

  return null;
}

export async function resolveGameModeForChannel(gameId: string, channelName: string) {
  const slug = channelNameToGameSlug(channelName);
  if (!slug) return null;
  const mode = await prisma.gameMode.findFirst({
    where: { gameId, slug: { contains: slug }, isActive: true },
    select: { id: true },
  });
  return mode?.id ?? null;
}
