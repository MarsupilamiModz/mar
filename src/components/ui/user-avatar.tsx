"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getMediaUrl, getMediaProxyFallback } from "@/lib/media-url";
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
  const [useProxy, setUseProxy] = useState(false);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setUseProxy(false);
    setBroken(false);
  }, [src]);

  const primary = getMediaUrl(src);
  const resolved = useProxy ? getMediaProxyFallback(src) : primary;
  const displaySrc = src?.trim() && !broken ? resolved ?? undefined : undefined;
  const initials = initialsFromName(name);

  if (!displaySrc) {
    return (
      <Avatar className={cn("shrink-0", className)}>
        <AvatarFallback
          className={cn(
            "bg-neon-purple/20 text-neon-purple text-xs font-medium",
            fallbackClassName
          )}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
    );
  }

  return (
    <Avatar className={cn("shrink-0", className)}>
      <AvatarImage
        src={displaySrc}
        alt={name ?? "User avatar"}
        onError={() => {
          if (!useProxy && getMediaProxyFallback(src)) {
            setUseProxy(true);
            return;
          }
          setBroken(true);
        }}
      />
      {broken ? (
        <AvatarFallback
          className={cn(
            "bg-neon-purple/20 text-neon-purple text-xs font-medium",
            fallbackClassName
          )}
        >
          {initials}
        </AvatarFallback>
      ) : null}
    </Avatar>
  );
}
