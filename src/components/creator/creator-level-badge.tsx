"use client";

import { useTranslations } from "next-intl";
import type { PublisherLevel } from "@prisma/client";
import { CREATOR_LEVELS } from "@/lib/creator-levels";
import { cn } from "@/lib/utils";

export function CreatorLevelBadge({
  level,
  size = "sm",
  className,
}: {
  level: PublisherLevel;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const t = useTranslations("ecosystem");
  const config = CREATOR_LEVELS[level];
  if (!config || level === "UNVERIFIED") return null;

  const sizeClass =
    size === "xs" ? "text-[10px] px-1.5 py-0.5" : size === "md" ? "text-sm px-3 py-1" : "text-xs px-2 py-0.5";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-wide",
        "bg-background/60 backdrop-blur-sm border",
        config.borderClass,
        config.glowClass,
        sizeClass,
        level === "VERIFIED" && "text-emerald-400",
        level === "TRUSTED" && "text-orange-400",
        level === "ELITE" && "text-neon-purple",
        level === "OFFICIAL_PARTNER" && "text-neon-blue",
        className
      )}
    >
      <span aria-hidden>{config.icon}</span>
      {t(config.badgeKey)}
    </span>
  );
}

export function CreatorCardFrame({
  level,
  children,
  className,
}: {
  level: PublisherLevel;
  children: React.ReactNode;
  className?: string;
}) {
  const config = CREATOR_LEVELS[level];
  return (
    <div
      className={cn(
        "rounded-xl transition-all duration-300",
        config?.borderClass,
        config?.cardClass,
        config?.glowClass,
        className
      )}
    >
      {children}
    </div>
  );
}
