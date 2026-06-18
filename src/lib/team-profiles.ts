import { cache } from "react";
import { prisma } from "@/lib/db";
import type { TeamVisibility } from "@prisma/client";

export type PublicTeamMember = {
  id: string;
  name: string;
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

export const getPublicTeamPageData = cache(async () => {
  const [departments, members] = await Promise.all([
    prisma.teamDepartment.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true, description: true },
    }),
    prisma.teamMember.findMany({
      where: { isActive: true, visibility: "PUBLIC" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
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
});
