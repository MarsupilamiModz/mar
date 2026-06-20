"use client";

import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";

function ChartSkeleton() {
  return <div className="h-56 animate-pulse rounded-lg bg-muted/30" />;
}

export const RevenueChart = dynamic(
  () => import("./ecosystem-charts-recharts").then((m) => ({ default: m.RevenueChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export const ConversionChart = dynamic(
  () => import("./ecosystem-charts-recharts").then((m) => ({ default: m.ConversionChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export function StatGrid({ stats }: { stats: { label: string; value: string; hint?: string }[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label} className="glass p-4 hover:border-neon-purple/30 transition-colors">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
          <p className="text-2xl font-bold mt-1 text-gradient">{s.value}</p>
          {s.hint && <p className="text-xs text-muted-foreground mt-1">{s.hint}</p>}
        </Card>
      ))}
    </div>
  );
}
