"use client";

import { useState, useTransition } from "react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  updateMalwareSettingsAdmin,
  approveScannedVersion,
  rejectScannedVersion,
} from "@/actions/admin/security";
import type { MalwareScannerSettings } from "@/lib/malware-settings";

type ScanLog = {
  id: string;
  fileName: string;
  status: string;
  detections: number;
  totalEngines: number;
  blocked: boolean;
  createdAt: Date;
  modVersion?: { id: string; version: string; mod: { slug: string; title: string } } | null;
};

type Props = {
  settings: MalwareScannerSettings & { hasKey: boolean };
  stats: {
    total: number;
    clean: number;
    suspicious: number;
    malware: number;
    blocked: number;
    recent: ScanLog[];
  };
};

export function SecurityCenterPanel({ settings, stats }: Props) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    virusTotalApiKey: settings.virusTotalApiKey,
    scanThreshold: settings.scanThreshold,
    autoApproveClean: settings.autoApproveClean,
    requireManualReviewSuspicious: settings.requireManualReviewSuspicious,
    enabled: settings.enabled,
  });

  function saveSettings() {
    startTransition(async () => {
      const r = await updateMalwareSettingsAdmin(form);
      if (r.success) toast({ title: "Security settings saved" });
      else toast({ title: r.error, variant: "destructive" });
    });
  }

  function review(versionId: string, action: "approve" | "reject") {
    startTransition(async () => {
      const r =
        action === "approve"
          ? await approveScannedVersion(versionId)
          : await rejectScannedVersion(versionId);
      if (r.success) toast({ title: action === "approve" ? "Version approved" : "Version rejected" });
      else toast({ title: r.error, variant: "destructive" });
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Total scans", value: stats.total },
          { label: "Clean", value: stats.clean },
          { label: "Suspicious", value: stats.suspicious },
          { label: "Malware", value: stats.malware },
          { label: "Blocked", value: stats.blocked },
        ].map((s) => (
          <Card key={s.label} className="glass">
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Malware Scanner Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-w-xl">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Scanner enabled</label>
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium">VirusTotal API Key</label>
            <Input
              type="password"
              placeholder={settings.hasKey ? "Key configured — enter to replace" : "Paste API key"}
              value={form.virusTotalApiKey}
              onChange={(e) => setForm((f) => ({ ...f, virusTotalApiKey: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Scan threshold (detections → malware)</label>
            <Input
              type="number"
              min={1}
              max={20}
              value={form.scanThreshold}
              onChange={(e) =>
                setForm((f) => ({ ...f, scanThreshold: Number(e.target.value) || 2 }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Auto-approve clean uploads</label>
            <Switch
              checked={form.autoApproveClean}
              onCheckedChange={(v) => setForm((f) => ({ ...f, autoApproveClean: v }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Require manual review for suspicious</label>
            <Switch
              checked={form.requireManualReviewSuspicious}
              onCheckedChange={(v) =>
                setForm((f) => ({ ...f, requireManualReviewSuspicious: v }))
              }
            />
          </div>
          <Button onClick={saveSettings} disabled={pending}>
            Save settings
          </Button>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Scan History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scans yet.</p>
          ) : (
            stats.recent.map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 pb-3 last:border-0"
              >
                <div>
                  <p className="font-medium text-sm">{log.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {log.modVersion
                      ? `${log.modVersion.mod.title} v${log.modVersion.version}`
                      : "Blocked upload"}
                    {" · "}
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={log.status === "CLEAN" ? "default" : "destructive"}>
                    {log.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {log.detections}/{log.totalEngines}
                  </span>
                  {log.modVersion &&
                    (log.status === "SUSPICIOUS" || log.status === "MANUAL_REVIEW") && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => review(log.modVersion!.id, "approve")}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={pending}
                          onClick={() => review(log.modVersion!.id, "reject")}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
