"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Stats = {
  openTickets: number;
  unassigned: number;
  assigned: number;
  slaViolations: number;
  pendingResponses: number;
  resolvedToday: number;
  avgResponseMinutes: number;
};

export function TicketDashboardWidgets({ stats }: { stats: Stats }) {
  const widgets = [
    { label: "Open tickets", value: stats.openTickets, accent: "text-neon-purple" },
    { label: "Unassigned", value: stats.unassigned, accent: "text-amber-400" },
    { label: "Assigned", value: stats.assigned, accent: "text-neon-blue" },
    { label: "SLA violations", value: stats.slaViolations, accent: "text-destructive" },
    { label: "Pending responses", value: stats.pendingResponses, accent: "text-orange-400" },
    { label: "Resolved today", value: stats.resolvedToday, accent: "text-emerald-400" },
    {
      label: "Avg response time",
      value: stats.avgResponseMinutes > 0 ? `${stats.avgResponseMinutes}m` : "—",
      accent: "text-muted-foreground",
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
            <p className={`text-2xl font-bold ${w.accent}`}>{w.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
