"use client";

import {
  Youtube,
  Twitch,
  Instagram,
  Globe,
  MessageCircle,
} from "lucide-react";
import type { SocialPlatform } from "@prisma/client";
import { SOCIAL_COLORS, SOCIAL_LABELS } from "@/lib/affiliate";
import { cn } from "@/lib/utils";

type Link = { platform: SocialPlatform; url: string };

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1-.07z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const ICONS: Record<SocialPlatform, React.ComponentType<{ className?: string }>> = {
  YOUTUBE: Youtube,
  TWITCH: Twitch,
  TIKTOK: TikTokIcon,
  INSTAGRAM: Instagram,
  TWITTER: XIcon,
  DISCORD: MessageCircle,
  WEBSITE: Globe,
};

export function SocialLinks({
  links,
  size = "md",
  className,
}: {
  links: Link[];
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  if (!links.length) return null;

  const sizeClass =
    size === "sm" ? "h-8 w-8 [&_svg]:h-3.5 [&_svg]:w-3.5" : size === "lg" ? "h-12 w-12 [&_svg]:h-5 [&_svg]:w-5" : "h-10 w-10 [&_svg]:h-4 [&_svg]:w-4";

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {links.map((link) => {
        const Icon = ICONS[link.platform];
        return (
          <a
            key={link.platform}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            title={SOCIAL_LABELS[link.platform]}
            className={cn(
              "inline-flex items-center justify-center rounded-xl border border-border/50 bg-background/40 backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:shadow-neon",
              sizeClass,
              SOCIAL_COLORS[link.platform]
            )}
          >
            <Icon className="h-4 w-4" />
          </a>
        );
      })}
    </div>
  );
}
