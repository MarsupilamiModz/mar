"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DiagnosticsData = {
  userId: string | null;
  supabaseId: string | null;
  email: string | null;
  role: string | null;
  permissionGroup: { id: string; name: string; slug: string } | null;
  permissions: string[];
  sessionActive: boolean;
  prismaLinked: boolean;
  isBanned: boolean;
  isSuspended: boolean;
  db: { ok: boolean; detail?: string };
  moderationLogTable: boolean;
  authProvider: string;
  env: { supabaseUrl: boolean; r2Configured: boolean };
};

export function AdminDiagnosticsPanel({ data }: { data: DiagnosticsData }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Auth Diagnostics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Session, role, and permission state for the current admin session.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="User ID" value={data.userId} />
            <Row label="Supabase ID" value={data.supabaseId} />
            <Row label="Email" value={data.email} />
            <Row label="Role" value={data.role} highlight />
            <Row label="Auth provider" value={data.authProvider} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <StatusRow label="Supabase session" ok={data.sessionActive} />
            <StatusRow label="Prisma user linked" ok={data.prismaLinked} />
            <StatusRow label="Database" ok={data.db.ok} detail={data.db.detail} />
            <StatusRow label="R2 configured" ok={data.env.r2Configured} />
            <StatusRow label="Moderation log table" ok={data.moderationLogTable} />
            {data.isBanned && <Badge variant="destructive">Banned</Badge>}
            {data.isSuspended && <Badge variant="secondary">Suspended</Badge>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Permission group</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {data.permissionGroup ? (
            <p>
              {data.permissionGroup.name}{" "}
              <span className="text-muted-foreground">({data.permissionGroup.slug})</span>
            </p>
          ) : (
            <p className="text-muted-foreground">No custom permission group assigned.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Effective permissions ({data.permissions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {data.permissions.map((p) => (
              <Badge key={p} variant="outline" className="font-mono text-[10px]">
                {p}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string | null; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? "font-semibold text-neon-purple" : "font-mono text-xs truncate max-w-[60%] text-right"}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <div className="text-right">
        <Badge variant={ok ? "default" : "destructive"}>{ok ? "OK" : "Issue"}</Badge>
        {detail && !ok && <p className="text-xs text-destructive mt-1 max-w-[220px]">{detail}</p>}
      </div>
    </div>
  );
}
