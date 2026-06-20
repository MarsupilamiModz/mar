"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { getScreenshotDiagnostics, repairScreenshotLinks } from "@/actions/admin/screenshot-diagnostics";
import type { ScreenshotDiagnosticRow } from "@/lib/media-diagnostics";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppToast } from "@/hooks/use-app-toast";
import { RefreshCw, Wrench, CheckCircle2, XCircle, HelpCircle } from "lucide-react";

type Props = {
  locale: string;
  initial: {
    rows: ScreenshotDiagnosticRow[];
    summary: {
      total: number;
      missingUrl: number;
      broken: number;
      ok: number;
      storageProvider: string;
      storageConfigured: boolean;
      cdnUrl: string | null;
    };
  };
};

function StatusBadge({ ok }: { ok: boolean | null }) {
  if (ok === true) {
    return (
      <Badge variant="outline" className="gap-1 border-green-500/40 text-green-400">
        <CheckCircle2 className="h-3 w-3" /> Reachable
      </Badge>
    );
  }
  if (ok === false) {
    return (
      <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
        <XCircle className="h-3 w-3" /> Broken
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <HelpCircle className="h-3 w-3" /> Unknown
    </Badge>
  );
}

export function ScreenshotDiagnosticsPanel({ locale, initial }: Props) {
  const appToast = useAppToast();
  const [data, setData] = useState(initial);
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const r = await getScreenshotDiagnostics(100);
      if (r.success) setData(r.data);
      else appToast.error(r.error);
    });
  }

  function repair() {
    startTransition(async () => {
      const r = await repairScreenshotLinks();
      if (r.success) {
        appToast.saved(`Repaired ${r.data.repaired} screenshot links`);
        refresh();
      } else appToast.error(r.error);
    });
  }

  const { summary, rows } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Screenshot Diagnostics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify database records, storage paths, and public URL reachability for mod screenshots.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground">Scanned</p>
          <p className="text-2xl font-bold">{summary.total}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground">Reachable</p>
          <p className="text-2xl font-bold text-green-400">{summary.ok}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground">Broken / missing URL</p>
          <p className="text-2xl font-bold text-destructive">{summary.broken + summary.missingUrl}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground">Storage</p>
          <p className="text-sm font-medium">{summary.storageProvider}</p>
          <p className="text-xs text-muted-foreground truncate">
            {summary.cdnUrl ?? "App proxy (/api/assets)"}
          </p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={pending} onClick={refresh}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh scan
        </Button>
        <Button variant="neon" size="sm" disabled={pending} onClick={repair}>
          <Wrench className="h-4 w-4 mr-1" /> Repair missing screenshot links
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/${locale}/admin/settings/media`}>Media settings</Link>
        </Button>
      </div>

      <Card className="glass overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mod</TableHead>
              <TableHead>DB</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Storage path</TableHead>
              <TableHead>Reachable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No screenshot records found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      href={`/${locale}/mods/${row.modSlug}`}
                      className="font-medium hover:text-neon-purple line-clamp-1"
                    >
                      {row.modTitle}
                    </Link>
                    <p className="text-[10px] text-muted-foreground font-mono">{row.id.slice(0, 8)}…</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.dbStatus === "ok" ? "outline" : "destructive"}>
                      {row.dbStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <p className="truncate text-xs font-mono" title={row.resolvedUrl ?? undefined}>
                      {row.resolvedUrl ?? "—"}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-[180px]">
                    <p className="truncate text-xs font-mono" title={row.storagePath ?? undefined}>
                      {row.storagePath ?? "—"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge ok={row.reachable} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
