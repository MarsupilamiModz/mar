import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { Card } from "@/components/ui/card";
export default async function AuditLogPage() {
  await requireAdmin();

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { username: true } } },
  });

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
    </div>
  );
}
