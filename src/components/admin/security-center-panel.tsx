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
  markVersionTrusted,
  requestVersionReview,
  reprocessVersionScan,
  removeVersionScan,
  bulkApproveVersions,
  bulkRejectVersions,
  exportSecurityReport,
  triggerScanWorker,
} from "@/actions/admin/security";
import type { MalwareScannerSettings } from "@/lib/malware-settings";
import { SecurityBadge } from "@/components/security/security-badge";
import type { FileScanStatus } from "@prisma/client";

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

type PendingApproval = {
  id: string;
  version: string;
  fileName: string;
  scanStatus: FileScanStatus;
  createdAt: Date;
  mod: { id: string; slug: string; title: string };
  trustedFile: { id: string } | null;
};

type AuditLog = {
  id: string;
  action: string;
  createdAt: Date;
  modVersionId: string | null;
  modId: string | null;
  user?: { username: string; displayName: string | null } | null;
};

type Props = {
  settings: MalwareScannerSettings & { hasKey: boolean };
  stats: {
    total: number;
    clean: number;
    suspicious: number;
    malware: number;
    blocked: number;
    pendingReviews: number;
    approved: number;
    rejected: number;
    failedScans: number;
    scannedToday: number;
    quota: {
      requestsUsed: number;
      uploadsUsed: number;
      requestsLimit: number;
      uploadsLimit: number;
      requestsRemaining: number;
      uploadsRemaining: number;
    };
    recent: ScanLog[];
    pendingApprovals: PendingApproval[];
    auditRecent: AuditLog[];
  };
};

export function SecurityCenterPanel({ settings, stats }: Props) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>([]);
  const [tab, setTab] = useState<"approvals" | "history" | "audit" | "settings">("approvals");
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

  function runWorker() {
    startTransition(async () => {
      const r = await triggerScanWorker();
      if (r.success) toast({ title: `Processed ${r.data.processed} scan jobs` });
      else toast({ title: r.error, variant: "destructive" });
    });
  }

  function exportReport() {
    startTransition(async () => {
      const r = await exportSecurityReport();
      if (!r.success) {
        toast({ title: r.error, variant: "destructive" });
        return;
      }
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `security-report-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function review(
    versionId: string,
    action: "approve" | "reject" | "trust" | "review" | "rescan" | "remove"
  ) {
    startTransition(async () => {
      let r;
      switch (action) {
        case "approve":
          r = await approveScannedVersion(versionId);
          break;
        case "reject":
          r = await rejectScannedVersion(versionId);
          break;
        case "trust":
          r = await markVersionTrusted(versionId);
          break;
        case "review":
          r = await requestVersionReview(versionId);
          break;
        case "rescan":
          r = await reprocessVersionScan(versionId);
          break;
        case "remove":
          r = await removeVersionScan(versionId);
          break;
      }
      if (r?.success) toast({ title: "Action completed" });
      else if (r) toast({ title: r.error, variant: "destructive" });
    });
  }

  function bulk(action: "approve" | "reject") {
    if (selected.length === 0) return;
    startTransition(async () => {
      const r =
        action === "approve"
          ? await bulkApproveVersions(selected)
          : await bulkRejectVersions(selected);
      if (r.success) {
        toast({ title: `${r.data.count} files ${action}d` });
        setSelected([]);
      } else toast({ title: r.error, variant: "destructive" });
    });
  }

  function toggleSelect(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {[
          { label: "Scanned today", value: stats.scannedToday },
          { label: "Pending reviews", value: stats.pendingReviews },
          { label: "Approved", value: stats.approved },
          { label: "Rejected", value: stats.rejected },
          { label: "Suspicious", value: stats.suspicious },
          { label: "Malware", value: stats.malware },
          { label: "Failed scans", value: stats.failedScans },
          {
            label: "VT quota",
            value: `${stats.quota.requestsUsed}/${stats.quota.requestsLimit}`,
          },
        ].map((s) => (
          <Card key={s.label} className="glass">
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={pending} onClick={runWorker}>
          Process scan queue
        </Button>
        <Button variant="outline" size="sm" disabled={pending} onClick={exportReport}>
          Export reports
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending || selected.length === 0}
          onClick={() => bulk("approve")}
        >
          Bulk approve ({selected.length})
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={pending || selected.length === 0}
          onClick={() => bulk("reject")}
        >
          Bulk reject
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border/40 pb-2">
        {(
          [
            ["approvals", "File approvals"],
            ["history", "Scan history"],
            ["audit", "Audit logs"],
            ["settings", "Settings"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={tab === key ? "default" : "ghost"}
            onClick={() => setTab(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {tab === "approvals" && (
        <Card className="glass">
            <CardHeader>
              <CardTitle>Pending file approvals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats.pendingApprovals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No files awaiting review.</p>
              ) : (
                stats.pendingApprovals.map((v) => (
                  <div
                    key={v.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 pb-3 last:border-0"
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selected.includes(v.id)}
                        onChange={() => toggleSelect(v.id)}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-medium text-sm">{v.mod.title} v{v.version}</p>
                        <p className="text-xs text-muted-foreground">{v.fileName}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <SecurityBadge scanStatus={v.scanStatus} isTrusted={!!v.trustedFile} />
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => review(v.id, "approve")}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => review(v.id, "trust")}>
                        Mark trusted
                      </Button>
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => review(v.id, "rescan")}>
                        Re-scan
                      </Button>
                      <Button size="sm" variant="destructive" disabled={pending} onClick={() => review(v.id, "reject")}>
                        Reject
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
      )}

      {tab === "history" && (
        <Card className="glass">
            <CardHeader>
              <CardTitle>Scan history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats.recent.map((log) => (
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
                    <Badge variant={log.status === "CLEAN" || log.status === "APPROVED" ? "default" : "destructive"}>
                      {log.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {log.detections}/{log.totalEngines}
                    </span>
                    {log.modVersion && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" disabled={pending} onClick={() => review(log.modVersion!.id, "approve")}>
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" disabled={pending} onClick={() => review(log.modVersion!.id, "rescan")}>
                          Re-scan
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
      )}

      {tab === "audit" && (
        <Card className="glass">
            <CardHeader>
              <CardTitle>Security audit logs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.auditRecent.map((log) => (
                <div key={log.id} className="flex justify-between gap-2 text-sm border-b border-border/20 pb-2">
                  <span className="font-mono text-xs">{log.action}</span>
                  <span className="text-muted-foreground text-xs">
                    {log.user?.displayName ?? log.user?.username ?? "system"} ·{" "}
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
      )}

      {tab === "settings" && (
        <Card className="glass">
            <CardHeader>
              <CardTitle>Malware scanner settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-xl">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Scanner enabled</label>
                <Switch checked={form.enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
              </div>
              <div>
                <label className="text-sm font-medium">VirusTotal API key</label>
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
                  onChange={(e) => setForm((f) => ({ ...f, scanThreshold: Number(e.target.value) || 2 }))}
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
                  onCheckedChange={(v) => setForm((f) => ({ ...f, requireManualReviewSuspicious: v }))}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                VT uploads today: {stats.quota.uploadsUsed}/{stats.quota.uploadsLimit} · Requests remaining:{" "}
                {stats.quota.requestsRemaining}
              </p>
              <Button onClick={saveSettings} disabled={pending}>
                Save settings
              </Button>
            </CardContent>
          </Card>
      )}
    </div>
  );
}
