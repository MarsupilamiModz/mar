"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";

export function RevenueChart({
  data,
  title,
}: {
  data: { date: string; revenue: number; conversions: number }[];
  title: string;
}) {
  return (
    <Card className="glass p-4">
      <h3 className="text-sm font-medium mb-4 text-muted-foreground">{title}</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#888" tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fontSize: 10 }} stroke="#888" />
            <Tooltip
              contentStyle={{ background: "rgba(10,10,20,0.95)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 8 }}
            />
            <Area type="monotone" dataKey="revenue" stroke="#a855f7" fill="url(#revGrad)" name="Revenue (¢)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function ConversionChart({
  data,
  title,
}: {
  data: { date: string; clicks: number; conversions: number }[];
  title: string;
}) {
  return (
    <Card className="glass p-4">
      <h3 className="text-sm font-medium mb-4 text-muted-foreground">{title}</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#888" tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fontSize: 10 }} stroke="#888" />
            <Tooltip
              contentStyle={{ background: "rgba(10,10,20,0.95)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 8 }}
            />
            <Bar dataKey="clicks" fill="#3b82f6" name="Clicks" radius={[4, 4, 0, 0]} />
            <Bar dataKey="conversions" fill="#a855f7" name="Conversions" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
