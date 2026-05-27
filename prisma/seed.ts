import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const GAMES = [
  {
    slug: "gta-v-fivem",
    name: "GTA V / FiveM",
    description:
      "Premium FiveM resources — scripts, MLOs, vehicles, maps and gameplay enhancements for your roleplay server.",
    seoTitle: "GTA V & FiveM Mods | MarsupilamiModz",
    seoDescription: "Download premium FiveM scripts, MLOs, vehicles and maps on MarsupilamiModz.",
    isFeatured: true,
    sortOrder: 1,
  },
  {
    slug: "minecraft",
    name: "Minecraft",
    description: "Mods, resource packs, shaders and plugins for Java and Bedrock editions.",
    seoTitle: "Minecraft Mods | MarsupilamiModz",
    seoDescription: "Premium Minecraft mods, packs and plugins on MarsupilamiModz.",
    isFeatured: true,
    sortOrder: 2,
  },
  {
    slug: "euro-truck-simulator-2",
    name: "Euro Truck Simulator 2",
    description: "Trucks, trailers, maps and realism packs for long-haul simulation.",
    seoTitle: "ETS2 Mods | MarsupilamiModz",
    seoDescription: "Euro Truck Simulator 2 mods — trucks, maps and realism on MarsupilamiModz.",
    isFeatured: true,
    sortOrder: 3,
  },
  {
    slug: "beamng",
    name: "BeamNG.drive",
    description: "Vehicles, maps, scenarios and physics configs for BeamNG.",
    seoTitle: "BeamNG Mods | MarsupilamiModz",
    seoDescription: "BeamNG.drive vehicles and scenarios on MarsupilamiModz.",
    isFeatured: true,
    sortOrder: 4,
  },
  {
    slug: "assetto-corsa",
    name: "Assetto Corsa",
    description: "Cars, tracks, shaders and physics for Assetto Corsa and Competizione.",
    seoTitle: "Assetto Corsa Mods | MarsupilamiModz",
    seoDescription: "Assetto Corsa cars, tracks and shaders on MarsupilamiModz.",
    isFeatured: true,
    sortOrder: 5,
  },
];

type CategorySeed = { name: string; children?: CategorySeed[] };

const CATEGORY_SEEDS: Record<string, CategorySeed[]> = {
  "gta-v-fivem": [
    {
      name: "Vehicles",
      children: [
        { name: "Police Cars" },
        { name: "Civilian Cars" },
        { name: "Emergency Packs" },
      ],
    },
    {
      name: "Maps",
      children: [{ name: "Drift Maps" }, { name: "RP Maps" }],
    },
    { name: "Scripts" },
    { name: "HUD / UI" },
    { name: "Weapons" },
  ],
  minecraft: [
    {
      name: "Mods",
      children: [{ name: "Survival" }, { name: "RPG" }, { name: "Tech" }],
    },
    { name: "Shaders" },
    { name: "Resource Packs" },
    { name: "Maps" },
  ],
  "euro-truck-simulator-2": [
    { name: "Trucks" },
    { name: "Trailers" },
    { name: "Maps" },
    { name: "Realism" },
  ],
  beamng: [{ name: "Vehicles" }, { name: "Maps" }, { name: "Scenarios" }, { name: "Physics" }],
  "assetto-corsa": [{ name: "Cars" }, { name: "Tracks" }, { name: "Shaders" }, { name: "Physics" }],
};

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function upsertCategoryTree(
  gameId: string,
  nodes: CategorySeed[],
  parentId: string | null = null,
  parentSlug = ""
) {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const baseSlug = slugify(node.name);
    const slug = parentSlug ? `${parentSlug}-${baseSlug}` : baseSlug;

    const category = await prisma.gameCategory.upsert({
      where: { gameId_slug: { gameId, slug } },
      create: {
        gameId,
        parentId,
        name: node.name,
        slug,
        sortOrder: i,
        isVisible: true,
      },
      update: {
        parentId,
        name: node.name,
        sortOrder: i,
        isVisible: true,
      },
    });

    if (node.children?.length) {
      await upsertCategoryTree(gameId, node.children, category.id, slug);
    }
  }
}

async function main() {
  for (const g of GAMES) {
    await prisma.game.upsert({
      where: { slug: g.slug },
      create: g,
      update: g,
    });
  }

  const permissions = [
    "users.read",
    "users.write",
    "mods.read",
    "mods.write",
    "mods.moderate",
    "assets.read",
    "assets.write",
    "games.write",
    "analytics.read",
    "analytics.creator",
    "subscriptions.read",
    "coupons.write",
    "licenses.write",
    "orders.read",
    "orders.write",
    "tickets.read",
    "tickets.write",
    "audit.read",
    "settings.write",
  ];

  for (const key of permissions) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, description: key },
      update: {},
    });
  }

  for (const [gameSlug, tree] of Object.entries(CATEGORY_SEEDS)) {
    const game = await prisma.game.findUnique({ where: { slug: gameSlug } });
    if (!game) continue;
    await upsertCategoryTree(game.id, tree);
  }

  const COMMISSION_RULES = [
    { name: "Subscription affiliate", type: "PERCENT" as const, value: 1000, source: "SUBSCRIPTION" as const, targetRole: "PARTNER" as const },
    { name: "Creator mod sales", type: "PERCENT" as const, value: 1500, source: "MOD_SALE" as const, targetRole: "CREATOR" as const },
    { name: "Custom order bonus", type: "FIXED" as const, value: 500, source: "CUSTOM_ORDER" as const, targetRole: "CREATOR" as const },
    { name: "Coupon conversion", type: "PERCENT" as const, value: 500, source: "COUPON" as const, targetRole: null },
  ];

  for (const rule of COMMISSION_RULES) {
    const existing = await prisma.commissionRule.findFirst({ where: { name: rule.name } });
    if (!existing) {
      await prisma.commissionRule.create({ data: rule });
    }
  }

  console.log("MarsupilamiModz seed complete:", GAMES.length, "games");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
