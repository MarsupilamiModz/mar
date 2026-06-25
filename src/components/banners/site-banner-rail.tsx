"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { SiteBannerFrequency } from "@prisma/client";
import { SafeImage } from "@/components/ui/safe-image";
import { Button } from "@/components/ui/button";
import { bannerStorageKey, FREQUENCY_MS } from "@/lib/site-banner-utils";

export type SiteBannerData = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  buttonText: string | null;
  frequency: SiteBannerFrequency;
};

function shouldShowBanner(banner: SiteBannerData): boolean {
  if (typeof window === "undefined") return true;
  const key = bannerStorageKey(banner.id, banner.frequency);
  const stored = localStorage.getItem(key);
  const now = Date.now();

  switch (banner.frequency) {
    case "ALWAYS":
      return true;
    case "ONCE_SESSION": {
      if (sessionStorage.getItem(key)) return false;
      return true;
    }
    case "ONCE_DAY": {
      if (!stored) return true;
      const ts = Number(stored);
      return Number.isNaN(ts) || now - ts > 86400000;
    }
    case "EVERY_5_MIN":
    case "EVERY_15_MIN": {
      const interval = FREQUENCY_MS[banner.frequency] ?? 0;
      if (!stored) return true;
      const ts = Number(stored);
      return Number.isNaN(ts) || now - ts >= interval;
    }
    default:
      return true;
  }
}

function markBannerSeen(banner: SiteBannerData) {
  const key = bannerStorageKey(banner.id, banner.frequency);
  const now = String(Date.now());
  if (banner.frequency === "ONCE_SESSION") {
    sessionStorage.setItem(key, now);
  } else if (banner.frequency !== "ALWAYS") {
    localStorage.setItem(key, now);
  }
}

export function SiteBannerRail({ banners }: { banners: SiteBannerData[] }) {
  const [visible, setVisible] = useState<SiteBannerData[]>([]);

  useEffect(() => {
    setVisible(banners.filter(shouldShowBanner));
  }, [banners]);

  const dismiss = useCallback((banner: SiteBannerData) => {
    markBannerSeen(banner);
    setVisible((prev) => prev.filter((b) => b.id !== banner.id));
  }, []);

  if (!visible.length) return null;

  return (
    <div className="space-y-2">
      {visible.map((banner) => (
        <div
          key={banner.id}
          className="relative border-b border-neon-purple/20 bg-gradient-to-r from-neon-purple/10 to-transparent"
        >
          <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
            {banner.imageUrl && (
              <div className="relative hidden h-12 w-20 shrink-0 overflow-hidden rounded-md sm:block">
                <SafeImage src={banner.imageUrl} alt="" fill className="object-cover" sizes="80px" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm">{banner.title}</p>
              {banner.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{banner.description}</p>
              )}
            </div>
            {banner.linkUrl && (
              <Button variant="outline" size="sm" asChild className="shrink-0">
                <Link href={banner.linkUrl}>{banner.buttonText ?? "Learn more"}</Link>
              </Button>
            )}
            <button
              type="button"
              aria-label="Dismiss"
              className="shrink-0 rounded-md p-1 hover:bg-white/5"
              onClick={() => dismiss(banner)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
