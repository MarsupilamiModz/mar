import { RANK_CONFIG } from "@/lib/creator-ranking";
import type { CreatorRankTier } from "@prisma/client";
import { cn } from "@/lib/utils";

export function CreatorRankBadge({
  tier,
  size = "md",
  className,
}: {
  tier: CreatorRankTier;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const config = RANK_CONFIG[tier];
  const sizeClass = size === "sm" ? "text-[10px] px-1.5 py-0.5" : size === "lg" ? "text-sm px-3 py-1" : "text-xs px-2 py-0.5";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold uppercase tracking-wide",
        config.border,
        config.glow,
        sizeClass,
        className
      )}
      style={{ color: config.color, borderColor: `${config.color}80` }}
    >
      {config.label}
    </span>
  );
}
