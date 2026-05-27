"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireActionUser } from "@/lib/action-utils";
import { fail, ok } from "@/lib/action-utils";
import { prisma } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache";
import type { SocialPlatform } from "@prisma/client";

export async function getCreatorSettings() {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const profile = await prisma.creatorProfile.findUnique({
    where: { userId: user.id },
    include: { socialLinks: { orderBy: { sortOrder: "asc" } } },
  });
  if (!profile) return fail("No creator profile");

  return ok(profile);
}

export async function updateCreatorSettings(input: {
  tagline?: string;
  description?: string;
  website?: string;
  socialLinks?: { platform: SocialPlatform; url: string }[];
}) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const profile = await prisma.creatorProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return fail("No creator profile");

  await prisma.creatorProfile.update({
    where: { id: profile.id },
    data: {
      ...(input.tagline !== undefined && { tagline: input.tagline }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.website !== undefined && { website: input.website || null }),
    },
  });

  if (input.socialLinks) {
    await prisma.socialLink.deleteMany({ where: { creatorProfileId: profile.id } });
    if (input.socialLinks.length) {
      await prisma.socialLink.createMany({
        data: input.socialLinks.map((l, i) => ({
          creatorProfileId: profile.id,
          platform: l.platform,
          url: l.url,
          sortOrder: i,
        })),
      });
    }
  }

  revalidatePath("/creator/settings");
  revalidatePath(`/creators/${profile.slug}`);
  revalidateTag(CACHE_TAGS.creators);
  return ok(undefined);
}
