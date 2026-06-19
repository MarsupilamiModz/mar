import Link from "next/link";
import { getTrustCenterStats } from "@/actions/admin/trust";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePagePermission } from "@/lib/auth";
import type { Locale } from "@/i18n/config";

export default async function TrustSecurityCenterPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  await requirePagePermission("moderation.reports");
  const statsResult = await getTrustCenterStats();
  const stats = statsResult.success ? statsResult.data : null;

  const links = [
    { href: `/${locale}/admin/reports`, label: "Content Reports", desc: "Malware, abuse, copyright, and ToS violations" },
    { href: `/${locale}/admin/dmca`, label: "DMCA Management", desc: "Copyright claims and takedown workflow" },
    { href: `/${locale}/admin/security`, label: "Malware Security Center", desc: "VirusTotal scans, trusted files, security reviews" },
    { href: `/${locale}/admin/discovery`, label: "Discovery Management", desc: "Tags, search index, recommendation rules" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Trust & Security Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reports, DMCA, malware scanning, and platform trust metrics
        </p>
      </div>

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Open reports" value={stats.openReports} />
          <StatCard label="Malware (30d)" value={stats.malwareReports} />
          <StatCard label="Open DMCA" value={stats.openDMCA} />
          <StatCard label="Resolved (30d)" value={stats.resolvedReports} />
          <StatCard label="Search queries (30d)" value={stats.searchQueries} />
          <StatCard label="Rec. clicks (30d)" value={stats.recommendationClicks} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="glass h-full transition-colors hover:border-neon-purple/40">
              <CardHeader>
                <CardTitle className="text-base">{link.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{link.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
