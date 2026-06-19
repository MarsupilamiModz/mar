"use client";

import { useTransition } from "react";
import { safeToLocaleString } from "@/lib/i18n/safe-locale";
import { formatDistanceToNow } from "date-fns";
import { Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VersionChannel } from "@prisma/client";
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
  downloadCount: number;
  createdAt: Date;
};

type Props = {
  modId: string;
  versions: Version[];
};

export function ModVersionsPanel({ modId, versions }: Props) {
  const [pending, startTransition] = useTransition();

  function downloadVersion(versionId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/mods/${modId}/download?versionId=${versionId}`, {
        method: "POST",
      });
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      }
    });
  }

  const active = versions.filter((v) => !v.isArchived);
  const archived = versions.filter((v) => v.isArchived);

  if (versions.length === 0) return null;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Versions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {active.map((v) => (
          <VersionRow key={v.id} version={v} pending={pending} onDownload={downloadVersion} />
        ))}
        {archived.length > 0 && (
          <>
            <p className="text-xs uppercase tracking-wider text-muted-foreground pt-2">Legacy</p>
            {archived.map((v) => (
              <VersionRow key={v.id} version={v} pending={pending} onDownload={downloadVersion} legacy />
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function VersionRow({
  version,
  pending,
  onDownload,
  legacy,
}: {
  version: Version;
  pending: boolean;
  onDownload: (id: string) => void;
  legacy?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/30 py-3 last:border-0">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium">v{version.version}</span>
          {version.isPrimary && <Badge variant="default">Latest</Badge>}
          {version.channel === "BETA" && <Badge variant="outline">Beta</Badge>}
          {legacy && (
            <Badge variant="outline" className="gap-1">
              <RotateCcw className="h-3 w-3" /> Legacy
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
          {" · "}
          {formatBytes(version.fileSize)}
          {version.gameVersion && ` · ${version.gameVersion}`}
          {` · ${safeToLocaleString(version.downloadCount)} downloads`}
        </p>
        {version.changelog && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{version.changelog}</p>
        )}
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => onDownload(version.id)}
      >
        <Download className="h-4 w-4 mr-1" />
        {version.isPrimary ? "Download" : "Rollback"}
      </Button>
    </div>
  );
}
