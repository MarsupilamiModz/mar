"use client";

import { Shield, ShieldCheck, ShieldAlert, ShieldX, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getSecurityBadgeKey,
  getSecurityBadgeVariant,
  isSecurityVerified,
  type SecurityBadgeKey,
} from "@/lib/security/status";
import type { FileScanStatus } from "@prisma/client";

type Props = {
  scanStatus: FileScanStatus;
  isTrusted?: boolean;
  compact?: boolean;
  className?: string;
};

const ICONS = {
  success: ShieldCheck,
  warning: ShieldAlert,
  danger: ShieldX,
  neutral: Shield,
  info: Loader2,
} as const;

export function SecurityBadge({ scanStatus, isTrusted = false, compact = false, className }: Props) {
  const t = useTranslations("security");
  const key = getSecurityBadgeKey(scanStatus, isTrusted);
  const variant = getSecurityBadgeVariant(scanStatus);
  const Icon = ICONS[variant];

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 font-normal",
        variant === "success" && "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
        variant === "warning" && "border-amber-500/40 text-amber-400 bg-amber-500/10",
        variant === "danger" && "border-red-500/40 text-red-400 bg-red-500/10",
        variant === "info" && "border-blue-500/40 text-blue-400 bg-blue-500/10",
        className
      )}
    >
      <Icon className={cn("h-3 w-3", variant === "info" && "animate-spin")} />
      {!compact && t(`badges.${key}` as `badges.${SecurityBadgeKey}`)}
    </Badge>
  );
}

export function SecurityVerifiedIcon({
  scanStatus,
  isTrusted = false,
  className,
}: {
  scanStatus: FileScanStatus;
  isTrusted?: boolean;
  className?: string;
}) {
  if (!isSecurityVerified(scanStatus, isTrusted)) return null;
  return <ShieldCheck className={cn("h-3.5 w-3.5 text-emerald-400", className)} />;
}
