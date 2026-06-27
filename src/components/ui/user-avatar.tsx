"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { bustAvatarUrl, resolveAvatarDisplayUrl } from "@/lib/avatar-url";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  src?: string | null;
  name?: string | null;
  className?: string;
  fallbackClassName?: string;
};

function initialsFromName(name?: string | null): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

export function UserAvatar({ src, name, className, fallbackClassName }: UserAvatarProps) {
  const [broken, setBroken] = useState(false);
  const resolved = useMemo(() => resolveAvatarDisplayUrl(src), [src]);
  const displaySrc = useMemo(
    () => (resolved && !broken ? bustAvatarUrl(resolved) : null),
    [resolved, broken]
  );

  useEffect(() => {
    setBroken(false);
  }, [src]);

  const initials = initialsFromName(name);
  const hasImage = Boolean(displaySrc);

  return (
    <Avatar className={cn("shrink-0", className)}>
      {hasImage ? (
        <AvatarImage
          src={displaySrc!}
          alt={name ?? "User avatar"}
          onError={() => setBroken(true)}
        />
      ) : null}
      <AvatarFallback
        delayMs={hasImage ? 600 : 0}
        className={cn(
          "bg-neon-purple/20 text-neon-purple text-xs font-semibold",
          fallbackClassName
        )}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
