"use client";

import { useState, useTransition } from "react";
import { safeToLocaleDateString } from "@/lib/i18n/safe-locale";
import { ReportStatus } from "@prisma/client";
import { updateReportStatus } from "@/actions/admin/trust";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  adminNotes: string | null;
  createdAt: Date;
  reporter: { username: string; email: string };
  assignee: { username: string } | null;
};

const STATUSES: ReportStatus[] = ["SUBMITTED", "UNDER_REVIEW", "INVESTIGATING", "RESOLVED", "REJECTED"];

export function ReportsAdminPanel({ reports }: { reports: Report[] }) {
  const [rows, setRows] = useState(reports);
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState<Record<string, string>>({});

  function updateStatus(id: string, status: ReportStatus) {
    startTransition(async () => {
      const r = await updateReportStatus(id, status, undefined, notes[id]);
      if (r.success) {
        setRows((prev) => prev.map((row) => (row.id === id ? { ...row, status } : row)));
        toast({ title: "Report updated" });
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
                <Badge variant="outline">{report.status}</Badge>
                <Badge variant="secondary">{report.targetType}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                by @{report.reporter.username} · {safeToLocaleDateString(new Date(report.createdAt))}
              </p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="whitespace-pre-wrap">{report.description}</p>
              <p className="text-xs text-muted-foreground">Target ID: {report.targetId}</p>
              <Textarea
                placeholder="Admin notes…"
                value={notes[report.id] ?? report.adminNotes ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [report.id]: e.target.value }))}
                rows={2}
                className="text-xs"
              />
              <Select value={report.status} onValueChange={(v) => updateStatus(report.id, v as ReportStatus)} disabled={pending}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
