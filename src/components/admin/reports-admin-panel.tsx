"use client";

import { useState, useTransition } from "react";
import { safeToLocaleDateString } from "@/lib/i18n/safe-locale";
import { ReportPriority, ReportStatus } from "@prisma/client";
import { assignReport, updateReportStatus } from "@/actions/admin/trust";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

type Report = {
  id: string;
  targetType: string;
  targetId: string;
  category: string;
  description: string;
  status: ReportStatus;
  priority: ReportPriority;
  adminNotes: string | null;
  internalNotes: string | null;
  assignmentRole: string | null;
  attachments: unknown;
  createdAt: Date;
  reporter: { username: string; email: string };
  assignee: { username: string } | null;
};

const STATUSES: ReportStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "NEEDS_MORE_INFO",
  "INVESTIGATING",
  "RESOLVED",
  "REJECTED",
];

const PRIORITIES: ReportPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

export function ReportsAdminPanel({ reports }: { reports: Report[] }) {
  const [rows, setRows] = useState(reports);
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [internal, setInternal] = useState<Record<string, string>>({});
  const [assigneeIds, setAssigneeIds] = useState<Record<string, string>>({});

  function updateStatus(id: string, status: ReportStatus, priority?: ReportPriority) {
    startTransition(async () => {
      const r = await updateReportStatus(
        id,
        status,
        undefined,
        notes[id],
        internal[id],
        priority
      );
      if (r.success) {
        setRows((prev) =>
          prev.map((row) =>
            row.id === id ? { ...row, status, priority: priority ?? row.priority } : row
          )
        );
        toast({ title: "Report updated" });
      } else toast({ title: "Error", description: r.error, variant: "destructive" });
    });
  }

  function assign(id: string, role: "MODERATOR" | "ADMIN" | "OWNER") {
    const assigneeId = assigneeIds[id]?.trim();
    if (!assigneeId) {
      toast({ title: "Enter a staff user ID", variant: "destructive" });
      return;
    }
    startTransition(async () => {
      const r = await assignReport(id, assigneeId, role);
      if (r.success) {
        toast({ title: "Report assigned" });
      } else toast({ title: "Error", description: r.error, variant: "destructive" });
    });
  }

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reports.</p>
      ) : (
        rows.map((report) => (
          <Card key={report.id} className="glass">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-sm">{report.category.replace(/_/g, " ")}</CardTitle>
                <Badge variant="outline">{report.status.replace(/_/g, " ")}</Badge>
                <Badge variant="secondary">{report.targetType}</Badge>
                <Badge>{report.priority}</Badge>
                {report.assignmentRole && (
                  <Badge variant="outline">{report.assignmentRole}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                by @{report.reporter.username} · {safeToLocaleDateString(new Date(report.createdAt))}
                {report.assignee ? ` · assigned to @${report.assignee.username}` : ""}
              </p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="whitespace-pre-wrap">{report.description}</p>
              <p className="text-xs text-muted-foreground">Target ID: {report.targetId}</p>
              {Array.isArray(report.attachments) && report.attachments.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Attachments: {report.attachments.length}
                </div>
              )}
              <Textarea
                placeholder="Staff notes (visible in admin)…"
                value={notes[report.id] ?? report.adminNotes ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [report.id]: e.target.value }))}
                rows={2}
                className="text-xs"
              />
              <Textarea
                placeholder="Internal notes (staff only)…"
                value={internal[report.id] ?? report.internalNotes ?? ""}
                onChange={(e) => setInternal((n) => ({ ...n, [report.id]: e.target.value }))}
                rows={2}
                className="text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <Select
                  value={report.status}
                  onValueChange={(v) => updateStatus(report.id, v as ReportStatus)}
                  disabled={pending}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={report.priority}
                  onValueChange={(v) => updateStatus(report.id, report.status, v as ReportPriority)}
                  disabled={pending}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Staff user ID"
                  value={assigneeIds[report.id] ?? ""}
                  onChange={(e) => setAssigneeIds((a) => ({ ...a, [report.id]: e.target.value }))}
                  className="max-w-xs text-xs"
                />
                <Button size="sm" variant="outline" disabled={pending} onClick={() => assign(report.id, "MODERATOR")}>
                  Assign moderator
                </Button>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => assign(report.id, "ADMIN")}>
                  Assign admin
                </Button>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => assign(report.id, "OWNER")}>
                  Assign owner
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
