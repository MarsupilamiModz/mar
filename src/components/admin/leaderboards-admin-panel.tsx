"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useAppToast } from "@/hooks/use-app-toast";
import {
  saveAdminLeaderboardWeights,
  pinCreatorOnLeaderboard,
  resetCreatorRankings,
  searchCreatorsForLeaderboard,
} from "@/actions/admin/leaderboards";
import type { LeaderboardWeights } from "@/lib/leaderboards";

type Pinned = {
  id: string;
  slug: string;
  leaderboardPinned: boolean;
  user: { username: string; displayName: string | null };
};

export function LeaderboardsAdminPanel({
  weights: initialWeights,
  pinned,
}: {
  weights: LeaderboardWeights;
  pinned: Pinned[];
}) {
  const router = useRouter();
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();
  const [weights, setWeights] = useState(initialWeights);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ id: string; slug: string; user: { username: string } }[]>([]);

  return (
    <div className="space-y-8">
      <Card className="glass p-6 space-y-4">
        <h3 className="font-semibold">Ranking formula weights</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(weights) as (keyof LeaderboardWeights)[]).map((key) => (
            <div key={key}>
              <label className="text-xs text-muted-foreground capitalize">{key}</label>
              <Input
                type="number"
                step="0.01"
                value={weights[key]}
                onChange={(e) => setWeights((w) => ({ ...w, [key]: Number(e.target.value) }))}
                className="mt-1"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="neon" disabled={pending} onClick={() => startTransition(async () => {
            const r = await saveAdminLeaderboardWeights(weights);
            if (r.success) appToast.saved();
          })}>Save weights</Button>
          <Button variant="outline" disabled={pending} onClick={() => startTransition(async () => {
            const r = await resetCreatorRankings();
            if (r.success) { appToast.saved(); router.refresh(); }
          })}>Recalculate all ranks</Button>
        </div>
      </Card>

      <Card className="glass p-6 space-y-4">
        <h3 className="font-semibold">Pin creators</h3>
        <div className="flex gap-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search creator" />
          <Button variant="outline" disabled={pending} onClick={() => startTransition(async () => {
            const r = await searchCreatorsForLeaderboard(search);
            if (r.success) setResults(r.data);
          })}>Search</Button>
        </div>
        {results.map((c) => (
          <div key={c.id} className="flex justify-between items-center text-sm border-b border-border/30 py-2">
            <span>@{c.user.username}</span>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => {
              const r = await pinCreatorOnLeaderboard(c.id, true);
              if (r.success) router.refresh();
            })}>Pin 7 days</Button>
          </div>
        ))}
        {pinned.length > 0 && (
          <div className="pt-4 space-y-2">
            <p className="text-xs text-muted-foreground uppercase">Currently pinned</p>
            {pinned.map((p) => (
              <div key={p.id} className="flex justify-between text-sm">
                <span>{p.user.displayName ?? p.user.username}</span>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => startTransition(async () => {
                  await pinCreatorOnLeaderboard(p.id, false);
                  router.refresh();
                })}>Unpin</Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
