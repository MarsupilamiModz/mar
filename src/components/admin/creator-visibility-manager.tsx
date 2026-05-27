"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { reorderVisibleCreators } from "@/actions/admin/creators";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreatorLevelBadge } from "@/components/creator/creator-level-badge";
import { ChevronUp, ChevronDown } from "lucide-react";
import type { PublisherLevel } from "@prisma/client";
import { useAppToast } from "@/hooks/use-app-toast";

type Row = {
  id: string;
  slug: string;
  sortOrder: number;
  level: PublisherLevel;
  isFeatured: boolean;
  isPublic: boolean;
  isHomepage: boolean;
  isTrending: boolean;
  user: { displayName: string | null; username: string };
};

export function CreatorVisibilityManager({ creators: initial }: { creators: Row[] }) {
  const t = useTranslations("ecosystem");
  const appToast = useAppToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState(initial);

  function move(id: string, dir: -1 | 1) {
    const idx = rows.findIndex((r) => r.id === id);
    const target = idx + dir;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[idx], next[target]] = [next[target], next[idx]];
    setRows(next.map((r, i) => ({ ...r, sortOrder: i })));
    startTransition(async () => {
      await reorderVisibleCreators(next.map((r) => r.id));
      appToast.saved();
      router.refresh();
    });
  }

  return (
    <Card className="glass p-4 space-y-2">
      <h3 className="font-medium mb-2">{t("visibleCreators")}</h3>
      <p className="text-xs text-muted-foreground mb-4">{t("visibleCreatorsHint")}</p>
      {rows.map((c, i) => (
        <div
          key={c.id}
          className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/30 p-2.5"
        >
          <div className="flex flex-col gap-0.5">
            <Button type="button" size="icon" variant="ghost" className="h-6 w-6" disabled={pending || i === 0} onClick={() => move(c.id, -1)}>
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-6 w-6" disabled={pending || i === rows.length - 1} onClick={() => move(c.id, 1)}>
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{c.user.displayName ?? c.user.username}</p>
            <p className="text-xs text-muted-foreground">/{c.slug}</p>
          </div>
          <CreatorLevelBadge level={c.level} size="xs" />
          <div className="flex flex-wrap gap-1">
            {c.isFeatured && <Badge variant="premium" className="text-[10px]">{t("featured")}</Badge>}
            {c.isHomepage && <Badge variant="outline" className="text-[10px]">HP</Badge>}
            {c.isTrending && <Badge variant="outline" className="text-[10px]">TR</Badge>}
            {!c.isPublic && <Badge variant="destructive" className="text-[10px]">{t("hidden")}</Badge>}
          </div>
        </div>
      ))}
    </Card>
  );
}
