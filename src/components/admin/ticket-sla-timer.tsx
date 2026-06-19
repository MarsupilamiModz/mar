"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { getSlaTimerState } from "@/lib/sla";
import { cn } from "@/lib/utils";

export function TicketSlaTimer({
  dueAt,
  met,
  resolved,
  label,
  className,
}: {
  dueAt: Date | string | null | undefined;
  met: boolean;
  resolved: boolean;
  label: string;
  className?: string;
}) {
  const due = dueAt ? new Date(dueAt) : null;
  const [, tick] = useState(0);

  useEffect(() => {
    if (!due || met || resolved) return;
    const id = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, [due, met, resolved]);

  const state = getSlaTimerState(due, met, resolved);
  if (!state) return null;

  return (
    <div className={cn("space-y-0.5", className)}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <Badge
        variant="outline"
        className={cn(
          "text-xs font-normal",
          state.variant === "overdue" && "border-destructive/50 text-destructive",
          state.variant === "warning" && "border-amber-500/50 text-amber-600",
          state.variant === "met" && "border-emerald-500/50 text-emerald-600",
          state.variant === "ok" && "border-border/50"
        )}
      >
        {state.label}
      </Badge>
    </div>
  );
}
