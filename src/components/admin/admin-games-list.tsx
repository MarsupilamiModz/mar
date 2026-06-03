"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { reorderGames, deleteGame } from "@/actions/admin/games";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SafeImage } from "@/components/ui/safe-image";
import { useAppToast } from "@/hooks/use-app-toast";

type AdminGame = {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  coverUrl: string | null;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  _count: { mods: number; categories: number };
};

export function AdminGamesList({ locale, games: initial }: { locale: string; games: AdminGame[] }) {
  const [games, setGames] = useState(initial);
  const [pending, startTransition] = useTransition();
  const appToast = useAppToast();
  const router = useRouter();

  function move(index: number, direction: -1 | 1) {
    const next = [...games];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    const prev = games;
    setGames(next);
    startTransition(async () => {
      const r = await reorderGames(next.map((g) => g.id));
      if (r.success) router.refresh();
      else {
        setGames(prev);
        appToast.error(r.error);
      }
    });
  }

  return (
    <div className="mt-8 space-y-3">
      {games.map((g, index) => (
        <Card key={g.id} className="glass p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative h-12 w-12 shrink-0 rounded-lg overflow-hidden border border-border/50 bg-muted/20">
              <SafeImage
                src={g.iconUrl ?? g.coverUrl}
                alt=""
                fill
                className="object-cover"
                sizes="48px"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold">{g.name}</p>
                {!g.isActive && <Badge variant="destructive">Hidden</Badge>}
                {g.isFeatured && <Badge variant="premium">Featured</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                /{g.slug} · order {g.sortOrder} · {g._count.mods} mods · {g._count.categories} categories
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="icon" variant="outline" disabled={pending || index === 0} onClick={() => move(index, -1)}>
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="outline" disabled={pending || index === games.length - 1} onClick={() => move(index, 1)}>
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/${locale}/admin/games/${g.id}`}>Edit</Link>
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              disabled={pending || g._count.mods > 0}
              title={g._count.mods > 0 ? "Remove mods first" : "Delete game"}
              onClick={() => {
                if (!confirm(`Delete ${g.name}?`)) return;
                startTransition(async () => {
                  const r = await deleteGame(g.id);
                  if (r.success) {
                    setGames((prev) => prev.filter((x) => x.id !== g.id));
                    router.refresh();
                  } else appToast.error(r.error);
                });
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
