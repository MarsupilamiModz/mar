"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import Link from "next/link";
import { SafeImage } from "@/components/ui/safe-image";
import { Trophy, TrendingUp, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreatorRankBadge } from "@/components/leaderboards/creator-rank-badge";
import { CreatorLevelBadge } from "@/components/creator/creator-level-badge";
import { METRIC_LABELS, PERIOD_LABELS, PUBLIC_LEADERBOARD_METRICS, type LeaderboardEntry } from "@/lib/leaderboards";
import type { LeaderboardMetric, LeaderboardPeriod } from "@prisma/client";

type Game = { slug: string; name: string };

export function LeaderboardClient({
  locale,
  entries,
  games,
  initialMetric,
  initialPeriod,
  initialGame,
  initialSearch,
}: {
  locale: string;
  entries: LeaderboardEntry[];
  games: Game[];
  initialMetric: LeaderboardMetric;
  initialPeriod: LeaderboardPeriod;
  initialGame?: string;
  initialSearch?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const push = useCallback(
    (next: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(next).forEach(([k, v]) => {
        if (v) params.set(k, v);
        else params.delete(k);
      });
      startTransition(() => router.push(`/${locale}/leaderboards?${params.toString()}`));
    },
    [locale, router, searchParams]
  );

  const periods = Object.keys(PERIOD_LABELS) as LeaderboardPeriod[];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <Trophy className="mx-auto h-12 w-12 text-neon-purple mb-4" />
        <h1 className="text-3xl font-bold text-gradient">Creator Leaderboards</h1>
        <p className="text-muted-foreground mt-2">Compete across downloads, likes, growth, and engagement.</p>
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        {PUBLIC_LEADERBOARD_METRICS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => push({ metric: m })}
            className={`rounded-full px-3 py-1.5 text-xs border transition-colors ${
              initialMetric === m ? "border-neon-purple bg-neon-purple/15 text-neon-purple" : "border-border hover:bg-accent/20"
            }`}
          >
            {METRIC_LABELS[m]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 justify-center items-center">
        {periods.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => push({ period: p })}
            className={`text-sm px-3 py-1 rounded-md ${initialPeriod === p ? "bg-neon-blue/20 text-neon-blue" : "text-muted-foreground hover:text-foreground"}`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
        <select
          defaultValue={initialGame ?? ""}
          onChange={(e) => push({ game: e.target.value || undefined })}
          className="h-9 rounded-md border border-input bg-background/50 px-2 text-sm"
        >
          <option value="">All games</option>
          {games.map((g) => (
            <option key={g.slug} value={g.slug}>{g.name}</option>
          ))}
        </select>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            defaultValue={initialSearch}
            placeholder="Search creators"
            className="pl-8 w-48"
            onKeyDown={(e) => {
              if (e.key === "Enter") push({ q: (e.target as HTMLInputElement).value || undefined });
            }}
          />
        </div>
      </div>

      {entries.length > 0 && entries[0] && (
        <Card className="glass p-6 border-neon-purple/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-neon-purple/10 to-neon-blue/10 pointer-events-none" />
          <div className="relative flex items-center gap-4">
            <span className="text-4xl font-bold text-neon-purple">#1</span>
            {entries[0].avatarUrl ? (
              <div className="relative h-16 w-16 rounded-full overflow-hidden border-2 border-neon-purple/50">
                <SafeImage src={entries[0].avatarUrl} alt="" fill className="object-cover" sizes="64px" />
              </div>
            ) : (
              <div className="h-16 w-16 rounded-full bg-neon-purple/20 flex items-center justify-center text-xl font-bold">{entries[0].name[0]}</div>
            )}
            <div className="flex-1">
              <Link href={`/${locale}/creators/${entries[0].slug}`} className="text-xl font-bold hover:text-neon-purple">
                {entries[0].name}
              </Link>
              {entries[0].tagline && <p className="text-sm text-muted-foreground">{entries[0].tagline}</p>}
              <div className="flex gap-2 mt-2">
                <CreatorRankBadge tier={entries[0].rankTier} size="sm" />
                <CreatorLevelBadge level={entries[0].level} size="sm" />
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-neon-blue">{entries[0].score.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">score</p>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {entries.map((e) => (
          <Card
            key={e.creatorId}
            className={`glass p-4 flex items-center gap-4 transition-all hover:border-neon-purple/30 ${e.isPinned ? "border-neon-purple/40" : ""}`}
          >
            <span className={`w-8 text-center font-bold ${e.rank <= 3 ? "text-neon-purple" : "text-muted-foreground"}`}>
              {e.rank}
            </span>
            {e.avatarUrl ? (
              <div className="relative h-10 w-10 rounded-full overflow-hidden shrink-0">
                <SafeImage src={e.avatarUrl} alt="" fill className="object-cover" sizes="40px" />
              </div>
            ) : (
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold">{e.name[0]}</div>
            )}
            <div className="flex-1 min-w-0">
              <Link href={`/${locale}/creators/${e.slug}`} className="font-medium hover:text-neon-purple truncate block">
                {e.name}
              </Link>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <CreatorRankBadge tier={e.rankTier} size="sm" />
                {e.isPinned && <Badge variant="premium">Pinned</Badge>}
                {e.isFeatured && <Badge variant="outline"><TrendingUp className="h-3 w-3 mr-0.5" />Featured</Badge>}
              </div>
            </div>
            <div className="text-right text-sm shrink-0 hidden sm:block">
              <p className="font-semibold text-neon-blue">{e.score.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{e.totalDownloads.toLocaleString()} downloads · {e.followerCount} followers</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
