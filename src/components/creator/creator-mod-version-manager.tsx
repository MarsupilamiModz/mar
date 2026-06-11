"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  archiveModVersion,
  restoreModVersion,
  setModVersionPrimary,
  setModVersionChannel,
} from "@/actions/mods";
import type { FileScanStatus, VersionChannel } from "@prisma/client";
import { formatBytes } from "@/lib/file-size";

type Version = {
  id: string;
  version: string;
  changelog: string | null;
  gameVersion: string | null;
  fileSize: bigint | number;
  channel: VersionChannel;
  isPrimary: boolean;
  isArchived: boolean;
  scanStatus: FileScanStatus;
  downloadCount: number;
  createdAt: Date;
};

export function CreatorModVersionManager({ versions }: { modId?: string; versions: Version[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function act(fn: () => Promise<{ success: boolean; error?: string }>, label: string) {
    startTransition(async () => {
      const r = await fn();
      if (r.success) {
        toast({ title: label });
        router.refresh();
      } else toast({ title: r.error ?? "Failed", variant: "destructive" });
    });
  }

  if (versions.length === 0) {
    return (
      <Card className="glass">
        <CardHeader><CardTitle>Version history</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">No versions uploaded yet.</CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader><CardTitle>Version history</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {versions.map((v) => (
          <div key={v.id} className="border-b border-border/30 pb-3 last:border-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">v{v.version}</span>
              {v.isPrimary && <Badge>Latest</Badge>}
              {v.channel === "BETA" && <Badge variant="outline">Beta</Badge>}
              {v.isArchived && <Badge variant="outline">Archived</Badge>}
              <Badge variant={v.scanStatus === "CLEAN" ? "default" : "destructive"}>{v.scanStatus}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}
              {" · "}
              {formatBytes(v.fileSize)}
              {v.gameVersion && ` · ${v.gameVersion}`}
              {" · "}
              {v.downloadCount.toLocaleString()} downloads
            </p>
            {v.changelog && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{v.changelog}</p>}
            <div className="flex flex-wrap gap-1 mt-2">
              {!v.isPrimary && !v.isArchived && (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => setModVersionPrimary(v.id), "Set as latest")}>
                  Set as latest
                </Button>
              )}
              {!v.isArchived ? (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => archiveModVersion(v.id), "Version archived")}>
                  Archive
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => restoreModVersion(v.id), "Version restored")}>
                  Restore
                </Button>
              )}
              {v.channel !== "BETA" && !v.isArchived && (
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => setModVersionChannel(v.id, "BETA"), "Marked as beta")}>
                  Mark beta
                </Button>
              )}
              {v.channel === "BETA" && (
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => setModVersionChannel(v.id, "STABLE"), "Marked as stable")}>
                  Mark stable
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
