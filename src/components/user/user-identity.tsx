"use client";

import { AchievementBadge } from "@/components/achievements/achievement-badge";
import { formatDisplayName } from "@/lib/display-name";
import type { InlineBadge } from "@/lib/user-badges";
import { cn } from "@/lib/utils";

type UserIdentityProps = {
  username: string;
  displayName?: string | null;
  badges?: InlineBadge[];
  size?: "sm" | "md";
  className?: string;
  nameClassName?: string;
  showBadges?: boolean;
};

export function UserIdentity({
  username,
  displayName,
  badges = [],
  size = "sm",
  className,
  nameClassName,
  showBadges = true,
}: UserIdentityProps) {
  const name = formatDisplayName({ username, displayName });

  return (
    <span className={cn("inline-flex items-center gap-1.5 min-w-0", className)}>
      <span className={cn("truncate font-medium", size === "md" ? "text-base" : "text-sm", nameClassName)}>{name}</span>
      {showBadges &&
        badges.map((b) => (
          <AchievementBadge
            key={b.id}
            name={b.name}
            icon={b.icon}
            rarity={b.rarity}
            animated={b.animated}
            glowEffect={b.glowEffect}
            size="sm"
            className="shrink-0 scale-75 origin-left -ml-1"
          />
        ))}
    </span>
  );
}
