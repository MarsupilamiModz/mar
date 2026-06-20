import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { CACHE_TAGS, REVALIDATE } from "@/lib/cache";
import type { TeamRoleGroup, TeamVisibility } from "@prisma/client";

export type PublicTeamMember = {
  id: string;
  name: string;
  roleGroup: TeamRoleGroup;
  roleBadge: string | null;
  roleColor: string | null;
  position: string;
  description: string | null;
  email: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  discordUrl: string | null;
  youtubeUrl: string | null;
  twitchUrl: string | null;
  tiktokUrl: string | null;
  instagramUrl: string | null;
  xUrl: string | null;
  websiteUrl: string | null;
  customLinks: { label: string; url: string }[] | null;
  department: { id: string; name: string; slug: string } | null;
  visibility: TeamVisibility;
};

async function fetchPublicTeamPageData() {
  try {
    const [departments, members] = await Promise.all([
      prisma.teamDepartment.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, slug: true, description: true },
      }),
      prisma.teamMember.findMany({
        where: { isActive: true, visibility: "PUBLIC" },
        orderBy: [{ roleGroup: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
        include: {
          department: { select: { id: true, name: true, slug: true } },
        },
      }),
    ]);

    return {
      departments,
      members: members.map((m) => ({
        ...m,
        customLinks: (m.customLinks as { label: string; url: string }[] | null) ?? null,
      })) as PublicTeamMember[],
    };
  } catch (error) {
    console.error("[getPublicTeamPageData] failed", error);
    return { departments: [], members: [] as PublicTeamMember[] };
  }
}

export const getPublicTeamPageData = unstable_cache(
  fetchPublicTeamPageData,
  ["public-team-page"],
  {
    revalidate: REVALIDATE.static,
    tags: [CACHE_TAGS.partners, "team-page"],
  }
);
