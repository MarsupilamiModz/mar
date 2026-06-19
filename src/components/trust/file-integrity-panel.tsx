"use client";

import { useState } from "react";
import { Copy, Check, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { safeToLocaleDateString } from "@/lib/i18n/safe-locale";

export function FileIntegrityPanel({
  sha256,
  fileSize,
  uploadedAt,
  locale = "en",
}: {
  sha256: string | null | undefined;
  fileSize?: number | null;
  uploadedAt?: Date | null;
  locale?: string;
}) {
  const [copied, setCopied] = useState(false);

  if (!sha256) return null;

  async function copyHash() {
    await navigator.clipboard.writeText(sha256!);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatSize(bytes?: number | null) {
    if (!bytes) return null;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return (
    <Card className="glass border-border/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          File Integrity
          <Badge variant="premium" className="text-[10px] ml-auto">Verified Upload</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div>
          <p className="text-muted-foreground mb-1">SHA-256</p>
          <div className="flex items-start gap-2">
            <code className="flex-1 break-all rounded bg-background/50 p-2 font-mono text-[10px]">
              {sha256}
            </code>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              title="Copy hash for verification"
              onClick={copyHash}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
        {fileSize != null && (
          <p className="text-muted-foreground">Size: {formatSize(fileSize)}</p>
        )}
        {uploadedAt && (
          <p className="text-muted-foreground">
            Uploaded: {safeToLocaleDateString(new Date(uploadedAt), locale, { dateStyle: "medium", timeStyle: "short" })}
          </p>
        )}
        <p className="text-muted-foreground/80 pt-1">
          Compare this hash after download to verify the file was not modified in transit.
        </p>
      </CardContent>
    </Card>
  );
}
