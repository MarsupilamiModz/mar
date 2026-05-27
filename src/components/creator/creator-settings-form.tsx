"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { getCreatorSettings, updateCreatorSettings } from "@/actions/creator/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { CreatorLevelBadge } from "@/components/creator/creator-level-badge";
import { SOCIAL_PLATFORMS } from "@/lib/affiliate";
import { effectiveRevenueShareBps } from "@/lib/creator-levels";
import { formatCents } from "@/lib/affiliate";
import type { PublisherLevel, SocialPlatform } from "@prisma/client";
import { useAppToast } from "@/hooks/use-app-toast";

type Profile = {
  tagline: string | null;
  description: string | null;
  website: string | null;
  level: PublisherLevel;
  creatorCode: string | null;
  couponCode: string | null;
  referralCode: string | null;
  commissionRateBps: number;
  commissionOverrideBps: number | null;
  totalRevenueCents: number;
  totalSales: number;
  totalCouponUses: number;
  totalDiscountCents: number;
  totalClicks: number;
  totalConversions: number;
  followerCount: number;
  totalDownloads: number;
  socialLinks: { platform: SocialPlatform; url: string }[];
};

export function CreatorSettingsForm({ locale }: { locale: string }) {
  const t = useTranslations("ecosystem");
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    getCreatorSettings().then((r) => {
      if (r.success) setProfile(r.data as Profile);
    });
  }, []);

  if (!profile) return <p className="text-muted-foreground">{t("loading")}</p>;

  const share = effectiveRevenueShareBps(profile.level, profile.commissionOverrideBps, profile.commissionRateBps);
  const convRate = profile.totalClicks > 0 ? ((profile.totalConversions / profile.totalClicks) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <CreatorLevelBadge level={profile.level} size="md" />
        <span className="text-sm text-muted-foreground">{t("revenueShare")}: {(share / 100).toFixed(1)}%</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { l: t("revenue"), v: formatCents(profile.totalRevenueCents, locale) },
          { l: t("downloads"), v: String(profile.totalDownloads) },
          { l: t("couponUses"), v: String(profile.totalCouponUses) },
          { l: t("totalDiscount"), v: formatCents(profile.totalDiscountCents, locale) },
          { l: t("clicks"), v: String(profile.totalClicks) },
          { l: t("conversionRate"), v: `${convRate}%` },
        ].map((s) => (
          <Card key={s.l} className="glass p-3">
            <p className="text-xs text-muted-foreground">{s.l}</p>
            <p className="font-bold">{s.v}</p>
          </Card>
        ))}
      </div>

      <Card className="glass p-4 space-y-2 text-sm">
        <p><span className="text-muted-foreground">{t("creatorCode")}:</span> <span className="font-mono text-neon-purple">{profile.creatorCode}</span></p>
        <p><span className="text-muted-foreground">{t("couponCode")}:</span> <span className="font-mono">{profile.couponCode ?? "—"}</span></p>
        <p><span className="text-muted-foreground">{t("referralLink")}:</span> /{locale}?ref={profile.referralCode ?? profile.creatorCode}</p>
      </Card>

      <Card className="glass p-6">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const links = SOCIAL_PLATFORMS.map((p) => ({
              platform: p,
              url: (fd.get(p) as string)?.trim() ?? "",
            })).filter((l) => l.url);
            startTransition(async () => {
              const r = await updateCreatorSettings({
                tagline: fd.get("tagline") as string,
                description: fd.get("description") as string,
                website: fd.get("website") as string,
                socialLinks: links,
              });
              if (r.success) appToast.saved();
              else appToast.error(r.error);
            });
          }}
        >
          <Input name="tagline" defaultValue={profile.tagline ?? ""} placeholder={t("tagline")} />
          <Textarea name="description" defaultValue={profile.description ?? ""} placeholder={t("bio")} rows={4} />
          <Input name="website" defaultValue={profile.website ?? ""} placeholder="Website" />
          {SOCIAL_PLATFORMS.map((p) => (
            <Input
              key={p}
              name={p}
              placeholder={p}
              defaultValue={profile.socialLinks.find((l) => l.platform === p)?.url ?? ""}
            />
          ))}
          <Button type="submit" variant="neon" disabled={pending}>{t("save")}</Button>
        </form>
      </Card>
    </div>
  );
}
