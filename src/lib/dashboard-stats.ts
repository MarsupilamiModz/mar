import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { getWalletBalance } from "@/lib/credits";

export function getDashboardStats(userId: string) {
  return unstable_cache(
    async () => {
      const [downloads, favorites, unreadNotifications, progress, creditBalance] = await Promise.all([
        prisma.download.count({ where: { userId } }),
        prisma.modFavorite.count({ where: { userId } }),
        prisma.notification.count({ where: { userId, read: false } }),
        prisma.userProgress.findUnique({ where: { userId } }),
        getWalletBalance(userId),
      ]);
      return { downloads, favorites, unreadNotifications, progress, creditBalance };
    },
    ["dashboard-stats", userId],
    { revalidate: 30, tags: ["dashboard-stats", `dashboard-stats-${userId}`] }
  )();
}

export function revalidateDashboardStats() {
  revalidateTag("dashboard-stats");
}
