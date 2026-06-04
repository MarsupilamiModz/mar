import type { CSSProperties } from "react";
import type { BannerAlign, BannerDisplayType } from "@prisma/client";

export type GameBannerConfig = {
  bannerDisplayType?: BannerDisplayType | null;
  bannerHeightPx?: number | null;
  bannerFocusX?: number | null;
  bannerFocusY?: number | null;
  bannerZoom?: number | null;
  bannerAlign?: BannerAlign | null;
};

export const BANNER_HEIGHT_PRESETS = [200, 300, 400, 500, 600] as const;

export function resolveBannerHeight(config: GameBannerConfig): number {
  const type = config.bannerDisplayType ?? "FEATURED";
  if (type === "SMALL") return 180;
  if (type === "FEATURED") return 420;
  if (type === "CUSTOM") {
    const h = config.bannerHeightPx ?? 400;
    return Math.min(800, Math.max(120, h));
  }
  return 420;
}

export function bannerObjectPosition(config: GameBannerConfig): string {
  const x = config.bannerFocusX ?? 50;
  const y = config.bannerFocusY ?? 50;
  const align = config.bannerAlign ?? "CENTER";

  if (align === "TOP") return `${x}% 0%`;
  if (align === "BOTTOM") return `${x}% 100%`;
  if (align === "LEFT") return `0% ${y}%`;
  if (align === "RIGHT") return `100% ${y}%`;
  return `${x}% ${y}%`;
}

export function bannerImageStyle(config: GameBannerConfig): CSSProperties {
  const zoom = config.bannerZoom ?? 1;
  return {
    objectPosition: bannerObjectPosition(config),
    transform: zoom !== 1 ? `scale(${zoom})` : undefined,
  };
}
