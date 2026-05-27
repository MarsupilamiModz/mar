"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, StarOff, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AchievementBadge } from "@/components/achievements/achievement-badge";
import { toggleAchievementShowcase, refreshMyAchievements } from "@/actions/achievements";
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
  xpReward?: number;
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
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();
  const showcased = achievements.filter((a) => a.isShowcased).length;

  return (
    <Card className="glass max-w-2xl">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Achievements & Showcase</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Level {level} · {xp.toLocaleString()} XP · {showcased}/6 showcased
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
          <RefreshCw className="h-4 w-4 mr-1" /> Sync
        </Button>
      </CardHeader>
      <CardContent>
        {achievements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No achievements yet. Download mods, purchase premium, or stay active to unlock badges.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {achievements.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-lg border border-border/40 p-3 bg-card/30"
              >
                <AchievementBadge
                  name={a.name}
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
                </div>
                <Button
                  variant={a.isShowcased ? "neon" : "ghost"}
                  size="icon"
                  disabled={pending}
                  title={a.isShowcased ? "Remove from showcase" : "Showcase on profile"}
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
