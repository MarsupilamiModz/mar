"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TicketQueueLink } from "@/components/admin/ticket-queue-nav";

type Stats = {
  openTickets: number;
  unassigned: number;
  assigned: number;
  slaViolations: number;
  pendingResponses: number;
  resolvedToday: number;
  avgResponseMinutes: number;
};

export function TicketDashboardWidgets({ stats, locale }: { stats: Stats; locale: string }) {
  const widgets = [
    { label: "Open tickets", value: stats.openTickets, accent: "text-neon-purple", queue: "open" as const },
    { label: "Unassigned", value: stats.unassigned, accent: "text-amber-400", queue: "unassigned" as const },
    { label: "Assigned", value: stats.assigned, accent: "text-neon-blue", queue: "open" as const },
    { label: "SLA violations", value: stats.slaViolations, accent: "text-destructive", queue: "escalated" as const },
    { label: "Pending responses", value: stats.pendingResponses, accent: "text-orange-400", queue: "waiting_user" as const },
    { label: "Resolved today", value: stats.resolvedToday, accent: "text-emerald-400", queue: "solved" as const },
    {
      label: "Avg response time",
      value: stats.avgResponseMinutes > 0 ? `${stats.avgResponseMinutes}m` : "—",
      accent: "text-muted-foreground",
      queue: "all" as const,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {widgets.map((w) => (
        <Card key={w.label} className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{w.label}</CardTitle>
          </CardHeader>
          <CardContent>
            {w.label === "Avg response time" ? (
              <p className={`text-2xl font-bold ${w.accent}`}>{w.value}</p>
            ) : (
              <TicketQueueLink
                locale={locale}
                queue={w.queue}
                value={w.value}
                accent={w.accent}
              />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
