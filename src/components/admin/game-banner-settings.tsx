"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BannerAlign, BannerDisplayType } from "@prisma/client";
import { updateGameBannerSettings } from "@/actions/admin/games";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useAppToast } from "@/hooks/use-app-toast";
import { SafeImage } from "@/components/ui/safe-image";
import {
  BANNER_HEIGHT_PRESETS,
  bannerImageStyle,
  resolveBannerHeight,
} from "@/lib/game-banner";

type Props = {
  gameId: string;
  bannerUrl?: string | null;
  coverUrl?: string | null;
  settings: {
    bannerDisplayType: BannerDisplayType;
    bannerHeightPx?: number | null;
    bannerFocusX: number;
    bannerFocusY: number;
    bannerZoom: number;
    bannerAlign: BannerAlign;
  };
};

export function GameBannerSettings({ gameId, bannerUrl, coverUrl, settings }: Props) {
  const appToast = useAppToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [displayType, setDisplayType] = useState<BannerDisplayType>(settings.bannerDisplayType);
  const [heightPx, setHeightPx] = useState(settings.bannerHeightPx ?? 400);
  const [focusX, setFocusX] = useState(settings.bannerFocusX);
  const [focusY, setFocusY] = useState(settings.bannerFocusY);
  const [zoom, setZoom] = useState(settings.bannerZoom);
  const [align, setAlign] = useState<BannerAlign>(settings.bannerAlign);

  const previewConfig = useMemo(
    () => ({
      bannerDisplayType: displayType,
      bannerHeightPx: heightPx,
      bannerFocusX: focusX,
      bannerFocusY: focusY,
      bannerZoom: zoom,
      bannerAlign: align,
    }),
    [displayType, heightPx, focusX, focusY, zoom, align]
  );

  const previewHeight = resolveBannerHeight(previewConfig);
  const imageSrc = bannerUrl ?? coverUrl;

  function save() {
    startTransition(async () => {
      const r = await updateGameBannerSettings(gameId, {
        bannerDisplayType: displayType,
        bannerHeightPx: displayType === "CUSTOM" ? heightPx : null,
        bannerFocusX: focusX,
        bannerFocusY: focusY,
        bannerZoom: zoom,
        bannerAlign: align,
      });
      if (r.success) {
        appToast.saved();
        router.refresh();
      } else appToast.error(r.error);
    });
  }

  return (
    <Card className="glass p-6 space-y-6">
      <div>
        <h3 className="font-semibold">Banner display</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Control hero banner size, crop focus, and alignment on the game page.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Display type</label>
            <select
              value={displayType}
              onChange={(e) => setDisplayType(e.target.value as BannerDisplayType)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background/50 px-3 text-sm"
            >
              <option value="SMALL">Small banner (compact)</option>
              <option value="FEATURED">Featured banner (cinematic)</option>
              <option value="CUSTOM">Custom height</option>
            </select>
          </div>

          {displayType === "CUSTOM" && (
            <div>
              <label className="text-sm font-medium">Height (px)</label>
              <div className="flex flex-wrap gap-2 mt-2 mb-2">
                {BANNER_HEIGHT_PRESETS.map((h) => (
                  <Button
                    key={h}
                    type="button"
                    size="sm"
                    variant={heightPx === h ? "neon" : "outline"}
                    onClick={() => setHeightPx(h)}
                  >
                    {h}px
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                min={120}
                max={800}
                value={heightPx}
                onChange={(e) => setHeightPx(Number(e.target.value) || 400)}
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Alignment</label>
            <select
              value={align}
              onChange={(e) => setAlign(e.target.value as BannerAlign)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background/50 px-3 text-sm"
            >
              <option value="CENTER">Center</option>
              <option value="TOP">Top</option>
              <option value="BOTTOM">Bottom</option>
              <option value="LEFT">Left</option>
              <option value="RIGHT">Right</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Focus X ({focusX}%)</label>
              <Input
                type="range"
                min={0}
                max={100}
                value={focusX}
                onChange={(e) => setFocusX(Number(e.target.value))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Focus Y ({focusY}%)</label>
              <Input
                type="range"
                min={0}
                max={100}
                value={focusY}
                onChange={(e) => setFocusY(Number(e.target.value))}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Zoom ({zoom.toFixed(2)}×)</label>
            <Input
              type="range"
              min={1}
              max={2}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="mt-1"
            />
          </div>

          <Button type="button" variant="neon" disabled={pending} onClick={save}>
            Save banner settings
          </Button>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-2">Live preview</p>
          <div
            className="relative rounded-xl overflow-hidden border border-border/50 bg-muted/20"
            style={{ height: Math.min(previewHeight, 320) }}
          >
            {imageSrc ? (
              <SafeImage
                src={imageSrc}
                alt=""
                fill
                className="object-cover opacity-70"
                style={bannerImageStyle(previewConfig)}
                sizes="400px"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                Upload a banner or cover to preview
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
            <div className="absolute bottom-3 left-3 text-xs font-medium">
              {previewHeight}px · {displayType}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
