"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { resolveAssetUrl } from "@/lib/assets";
import type { AdFormat, AdProviderType } from "@prisma/client";

export type AdPlacementData = {
  id: string;
  slug: string;
  name: string;
  format: AdFormat;
  provider: AdProviderType;
  providerConfig?: unknown;
  customHtml?: string | null;
  imageUrl?: string | null;
  linkUrl?: string | null;
  width?: number | null;
  height?: number | null;
  mobileOnly?: boolean;
  desktopOnly?: boolean;
};

type AdSlotProps = {
  ad: AdPlacementData;
  className?: string;
  lazy?: boolean;
};

export function AdSlot({ ad, className, lazy = true }: AdSlotProps) {
  const ref = useRef<HTMLDivElement>(null);
  const tracked = useRef(false);

  useEffect(() => {
    if (!lazy || tracked.current) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !tracked.current) {
          tracked.current = true;
          fetch("/api/ads/impression", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ adId: ad.id }),
          }).catch(() => null);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ad.id, lazy]);

  const handleClick = () => {
    fetch("/api/ads/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adId: ad.id }),
    }).catch(() => null);
  };

  const minH = ad.height ?? (ad.format === "SIDEBAR" ? 250 : ad.format === "MOBILE" ? 50 : 90);

  return (
    <div
      ref={ref}
      className={cn(
        "ad-slot relative overflow-hidden rounded-lg border border-border/30 bg-muted/10",
        ad.mobileOnly && "md:hidden",
        ad.desktopOnly && "hidden md:block",
        className
      )}
      style={{ minHeight: minH }}
      data-ad-slug={ad.slug}
    >
      {ad.customHtml ? (
        <div
          className="text-xs"
          dangerouslySetInnerHTML={{ __html: ad.customHtml }}
        />
      ) : ad.imageUrl && ad.linkUrl ? (
        <Link href={ad.linkUrl} target="_blank" rel="noopener sponsored" onClick={handleClick}>
          <div className="relative w-full" style={{ minHeight: minH }}>
            <Image
              src={resolveAssetUrl(ad.imageUrl)!}
              alt={ad.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 300px"
              loading="lazy"
            />
          </div>
        </Link>
      ) : ad.provider === "ADSENSE" ? (
        <ins
          className="adsbygoogle block"
          style={{ display: "block", minHeight: minH }}
          data-ad-client={(ad.providerConfig as { clientId?: string })?.clientId}
          data-ad-slot={(ad.providerConfig as { slotId?: string })?.slotId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      ) : (
        <div className="flex h-full min-h-[inherit] items-center justify-center p-4 text-center text-xs text-muted-foreground">
          {ad.name}
        </div>
      )}
    </div>
  );
}
