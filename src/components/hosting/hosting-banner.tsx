"use client";

import type { ResolvedHostingPartner } from "@/lib/hosting/resolve";

type Props = {
  partner: ResolvedHostingPartner;
  modId?: string;
  collectionId?: string;
  gameId?: string;
  size?: "300x250" | "728x90" | "970x250" | "responsive";
  className?: string;
};

const SIZE_CLASS: Record<string, string> = {
  "300x250": "max-w-[300px] aspect-[300/250]",
  "728x90": "w-full max-w-[728px] aspect-[728/90]",
  "970x250": "w-full max-w-[970px] aspect-[970/250]",
  responsive: "w-full aspect-[3/1] max-h-64",
};

export function HostingBannerWidget({
  partner,
  modId,
  collectionId,
  gameId,
  size = "responsive",
  className = "",
}: Props) {
  const bannerUrl = partner.bannerAvifUrl ?? partner.bannerWebpUrl ?? partner.bannerUrl;
  if (!bannerUrl) return null;

  const trackAndOpen = () => {
    void fetch("/api/hosting/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partnerId: partner.partnerId,
        modId,
        collectionId,
        gameId,
        context: "BANNER",
      }),
    });
    window.open(partner.affiliateUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      type="button"
      onClick={trackAndOpen}
      className={`block overflow-hidden rounded-lg border border-border/40 hover:border-neon-purple/40 transition-colors ${SIZE_CLASS[size]} ${className}`}
      aria-label={`Hosting partner: ${partner.name}`}
    >
      <picture>
        {partner.bannerAvifUrl ? (
          <source srcSet={partner.bannerAvifUrl} type="image/avif" />
        ) : null}
        {partner.bannerWebpUrl ? (
          <source srcSet={partner.bannerWebpUrl} type="image/webp" />
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bannerUrl} alt={partner.name} className="h-full w-full object-cover" />
      </picture>
    </button>
  );
}
