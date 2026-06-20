"use client";

import { useEffect, useState, useTransition } from "react";
import { searchModsAction } from "@/actions/search";
import { ModCard } from "@/components/mods/mod-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ModRow = Parameters<typeof ModCard>[0]["mod"];

export function SearchPageClient({
  locale,
  initialQuery,
  initialTag,
  initialGame,
  initialSort,
  popularTags,
  games,
  trendingMods,
}: {
  locale: string;
  initialQuery: string;
  initialTag?: string;
  initialGame?: string;
  initialSort: "downloads" | "trending" | "rating" | "newest" | "updated" | "likes";
  popularTags: { name: string; count: number }[];
  games: { slug: string; name: string }[];
  trendingMods: ModRow[];
}) {
  const [query, setQuery] = useState(initialQuery);
  const [tag, setTag] = useState(initialTag ?? "");
  const [gameSlug, setGameSlug] = useState(initialGame ?? "all");
  const [sort, setSort] = useState(initialSort);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [mods, setMods] = useState<ModRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pending, startTransition] = useTransition();

  function runSearch() {
    startTransition(async () => {
      const r = await searchModsAction({
        query,
        tag: tag || undefined,
        gameSlug: gameSlug !== "all" ? gameSlug : undefined,
        sort,
        verifiedCreator: verifiedOnly,
      });
      if (r.success) {
        setMods(r.data.mods as ModRow[]);
        setTotal(r.data.total);
      }
    });
  }

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag, gameSlug, sort, verifiedOnly, initialQuery]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Search mods</h1>
        <p className="text-sm text-muted-foreground mt-1">Filter by game, tags, creator verification, and more</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search mods, tags, creators…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-md"
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
        />
        <Select value={gameSlug} onValueChange={setGameSlug}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Game" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All games</SelectItem>
            {games.map((g) => (
              <SelectItem key={g.slug} value={g.slug}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="downloads">Most downloaded</SelectItem>
            <SelectItem value="trending">Trending</SelectItem>
            <SelectItem value="rating">Best rated</SelectItem>
            <SelectItem value="likes">Most liked</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="updated">Recently updated</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="neon" disabled={pending} onClick={runSearch}>Search</Button>
        <Button
          variant={verifiedOnly ? "neon" : "outline"}
          size="sm"
          onClick={() => setVerifiedOnly((v) => !v)}
        >
          Verified creators
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {popularTags.map((t) => (
          <button key={t.name} type="button" onClick={() => setTag(tag === t.name ? "" : t.name)}>
            <Badge variant={tag === t.name ? "premium" : "outline"}>{t.name} ({t.count})</Badge>
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">{total} results</p>

      {mods.length === 0 && !pending ? (
        <p className="text-muted-foreground">No mods found.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {mods.map((m) => (
            <ModCard key={m.id} locale={locale} mod={m} />
          ))}
        </div>
      )}

      {trendingMods.length > 0 && mods.length === 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">Trending this week</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {trendingMods.map((m) => (
              <ModCard key={m.id} locale={locale} mod={m} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
