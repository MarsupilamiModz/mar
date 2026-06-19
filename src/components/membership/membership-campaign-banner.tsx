import { prismaModelExists } from "@/lib/prisma-schema";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export async function MembershipCampaignBanner({ locale }: { locale: string }) {
  try {
    if (!prismaModelExists("MembershipCampaign")) return null;

    const campaigns = await prisma.membershipCampaign.findMany({
      where: { isActive: true, isVisible: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 1,
    });

    const campaign = campaigns[0];
    if (!campaign) return null;

    const remaining = Math.max(0, campaign.totalSlots - campaign.soldSlots);
    if (remaining <= 0) return null;

    return (
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
        <Link
          href={`/${locale}/premium`}
          className="block rounded-xl border border-neon-purple/40 bg-gradient-to-r from-neon-purple/15 to-neon-blue/10 p-4 hover:border-neon-purple/60 transition-colors"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {campaign.badgeLabel && (
                <Badge className="mb-2 bg-neon-purple/30 text-neon-purple">{campaign.badgeLabel}</Badge>
              )}
              <p className="font-semibold">{campaign.bannerText ?? campaign.title}</p>
              {campaign.description && (
                <p className="text-sm text-muted-foreground mt-1">{campaign.description}</p>
              )}
            </div>
            <p className="text-lg font-bold tabular-nums text-neon-purple">
              {remaining} / {campaign.totalSlots} left
            </p>
          </div>
        </Link>
      </div>
    );
  } catch {
    return null;
  }
}
