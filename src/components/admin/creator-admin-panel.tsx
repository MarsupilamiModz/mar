"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { PublisherLevel, SocialPlatform } from "@prisma/client";
import {
  updateCreatorProfile,
  deleteCreatorProfile,
  banCreator,
  setCreatorLevel,
  assignCreatorCode,
  assignCreatorCouponCode,
  upsertCreatorSocialLinks,
  syncCreatorStatsAction,
} from "@/actions/admin/creators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreatorLevelBadge } from "@/components/creator/creator-level-badge";
import { SocialLinks } from "@/components/social/social-links";
import { SOCIAL_PLATFORMS } from "@/lib/affiliate";
import { LEVEL_OPTIONS, CREATOR_LEVELS, effectiveRevenueShareBps } from "@/lib/creator-levels";
import { formatCents } from "@/lib/affiliate";
import { useAppToast } from "@/hooks/use-app-toast";

type CreatorData = {
  id: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  creatorCode: string | null;
  couponCode: string | null;
  referralCode: string | null;
  level: PublisherLevel;
  commissionRateBps: number;
  commissionOverrideBps: number | null;
  isVerified: boolean;
  isFeatured: boolean;
  isSuspended: boolean;
  isPublic: boolean;
  isHomepage: boolean;
  isTrending: boolean;
  sortOrder: number;
  totalDownloads: number;
  totalRevenueCents: number;
  totalSales: number;
  totalCouponUses: number;
  totalDiscountCents: number;
  totalClicks: number;
  totalConversions: number;
  followerCount: number;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    email: string;
    avatarUrl: string | null;
    isBanned: boolean;
  };
  socialLinks: { platform: SocialPlatform; url: string }[];
};

export function CreatorAdminPanel({ locale, creator }: { locale: string; creator: CreatorData }) {
  const t = useTranslations("ecosystem");
  const appToast = useAppToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [level, setLevel] = useState(creator.level);
  const share = effectiveRevenueShareBps(level, creator.commissionOverrideBps, creator.commissionRateBps);

  const conversionRate =
    creator.totalClicks > 0 ? ((creator.totalConversions / creator.totalClicks) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <CreatorLevelBadge level={creator.level} size="md" />
        {creator.isFeatured && <Badge variant="premium">{t("featured")}</Badge>}
        {creator.isPublic && <Badge variant="outline">{t("public")}</Badge>}
        {creator.isHomepage && <Badge variant="outline">{t("homepage")}</Badge>}
        {creator.isTrending && <Badge variant="outline">{t("trending")}</Badge>}
        {creator.user.isBanned && <Badge variant="destructive">{t("banned")}</Badge>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t("revenue"), value: formatCents(creator.totalRevenueCents, locale) },
          { label: t("clicks"), value: String(creator.totalClicks) },
          { label: t("conversions"), value: String(creator.totalConversions) },
          { label: t("conversionRate"), value: `${conversionRate}%` },
          { label: t("downloads"), value: String(creator.totalDownloads) },
          { label: t("couponUses"), value: String(creator.totalCouponUses) },
          { label: t("totalDiscount"), value: formatCents(creator.totalDiscountCents, locale) },
          { label: t("followers"), value: String(creator.followerCount) },
        ].map((s) => (
          <Card key={s.label} className="glass p-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-lg font-bold">{s.value}</p>
          </Card>
        ))}
      </div>

      <Card className="glass p-6 space-y-4">
        <h3 className="font-medium">{t("editCreator")}</h3>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              const r = await updateCreatorProfile(creator.id, {
                tagline: fd.get("tagline") as string,
                description: fd.get("description") as string,
                slug: fd.get("slug") as string,
                isFeatured: fd.get("isFeatured") === "on",
                isPublic: fd.get("isPublic") === "on",
                isHomepage: fd.get("isHomepage") === "on",
                isTrending: fd.get("isTrending") === "on",
                isSuspended: fd.get("isSuspended") === "on",
                commissionOverrideBps: fd.get("override") ? Number(fd.get("override")) : null,
              });
              if (r.success) {
                appToast.saved();
                router.refresh();
              } else appToast.error(r.error);
            });
          }}
        >
          <Input name="slug" defaultValue={creator.slug} placeholder="Slug" />
          <Input name="tagline" defaultValue={creator.tagline ?? ""} placeholder={t("tagline")} />
          <Textarea name="description" defaultValue={creator.description ?? ""} rows={4} />
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="isFeatured" defaultChecked={creator.isFeatured} />{t("featured")}</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="isPublic" defaultChecked={creator.isPublic} />{t("public")}</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="isHomepage" defaultChecked={creator.isHomepage} />{t("homepage")}</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="isTrending" defaultChecked={creator.isTrending} />{t("trending")}</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="isSuspended" defaultChecked={creator.isSuspended} />{t("suspended")}</label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground">{t("creatorLevel")}</label>
              <Select
                value={level}
                onValueChange={(v) => {
                  setLevel(v as PublisherLevel);
                  startTransition(async () => {
                    const r = await setCreatorLevel(creator.id, v as PublisherLevel);
                    if (r.success) router.refresh();
                  });
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVEL_OPTIONS.map((l) => (
                    <SelectItem key={l} value={l}>{t(CREATOR_LEVELS[l].labelKey)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">{t("revenueShare")}: {(share / 100).toFixed(1)}%</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t("overrideShare")}</label>
              <Input name="override" type="number" placeholder="bps" defaultValue={creator.commissionOverrideBps ?? ""} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="neon" disabled={pending}>{t("save")}</Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await syncCreatorStatsAction(creator.id);
                  router.refresh();
                  appToast.updated();
                })
              }
            >
              {t("syncStats")}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="glass p-6 space-y-3">
        <h3 className="font-medium">{t("codes")}</h3>
        <p className="font-mono text-neon-purple">{creator.creatorCode ?? "—"}</p>
        <p className="font-mono text-sm">{t("couponCode")}: {creator.couponCode ?? "—"}</p>
        <p className="text-xs text-muted-foreground">{t("referralLink")}: /{locale}?ref={creator.referralCode ?? creator.creatorCode ?? "—"}</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await assignCreatorCode(creator.id);
                if (r.success) router.refresh();
              })
            }
          >
            {t("regenerateCode")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await assignCreatorCouponCode(creator.id);
                if (r.success) router.refresh();
              })
            }
          >
            {t("setCouponCode")}
          </Button>
        </div>
      </Card>

      <Card className="glass p-6 space-y-3">
        <h3 className="font-medium">{t("socialLinks")}</h3>
        <SocialLinks links={creator.socialLinks} />
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const links = SOCIAL_PLATFORMS.map((p) => ({
              platform: p,
              url: (fd.get(p) as string)?.trim() ?? "",
            })).filter((l) => l.url);
            startTransition(async () => {
              const r = await upsertCreatorSocialLinks(creator.id, links);
              if (r.success) {
                appToast.saved();
                router.refresh();
              }
            });
          }}
        >
          {SOCIAL_PLATFORMS.map((p) => (
            <Input
              key={p}
              name={p}
              placeholder={p}
              defaultValue={creator.socialLinks.find((l) => l.platform === p)?.url ?? ""}
            />
          ))}
          <Button type="submit" variant="outline" size="sm" disabled={pending}>{t("save")}</Button>
        </form>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await banCreator(creator.id, !creator.user.isBanned);
              if (r.success) router.refresh();
            })
          }
        >
          {creator.user.isBanned ? t("unban") : t("banCreator")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              if (!confirm(t("confirmDelete"))) return;
              const r = await deleteCreatorProfile(creator.id);
              if (r.success) router.push(`/${locale}/admin/creators`);
            })
          }
        >
          {t("deleteCreator")}
        </Button>
      </div>
    </div>
  );
}
