import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { achievementCacheTag } from "@/lib/achievements";

export async function revalidateAchievementShowcase(userId: string) {
  revalidateTag(achievementCacheTag(userId));
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/achievements");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      username: true,
      creatorProfile: { select: { slug: true } },
      partnerProfile: { select: { slug: true } },
    },
  });

  if (user?.creatorProfile?.slug) {
    revalidatePath(`/creators/${user.creatorProfile.slug}`);
  }
  if (user?.partnerProfile?.slug) {
    revalidatePath(`/partners/${user.partnerProfile.slug}`);
  }
}
