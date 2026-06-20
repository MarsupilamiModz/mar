"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RevenueChart } from "@/components/analytics/ecosystem-charts";
import { formatNumber } from "@/lib/format-locale";
import { upsertMembershipCampaign } from "@/actions/admin/owner";
import { toast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

import type { getOwnerControlCenterData } from "@/actions/admin/owner";

type OwnerData = Extract<
  Awaited<ReturnType<typeof getOwnerControlCenterData>>,
  { success: true }
>["data"];

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="glass p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </Card>
  );
}

export function OwnerControlCenter({ data }: { data: OwnerData }) {
  const router = useRouter();
  const [campaignForm, setCampaignForm] = useState({
    slug: "",
    title: "",
    totalSlots: "150",
    priceCents: "9999",
    badgeLabel: "Lifetime",
    bannerText: "",
  });

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    const r = await upsertMembershipCampaign({
      slug: campaignForm.slug,
      title: campaignForm.title,
      badgeLabel: campaignForm.badgeLabel,
      priceCents: Number(campaignForm.priceCents),
      totalSlots: Number(campaignForm.totalSlots),
      bannerText: campaignForm.bannerText || undefined,
      isVisible: true,
      isActive: true,
    });
    if (r.success) {
      toast({ title: "Campaign created" });
      router.refresh();
    } else {
      toast({ title: r.error, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <Badge className="mb-2 bg-neon-purple/20 text-neon-purple border-neon-purple/40">Owner only</Badge>
        <h1 className="text-2xl font-bold">Owner Control Center</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Platform analytics, auth diagnostics, and lifetime membership campaigns.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Website visitors</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Today" value={formatNumber(data.visitors.today)} sub={`${data.visitors.uniqueToday} unique`} />
          <StatCard label="Last 3 days" value={formatNumber(data.visitors.last3Days)} />
          <StatCard label="Last 7 days" value={formatNumber(data.visitors.last7Days)} />
          <StatCard label="Last 14 days" value={formatNumber(data.visitors.last14Days)} />
          <StatCard label="Last 30 days" value={formatNumber(data.visitors.last30Days)} />
          <StatCard label="Last 90 days" value={formatNumber(data.visitors.last90Days)} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold mb-3">Downloads</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Today" value={formatNumber(data.downloads.today)} />
            <StatCard label="Week" value={formatNumber(data.downloads.week)} />
            <StatCard label="Month" value={formatNumber(data.downloads.month)} />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-3">Memberships (active)</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Premium Lite" value={formatNumber(data.memberships.premiumLite)} />
            <StatCard label="Premium" value={formatNumber(data.memberships.premium)} />
            <StatCard label="Premium Max" value={formatNumber(data.memberships.premiumMax)} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Revenue (mod purchases)</h2>
        <div className="grid gap-3 sm:grid-cols-3 mb-4">
          <StatCard label="Daily" value={`€${data.revenue.daily.toFixed(2)}`} />
          <StatCard label="Weekly" value={`€${data.revenue.weekly.toFixed(2)}`} />
          <StatCard label="Monthly" value={`€${data.revenue.monthly.toFixed(2)}`} />
        </div>
        {data.revenue.series.length > 0 && (
          <RevenueChart data={data.revenue.series.map((r) => ({ ...r, conversions: 0 }))} title="30-day revenue" />
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Trust & discovery (30d)</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-4">
          <StatCard label="Open reports" value={formatNumber(data.trust.openReports)} />
          <StatCard label="Malware reports" value={formatNumber(data.trust.malwareReports)} />
          <StatCard label="Open DMCA" value={formatNumber(data.trust.openDMCA)} />
          <StatCard label="Search queries" value={formatNumber(data.trust.searchQueries)} />
          <StatCard label="Rec. clicks" value={formatNumber(data.trust.recommendationClicks)} />
          <StatCard label="Mod dependencies" value={formatNumber(data.trust.dependencyLinks)} />
        </div>
        {data.trust.topSearchQueries.length > 0 && (
          <Card className="glass p-4">
            <h3 className="font-medium mb-2 text-sm">Top search queries</h3>
            <ul className="space-y-1 text-sm">
              {data.trust.topSearchQueries.map((q) => (
                <li key={q.query} className="flex justify-between">
                  <span className="text-muted-foreground truncate mr-4">{q.query}</span>
                  <span className="tabular-nums">{formatNumber(q.count)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="glass p-4">
          <h2 className="text-lg font-semibold mb-3">Operations</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Open tickets" value={formatNumber(data.tickets.open)} />
            <StatCard label="Tickets (30d)" value={formatNumber(data.tickets.volume30d)} />
            <StatCard label="Custom orders pending" value={formatNumber(data.customOrdersPending)} />
            <StatCard label="Auth failures (7d)" value={formatNumber(data.auth.failures7d)} />
          </div>
        </Card>

        <Card className="glass p-4">
          <h2 className="text-lg font-semibold mb-3">Auth diagnostics</h2>
          <div className="max-h-48 overflow-y-auto space-y-2 text-xs font-mono">
            {data.auth.recent.length === 0 && (
              <p className="text-muted-foreground">No auth events logged yet.</p>
            )}
            {data.auth.recent.map((log) => (
              <div key={log.id} className="border-b border-border/30 pb-1">
                <span className="text-muted-foreground">{log.createdAt.toISOString()}</span>{" "}
                <span className="text-neon-purple">{log.action}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Lifetime membership campaigns</h2>
        <div className="grid gap-3 mb-6">
          {data.campaigns.map((c) => (
            <Card key={c.id} className="glass p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{c.title}</p>
                <p className="text-sm text-muted-foreground">
                  {c.remaining} / {c.totalSlots} remaining · €{(c.priceCents / 100).toFixed(2)}
                </p>
              </div>
              <Badge variant={c.isActive ? "default" : "secondary"}>
                {c.isActive ? "Active" : "Inactive"}
              </Badge>
            </Card>
          ))}
        </div>

        <Card className="glass p-4">
          <h3 className="font-medium mb-3">New campaign</h3>
          <form onSubmit={createCampaign} className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Slug" value={campaignForm.slug} onChange={(e) => setCampaignForm({ ...campaignForm, slug: e.target.value })} required />
            <Input placeholder="Title" value={campaignForm.title} onChange={(e) => setCampaignForm({ ...campaignForm, title: e.target.value })} required />
            <Input placeholder="Slots" type="number" value={campaignForm.totalSlots} onChange={(e) => setCampaignForm({ ...campaignForm, totalSlots: e.target.value })} />
            <Input placeholder="Price (cents)" type="number" value={campaignForm.priceCents} onChange={(e) => setCampaignForm({ ...campaignForm, priceCents: e.target.value })} />
            <Input placeholder="Badge label" value={campaignForm.badgeLabel} onChange={(e) => setCampaignForm({ ...campaignForm, badgeLabel: e.target.value })} />
            <Input placeholder="Banner text" value={campaignForm.bannerText} onChange={(e) => setCampaignForm({ ...campaignForm, bannerText: e.target.value })} />
            <Button type="submit" className="sm:col-span-2">Create campaign</Button>
          </form>
        </Card>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Quick links</h2>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link href="/admin/owner/health">Health monitor</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/admin/system">System health</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/admin/trust">Trust & Security</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/admin/discovery">Discovery</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/admin/security">Malware security</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/admin/groups">Permission matrix</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/admin/diagnostics">Auth diagnostics</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/admin/audit">Audit logs</Link></Button>
        </div>
      </section>
    </div>
  );
}
