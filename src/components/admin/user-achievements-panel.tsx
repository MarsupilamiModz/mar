"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  grantAchievementToUser,
  revokeAchievementFromUser,
  getAdminAchievements,
} from "@/actions/admin/achievements";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AchievementBadge } from "@/components/achievements/achievement-badge";
import { useAppToast } from "@/hooks/use-app-toast";
import { safeToLocaleDateString } from "@/lib/i18n/safe-locale";
import type { AchievementRarity } from "@prisma/client";

type UserAchievementRow = {
  id: string;
  unlockedAt: Date;
  isShowcased: boolean;
  grantedBy: { username: string; displayName: string | null } | null;
  achievement: {
    id: string;
    name: string;
    slug: string;
    rarity: AchievementRarity;
    icon: string | null;
    category: string;
    isHidden: boolean;
  };
};

type AchievementOption = Extract<
  Awaited<ReturnType<typeof getAdminAchievements>>,
  { success: true }
>["data"][number];

export function UserAchievementsPanel({
  userId,
  initialAchievements,
  allAchievements,
}: {
  userId: string;
  initialAchievements: UserAchievementRow[];
  allAchievements: AchievementOption[];
}) {
  const router = useRouter();
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();
  const [selectedGrant, setSelectedGrant] = useState("");

  const ownedIds = new Set(initialAchievements.map((a) => a.achievement.id));
  const available = allAchievements.filter((a) => !ownedIds.has(a.id));

  return (
    <Card className="glass p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Achievements</h3>
        <Badge variant="outline">{initialAchievements.length} earned</Badge>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <select
          value={selectedGrant}
          onChange={(e) => setSelectedGrant(e.target.value)}
          className="h-10 flex-1 min-w-[180px] rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Grant badge…</option>
          {available.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.rarity}{a.isHidden ? ", hidden" : ""})
            </option>
          ))}
        </select>
        <Button
          variant="neon"
          size="sm"
          disabled={pending || !selectedGrant}
          onClick={() =>
            startTransition(async () => {
              const r = await grantAchievementToUser(userId, selectedGrant);
              if (r.success) {
                appToast.saved();
                setSelectedGrant("");
                router.refresh();
              } else appToast.error(r.error);
            })
          }
        >
          Grant badge
        </Button>
      </div>

      {initialAchievements.length === 0 ? (
        <p className="text-sm text-muted-foreground">No achievements yet.</p>
      ) : (
        <ul className="space-y-3">
          {initialAchievements.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/40 p-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <AchievementBadge
                  name={row.achievement.name}
                  icon={row.achievement.icon}
                  rarity={row.achievement.rarity}
                  animated={false}
                  glowEffect={false}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{row.achievement.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.achievement.rarity} · {safeToLocaleDateString(row.unlockedAt)}
                    {row.grantedBy && ` · by @${row.grantedBy.username}`}
                    {row.isShowcased && " · showcased"}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                className="text-destructive shrink-0"
                onClick={() =>
                  startTransition(async () => {
                    const r = await revokeAchievementFromUser(userId, row.achievement.id);
                    if (r.success) {
                      appToast.saved();
                      router.refresh();
                    } else appToast.error(r.error);
                  })
                }
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
