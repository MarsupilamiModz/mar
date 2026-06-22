import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { Card } from "@/components/ui/card";
import { parseAdminLimit, parseAdminPage } from "@/lib/admin-pagination";
import type { Locale } from "@/i18n/config";

export default async function AuditLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ page?: string; limit?: string }>;
}) {
  await requireAdmin();
  const { locale } = await params;
  const sp = await searchParams;
  const page = parseAdminPage(sp.page);
  const limit = parseAdminLimit(sp.limit);
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: { actor: { select: { username: true } } },
    }),
    prisma.auditLog.count(),
  ]);
  const pages = Math.ceil(total / limit) || 1;

  return (
    <div>
      <h1 className="text-2xl font-bold">Audit Logs</h1>
      <p className="mt-1 text-sm text-muted-foreground">Security and admin action history</p>
      <div className="mt-8 space-y-2">
        {logs.length === 0 ? (
          <Card className="glass p-8 text-center text-muted-foreground">No audit logs yet</Card>
        ) : (
          logs.map((log) => (
            <Card key={log.id} className="glass p-4 flex flex-wrap justify-between gap-2 text-sm">
              <div>
                <span className="font-medium text-neon-purple">{log.action}</span>
                <span className="text-muted-foreground"> · {log.entityType}</span>
                {log.entityId && <span className="text-muted-foreground"> · {log.entityId}</span>}
                {log.actor && <span className="ml-2">by @{log.actor.username}</span>}
              </div>
              <span className="text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
            </Card>
          ))
        )}
      </div>
      <AdminPagination
        page={page}
        pages={pages}
        total={total}
        limit={limit}
        basePath={`/${locale}/admin/audit`}
        searchParams={{ limit: String(limit) }}
        className="mt-6"
      />
    </div>
  );
}
