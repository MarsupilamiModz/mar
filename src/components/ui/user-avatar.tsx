"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveAvatarUrl } from "@/lib/assets";
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
  const resolved = resolveAvatarUrl(src);
  const initials = initialsFromName(name);

  return (
    <Avatar className={cn("shrink-0", className)}>
      <AvatarImage src={resolved} alt={name ?? "User avatar"} />
      <AvatarFallback className={cn("bg-neon-purple/20 text-neon-purple text-xs font-medium", fallbackClassName)}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
