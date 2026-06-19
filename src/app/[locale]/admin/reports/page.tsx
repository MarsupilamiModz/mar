import { getAdminReports, getTrustCenterStats } from "@/actions/admin/trust";
import { ReportsAdminPanel } from "@/components/admin/reports-admin-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePagePermission } from "@/lib/auth";

export default async function AdminReportsPage() {
  await requirePagePermission("moderation.reports");
  const [reportsResult, statsResult] = await Promise.all([
    getAdminReports(),
    getTrustCenterStats(),
  ]);
  const reports = reportsResult.success ? reportsResult.data.reports : [];
  const stats = statsResult.success ? statsResult.data : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Content Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">User-submitted reports — malware, copyright, abuse, and more</p>
      </div>
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Open reports" value={stats.openReports} />
          <StatCard label="Malware (30d)" value={stats.malwareReports} />
          <StatCard label="Open DMCA" value={stats.openDMCA} />
          <StatCard label="Resolved (30d)" value={stats.resolvedReports} />
        </div>
      )}
      <ReportsAdminPanel reports={reports} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="glass">
      <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent><p className="text-2xl font-bold">{value}</p></CardContent>
    </Card>
  );
}
