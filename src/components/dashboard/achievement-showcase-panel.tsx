"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Star, StarOff, RefreshCw, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AchievementBadge } from "@/components/achievements/achievement-badge";
import {
  toggleAchievementShowcase,
  refreshMyAchievements,
  setShowcaseOrder,
} from "@/actions/achievements";
import { SHOWCASE_MAX } from "@/lib/achievement-constants";
import { useAppToast } from "@/hooks/use-app-toast";
import type { AchievementRarity } from "@prisma/client";

type AchievementRow = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  rarity: AchievementRarity;
  animated: boolean;
  glowEffect: boolean;
  unlockedAt: Date;
  isShowcased: boolean;
  showcaseOrder: number | null;
};

const RARITY_RANK: Record<AchievementRarity, number> = {
  COMMON: 1,
  UNCOMMON: 2,
  RARE: 3,
  EPIC: 4,
  LEGENDARY: 5,
};

export function AchievementShowcasePanel({
  achievements,
  xp,
  level,
}: {
  achievements: AchievementRow[];
  xp: number;
  level: number;
}) {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<"all" | "featured" | "locked">("all");
  const [sort, setSort] = useState<"date" | "rarity" | "name">("date");

  const showcased = achievements.filter((a) => a.isShowcased);
  const showcasedIds = showcased
    .sort((a, b) => (a.showcaseOrder ?? 99) - (b.showcaseOrder ?? 99))
    .map((a) => a.id);

  const filtered = useMemo(() => {
    let list = [...achievements];
    if (filter === "featured") list = list.filter((a) => a.isShowcased);
    if (filter === "locked") list = list.filter((a) => !a.isShowcased);
    list.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "rarity") return RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity];
      return new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime();
    });
    return list;
  }, [achievements, filter, sort]);

  function moveShowcase(id: string, direction: -1 | 1) {
    const idx = showcasedIds.indexOf(id);
    if (idx < 0) return;
    const next = idx + direction;
    if (next < 0 || next >= showcasedIds.length) return;
    const reordered = [...showcasedIds];
    [reordered[idx], reordered[next]] = [reordered[next], reordered[idx]];
    startTransition(async () => {
      const r = await setShowcaseOrder(reordered);
      if (r.success) router.refresh();
      else appToast.error(r.error);
    });
  }

  return (
    <Card className="glass max-w-3xl">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{t("achievementsTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Level {level} · {xp.toLocaleString()} XP · {t("featuredCount", { count: showcased.length })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await refreshMyAchievements();
              if (r.success) {
                appToast.saved();
                if (r.data?.unlocked?.length) {
                  appToast.raw({ title: "New achievements", description: r.data.unlocked.join(", ") });
                }
                router.refresh();
              } else appToast.error(r.error);
            })
          }
        >
          <RefreshCw className="h-4 w-4 mr-1" /> {t("sync")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showcased.length > 0 && (
          <div className="rounded-lg border border-neon-purple/30 bg-neon-purple/5 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">{t("featuredShowcase")}</p>
            <div className="flex flex-wrap gap-2">
              {showcasedIds.map((id, i) => {
                const a = achievements.find((x) => x.id === id);
                if (!a) return null;
                return (
                  <div key={id} className="flex items-center gap-1 rounded-md border border-border/40 bg-card/50 px-2 py-1">
                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                    <AchievementBadge
                      name={a.name}
                      description={a.description}
                      icon={a.icon}
                      rarity={a.rarity}
                      animated={a.animated}
                      glowEffect={a.glowEffect}
                      unlockedAt={a.unlockedAt}
                      size="sm"
                    />
                    <div className="flex flex-col">
                      <Button variant="ghost" size="icon" className="h-5 w-5" disabled={pending || i === 0} onClick={() => moveShowcase(id, -1)}>
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-5 w-5" disabled={pending || i === showcasedIds.length - 1} onClick={() => moveShowcase(id, 1)}>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filterAll")}</SelectItem>
              <SelectItem value="featured">{t("filterFeatured")}</SelectItem>
              <SelectItem value="locked">{t("filterNotFeatured")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="date">{t("sortNewest")}</SelectItem>
              <SelectItem value="rarity">{t("sortRarity")}</SelectItem>
              <SelectItem value="name">{t("sortName")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No achievements match this filter.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-lg border border-border/40 p-3 bg-card/30"
              >
                <AchievementBadge
                  name={a.name}
                  description={a.description}
                  icon={a.icon}
                  rarity={a.rarity}
                  animated={a.animated}
                  glowEffect={a.glowEffect}
                  unlockedAt={a.unlockedAt}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  {a.description && <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>}
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Unlocked {new Date(a.unlockedAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant={a.isShowcased ? "neon" : "ghost"}
                  size="icon"
                  disabled={pending}
                  title={a.isShowcased ? "Remove from featured" : `Feature (${SHOWCASE_MAX} max)`}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await toggleAchievementShowcase(a.id, !a.isShowcased);
                      if (r.success) router.refresh();
                      else appToast.error(r.error);
                    })
                  }
                >
                  {a.isShowcased ? <Star className="h-4 w-4" /> : <StarOff className="h-4 w-4" />}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
