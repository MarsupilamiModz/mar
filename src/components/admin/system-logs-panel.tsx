"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearAdminSystemLogs } from "@/actions/admin/system";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppToast } from "@/hooks/use-app-toast";
import { formatDateTime } from "@/lib/format-locale";
import type { PlatformErrorEntry } from "@/lib/platform-log";

type HealthCheck = { name: string; ok: boolean; detail?: string };

export function SystemLogsPanel({
  locale,
  logs,
  health,
}: {
  locale: string;
  logs: PlatformErrorEntry[];
  health: HealthCheck[];
}) {
  const appToast = useAppToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <Card className="glass p-6">
        <h3 className="font-semibold mb-4">Platform health</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {health.map((check) => (
            <div
              key={check.name}
              className="rounded-lg border border-border/40 bg-background/30 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{check.name}</span>
                <Badge variant={check.ok ? "premium" : "destructive"}>
                  {check.ok ? "OK" : "Issue"}
                </Badge>
              </div>
              {check.detail && (
                <p className="mt-1 text-xs text-muted-foreground">{check.detail}</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="glass p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold">Recent errors</h3>
          <Button
            variant="outline"
            size="sm"
            disabled={pending || logs.length === 0}
            onClick={() =>
              startTransition(async () => {
                const r = await clearAdminSystemLogs();
                if (r.success) {
                  appToast.saved();
                  router.refresh();
                } else appToast.error(r.error);
              })
            }
          >
            Clear logs
          </Button>
        </div>

        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No platform errors logged.</p>
        ) : (
          <div className="space-y-2 max-h-[480px] overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-lg border border-border/30 bg-background/20 p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="outline">{log.context}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(log.createdAt, locale)}
                  </span>
                </div>
                <p className="mt-2 text-xs break-words">{log.message}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
