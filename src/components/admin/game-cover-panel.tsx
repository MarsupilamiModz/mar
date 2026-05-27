"use client";

import { useTransition } from "react";
import { saveGameCoverAdmin } from "@/actions/admin/branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useAppToast } from "@/hooks/use-app-toast";

type GameCoverPanelProps = {
  gameId: string;
  gameName: string;
  currentBanner?: string | null;
  coverOverride?: {
    accentColor?: string | null;
    backgroundGradient?: string | null;
    heroBannerUrl?: string | null;
  } | null;
};

export function GameCoverPanel({ gameId, gameName, currentBanner, coverOverride }: GameCoverPanelProps) {
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await saveGameCoverAdmin(gameId, fd);
      if (r.success) appToast.saved();
      else appToast.error(r.error);
    });
  };

  return (
    <Card className="glass p-6 space-y-4">
      <div>
        <h3 className="font-semibold">Game cover & branding</h3>
        <p className="text-sm text-muted-foreground">Hero banner, accent colors, and page styling for {gameName}.</p>
      </div>
      {(coverOverride?.heroBannerUrl || currentBanner) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverOverride?.heroBannerUrl ?? currentBanner ?? ""}
          alt=""
          className="w-full max-h-40 object-cover rounded-lg border border-border/40"
        />
      )}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-sm font-medium">Hero banner</label>
          <Input name="heroBanner" type="file" accept="image/*" className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium">Accent color</label>
          <Input
            name="accentColor"
            type="color"
            defaultValue={coverOverride?.accentColor ?? "#a855f7"}
            className="mt-1 h-10 w-24"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Background gradient (CSS)</label>
          <Input
            name="backgroundGradient"
            defaultValue={coverOverride?.backgroundGradient ?? ""}
            placeholder="linear-gradient(135deg, #1a1a2e, #16213e)"
            className="mt-1 font-mono text-xs"
          />
        </div>
        <Button type="submit" variant="neon" disabled={pending}>Save cover settings</Button>
      </form>
    </Card>
  );
}
