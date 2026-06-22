"use client";

import Link from "next/link";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSystemHealthRealtime } from "@/hooks/use-system-health-realtime";
import { cn } from "@/lib/utils";
import type { HealthLevel, HealthServiceStatus, SystemHealthSnapshot } from "@/lib/system-health-monitor";

const LEVEL_META: Record<
  HealthLevel,
  { label: string; badge: "premium" | "outline" | "destructive"; icon: typeof CheckCircle2; className: string }
> = {
  healthy: {
    label: "Healthy",
    badge: "premium",
    icon: CheckCircle2,
    className: "border-emerald-500/30 bg-emerald-500/5",
  },
  warning: {
    label: "Warning",
    badge: "outline",
    icon: AlertTriangle,
    className: "border-amber-500/30 bg-amber-500/5",
  },
  critical: {
    label: "Critical",
    badge: "destructive",
    icon: XCircle,
    className: "border-red-500/30 bg-red-500/5",
  },
};

function formatCheckedAt(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function ServiceCard({ service }: { service: HealthServiceStatus }) {
  const meta = LEVEL_META[service.level];
  const Icon = meta.icon;

  return (
    <Card className={cn("glass border p-4 transition-colors", meta.className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Icon
              className={cn(
                "h-4 w-4 shrink-0",
                service.level === "healthy" && "text-emerald-400",
                service.level === "warning" && "text-amber-400",
                service.level === "critical" && "text-red-400"
              )}
            />
            <p className="font-medium">{service.name}</p>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{service.detail}</p>
          {service.metrics && Object.keys(service.metrics).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(service.metrics).map(([key, value]) => (
                <span
                  key={key}
                  className="rounded-md bg-background/40 px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {key}: {String(value)}
                </span>
              ))}
            </div>
          )}
        </div>
        <Badge variant={meta.badge}>{meta.label}</Badge>
      </div>
    </Card>
  );
}

export function SystemHealthMonitor({ initial }: { initial: SystemHealthSnapshot }) {
  const { snapshot, refreshing, lastError, refresh } = useSystemHealthRealtime(initial);
  const overall = LEVEL_META[snapshot.overall];
  const OverallIcon = overall.icon;

  const counts = snapshot.services.reduce(
    (acc, service) => {
      acc[service.level] += 1;
      return acc;
    },
    { healthy: 0, warning: 0, critical: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge className="mb-2 bg-neon-purple/20 text-neon-purple border-neon-purple/40">
            Owner only
          </Badge>
          <h1 className="text-2xl font-bold">System Health</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live infrastructure status — active users, upload queues, storage, payments, and integrations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/owner">Owner panel</Link>
          </Button>
          <Button variant="ghost" size="sm" disabled={refreshing} onClick={() => void refresh()}>
            <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <Card className={cn("glass border p-5", overall.className)}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background/40">
              <OverallIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground">Overall status</p>
              <p className="text-2xl font-bold">{overall.label}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="premium">{counts.healthy} healthy</Badge>
            <Badge variant="outline">{counts.warning} warning</Badge>
            <Badge variant="destructive">{counts.critical} critical</Badge>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Activity className={cn("h-3.5 w-3.5", refreshing && "animate-pulse text-neon-purple")} />
            Auto-refresh every 15s
          </span>
          <span>Last checked {formatCheckedAt(snapshot.checkedAt)}</span>
          {lastError && <span className="text-destructive">{lastError}</span>}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {snapshot.services.map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </div>

      {snapshot.performance && (
        <Card className="glass border border-neon-purple/20 p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Performance Center</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Cache, server resources, and slow query telemetry.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border/40 bg-background/30 p-3">
              <p className="text-xs text-muted-foreground">Cache hit rate</p>
              <p className="text-xl font-bold">{snapshot.performance.cacheHitRate}%</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {snapshot.performance.cacheHits} hits / {snapshot.performance.cacheMisses} misses
              </p>
            </div>
            <div className="rounded-lg border border-border/40 bg-background/30 p-3">
              <p className="text-xs text-muted-foreground">Server RAM</p>
              <p className="text-xl font-bold">{snapshot.performance.serverRamUsedPercent}%</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {snapshot.performance.serverRamUsedGb} GB / {snapshot.performance.serverRamTotalGb} GB
              </p>
            </div>
            <div className="rounded-lg border border-border/40 bg-background/30 p-3">
              <p className="text-xs text-muted-foreground">DB latency</p>
              <p className="text-xl font-bold">{snapshot.platform?.dbLatencyMs ?? "—"} ms</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {snapshot.performance.cpuCount} CPU cores
              </p>
            </div>
            <div className="rounded-lg border border-border/40 bg-background/30 p-3">
              <p className="text-xs text-muted-foreground">Slow queries (recent)</p>
              <p className="text-xl font-bold">{snapshot.performance.slowQueryCount}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                avg {snapshot.performance.avgSlowQueryMs} ms
              </p>
            </div>
          </div>
          {snapshot.slowQueries && snapshot.slowQueries.length > 0 && (
            <div className="rounded-lg border border-border/40 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-background/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Label</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-right">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.slowQueries.slice(0, 8).map((row) => (
                    <tr key={row.id} className="border-t border-border/30">
                      <td className="px-3 py-2 font-mono">{row.label}</td>
                      <td className="px-3 py-2">{row.kind}</td>
                      <td className="px-3 py-2 text-right">{row.durationMs} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
